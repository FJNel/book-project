const googleBooksProvider = require("./providers/google-books");
const openLibraryProvider = require("./providers/open-library");
const {
	deriveLanguageName,
	mergeLookupMetadata,
	normalizeLookupCompact,
	normalizeLookupName,
	sanitizeLookupText
} = require("./shared");

const providers = [googleBooksProvider, openLibraryProvider];

function buildUserFacingWarnings(providerResults) {
	const successfulMetadata = providerResults.filter((result) => result.metadata);
	if (successfulMetadata.length === 0) return [];

	const warnings = [];
	if (providerResults.some((result) => result.classification === "unavailable")) {
		warnings.push("Some external book sources were temporarily unavailable, so you may need to fill in a few details manually.");
	}

	if (!warnings.length && providerResults.some((result) => result.classification === "degraded")) {
		warnings.push("We found some details for this book, but not everything could be loaded.");
	}

	return warnings;
}

async function lookupIsbnMetadata({ isbn, debug = {} }) {
	const providerResults = await Promise.all(providers.map(async (provider) => {
		try {
			const result = await provider.fetchByIsbn({ isbn, debug });
			return {
				name: provider.name,
				metadata: result?.metadata || null,
				warnings: Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [],
				diagnostics: Array.isArray(result?.diagnostics) ? result.diagnostics.filter(Boolean) : [],
				degraded: Boolean(result?.degraded),
				classification: result?.classification || (result?.metadata ? (result?.degraded ? "degraded" : "success") : "no_metadata"),
				error: null
			};
		} catch (error) {
			return {
				name: provider.name,
				metadata: null,
				warnings: [],
				diagnostics: [],
				degraded: false,
				classification: "unavailable",
				error
			};
		}
	}));

	const successfulMetadata = providerResults.filter((result) => result.metadata);
	const warnings = buildUserFacingWarnings(providerResults);

	return {
		merged: mergeLookupMetadata({
			isbn,
			providers: successfulMetadata.map((result) => result.metadata),
			warnings
		}),
		warnings: Array.from(new Set(warnings.filter(Boolean))),
		providerResults
	};
}

module.exports = {
	lookupIsbnMetadata,
	normalizeLookupCompact,
	normalizeLookupName,
	sanitizeLookupText,
	deriveLanguageName
};
