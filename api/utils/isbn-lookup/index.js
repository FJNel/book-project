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

async function lookupIsbnMetadata({ isbn }) {
	const warnings = [];
	const providerResults = await Promise.all(providers.map(async (provider) => {
		try {
			const result = await provider.fetchByIsbn({ isbn });
			return {
				name: provider.name,
				metadata: result?.metadata || null,
				warnings: Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [],
				error: null
			};
		} catch (error) {
			return {
				name: provider.name,
				metadata: null,
				warnings: [],
				error
			};
		}
	}));

	for (const result of providerResults) {
		warnings.push(...result.warnings);
	}

	const successfulMetadata = providerResults.filter((result) => result.metadata);
	if (successfulMetadata.length > 0) {
		for (const result of providerResults) {
			if (!result.metadata && result.error) {
				const sourceName = result.name === "googleBooks" ? "Google Books" : "Open Library";
				warnings.push(`${sourceName} was unavailable, so available metadata from other sources was used.`);
			}
		}
	}

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
