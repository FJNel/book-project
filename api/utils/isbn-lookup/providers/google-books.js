const config = require("../../../config");
const { logToFile } = require("../../logging");
const {
	MAX_TITLE_LENGTH,
	MAX_SUBTITLE_LENGTH,
	MAX_TAG_LENGTH,
	deriveLanguageName,
	fetchCachedJson,
	inferBookTypeFromHints,
	mergeNamedItems,
	normalizeIsbnValue,
	parsePartialDateFromSource,
	pickBetterCover,
	sanitizeLookupDescription,
	sanitizeLookupPageCount,
	sanitizeLookupText,
	splitAuthorNameParts
} = require("../shared");

function extractGoogleBooksVolume(payload, isbn) {
	const items = Array.isArray(payload?.items) ? payload.items : [];
	if (items.length === 0) return null;

	const normalizedIsbn = normalizeIsbnValue(isbn);
	const preferred = items.find((item) => {
		const identifiers = Array.isArray(item?.volumeInfo?.industryIdentifiers) ? item.volumeInfo.industryIdentifiers : [];
		return identifiers.some((entry) => normalizeIsbnValue(entry?.identifier) === normalizedIsbn);
	}) || items[0];

	const info = preferred?.volumeInfo || {};
	const saleInfo = preferred?.saleInfo || {};
	const title = sanitizeLookupText(info.title, MAX_TITLE_LENGTH);
	if (!title) return null;

	const authors = mergeNamedItems(
		(Array.isArray(info.authors) ? info.authors : []).map((name) => {
			const parts = splitAuthorNameParts(name);
			return {
				authorId: null,
				authorRole: "Author",
				authorName: parts.displayName,
				displayName: parts.displayName,
				firstNames: parts.firstNames,
				lastName: parts.lastName,
				birthDate: null,
				deathDate: null,
				deceased: false,
				bio: null
			};
		}),
		(item) => item.authorName
	);

	const categories = mergeNamedItems(
		(Array.isArray(info.categories) ? info.categories : [])
			.flatMap((entry) => String(entry || "").split("/"))
			.map((name) => ({
				id: null,
				name: sanitizeLookupText(name, MAX_TAG_LENGTH)
			})),
		(item) => item.name
	);

	const bookType = inferBookTypeFromHints([
		info.printType,
		info.binding,
		info.format,
		saleInfo?.isEbook ? "ebook" : null
	]);

	return {
		source: "googleBooks",
		title,
		subtitle: sanitizeLookupText(info.subtitle, MAX_SUBTITLE_LENGTH),
		description: sanitizeLookupDescription(info.description),
		pageCount: sanitizeLookupPageCount(info.pageCount),
		publicationDate: parsePartialDateFromSource(info.publishedDate),
		coverImageUrl: pickBetterCover(
			info.imageLinks?.extraLarge,
			info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || info.imageLinks?.large || info.imageLinks?.medium
		),
		bookType,
		publisher: sanitizeLookupText(info.publisher, 150)
			? {
				id: null,
				name: sanitizeLookupText(info.publisher, 150),
				foundedDate: null,
				website: null,
				notes: null
			}
			: null,
		authors,
		languages: mergeNamedItems(
			[deriveLanguageName(info.language)].filter(Boolean).map((name) => ({ id: null, name })),
			(item) => item.name
		),
		tags: categories,
		series: []
	};
}

module.exports = {
	name: "googleBooks",
	async fetchByIsbn({ isbn }) {
		const apiKey = config?.google?.booksApiKey || "";
		const warnings = [];
		if (!apiKey) {
			logToFile("BOOK_ISBN_LOOKUP_PROVIDER", {
				status: "INFO",
				provider: "googleBooks",
				reason: "GOOGLE_BOOKS_API_KEY_MISSING",
				isbn
			}, "warn");
			warnings.push("Google Books API key is not configured, so the public Google Books lookup was used.");
		}

		const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ""}`;
		const payload = await fetchCachedJson({
			provider: "googleBooks",
			resource: "isbn",
			identifier: isbn,
			url,
			timeoutMs: 3200
		});
		return {
			metadata: extractGoogleBooksVolume(payload, isbn),
			warnings
		};
	}
};
