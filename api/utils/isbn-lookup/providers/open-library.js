const {
	MAX_TITLE_LENGTH,
	MAX_SUBTITLE_LENGTH,
	MAX_TAG_LENGTH,
	extractStringValue,
	fetchJsonWithTimeout,
	inferBookTypeFromHints,
	mergeNamedItems,
	parsePartialDateFromSource,
	pickBetterCover,
	pickBetterDate,
	pickBetterString,
	sanitizeLookupDescription,
	sanitizeLookupPageCount,
	sanitizeLookupText,
	splitAuthorNameParts
} = require("../shared");

function normalizeOpenLibraryKey(value) {
	const normalized = sanitizeLookupText(value, 120);
	if (!normalized) return null;
	if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
		try {
			return new URL(normalized).pathname;
		} catch (_) {
			return normalized;
		}
	}
	return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function buildOpenLibraryCoverUrl(coverId) {
	const parsed = Number.parseInt(coverId, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return `https://covers.openlibrary.org/b/id/${parsed}-L.jpg`;
}

function parseOpenLibrarySeries(items, bookOrder) {
	return mergeNamedItems(
		(Array.isArray(items) ? items : []).map((entry) => {
			const name = sanitizeLookupText(typeof entry === "string" ? entry : entry?.name, 150);
			if (!name) return null;
			return {
				seriesId: null,
				seriesName: name,
				name,
				bookOrder: Number.isInteger(bookOrder) ? bookOrder : null,
				description: null,
				website: null
			};
		}).filter(Boolean),
		(item) => item.seriesName || item.name
	);
}

function buildEnrichedAuthors({ bookAuthors, editionAuthors, authorDetailsByKey }) {
	const orderedAuthors = [];
	const seen = new Set();

	const addAuthor = (entry, authorKey) => {
		const authorName = sanitizeLookupText(entry?.name, 150);
		const detail = authorKey ? authorDetailsByKey.get(authorKey) : null;
		const parts = splitAuthorNameParts(detail?.displayName || authorName);
		const key = (detail?.displayName || authorName || "").toLowerCase();
		if (!key || seen.has(key)) return;
		seen.add(key);
		orderedAuthors.push({
			authorId: null,
			authorRole: "Author",
			authorName: parts.displayName,
			displayName: parts.displayName,
			firstNames: detail?.firstNames || parts.firstNames,
			lastName: detail?.lastName || parts.lastName,
			birthDate: detail?.birthDate || null,
			deathDate: detail?.deathDate || null,
			deceased: Boolean(detail?.deceased || detail?.deathDate),
			bio: detail?.bio || null
		});
	};

	(Array.isArray(bookAuthors) ? bookAuthors : []).forEach((entry) => {
		const authorKey = normalizeOpenLibraryKey(entry?.key || entry?.url);
		addAuthor({ name: entry?.name }, authorKey);
	});

	(Array.isArray(editionAuthors) ? editionAuthors : []).forEach((entry) => {
		const authorKey = normalizeOpenLibraryKey(entry?.key || entry?.author?.key);
		const detail = authorDetailsByKey.get(authorKey);
		addAuthor({ name: detail?.displayName || entry?.name }, authorKey);
	});

	return orderedAuthors;
}

function extractDescriptionFromOpenLibrary(record, work) {
	return sanitizeLookupDescription(
		extractStringValue(work?.description)
		|| extractStringValue(record?.description)
		|| extractStringValue(record?.notes)
		|| extractStringValue(record?.subtitle)
	);
}

function extractOpenLibraryMetadata({ isbnRecord, edition, work, authorDetailsByKey }) {
	const title = sanitizeLookupText(isbnRecord?.title || edition?.title, MAX_TITLE_LENGTH);
	if (!title) return null;

	const coverImageUrl = pickBetterCover(
		isbnRecord?.cover?.large,
		isbnRecord?.cover?.medium
			|| isbnRecord?.cover?.small
			|| buildOpenLibraryCoverUrl(Array.isArray(edition?.covers) ? edition.covers[0] : null)
	);

	const publisherName = sanitizeLookupText(
		isbnRecord?.publishers?.[0]?.name
			|| edition?.publishers?.[0],
		150
	);

	const seriesOrder = Number.isInteger(edition?.number_in_series)
		? edition.number_in_series
		: Number.isInteger(work?.number_in_series)
			? work.number_in_series
			: null;

	return {
		source: "openLibrary",
		title,
		subtitle: sanitizeLookupText(isbnRecord?.subtitle || edition?.subtitle, MAX_SUBTITLE_LENGTH),
		description: extractDescriptionFromOpenLibrary(isbnRecord, work),
		pageCount: sanitizeLookupPageCount(isbnRecord?.number_of_pages || edition?.number_of_pages),
		publicationDate: parsePartialDateFromSource(isbnRecord?.publish_date || edition?.publish_date || work?.first_publish_date),
		coverImageUrl,
		bookType: inferBookTypeFromHints([
			edition?.physical_format,
			edition?.format,
			edition?.notes,
			work?.type?.key
		]),
		publisher: publisherName
			? {
				id: null,
				name: publisherName,
				foundedDate: null,
				website: null,
				notes: null
			}
			: null,
		authors: buildEnrichedAuthors({
			bookAuthors: isbnRecord?.authors,
			editionAuthors: edition?.authors,
			authorDetailsByKey
		}),
		languages: [],
		tags: mergeNamedItems(
			[
				...(Array.isArray(isbnRecord?.subjects) ? isbnRecord.subjects.map((entry) => entry?.name) : []),
				...(Array.isArray(work?.subjects) ? work.subjects : [])
			].map((name) => ({
				id: null,
				name: sanitizeLookupText(name, MAX_TAG_LENGTH)
			})),
			(item) => item.name
		),
		series: mergeNamedItems([
			...parseOpenLibrarySeries(isbnRecord?.series, seriesOrder),
			...parseOpenLibrarySeries(edition?.series, seriesOrder),
			...parseOpenLibrarySeries(work?.series, seriesOrder)
		], (item) => item.seriesName || item.name)
	};
}

async function fetchOpenLibraryAuthor(authorKey) {
	if (!authorKey) return null;
	const payload = await fetchJsonWithTimeout(`https://openlibrary.org${authorKey}.json`, { timeoutMs: 1800 });
	const displayName = sanitizeLookupText(payload?.name || payload?.personal_name, 150);
	if (!displayName) return null;
	const parts = splitAuthorNameParts(displayName);
	const deathDate = parsePartialDateFromSource(payload?.death_date);
	return {
		displayName,
		firstNames: parts.firstNames,
		lastName: parts.lastName,
		birthDate: parsePartialDateFromSource(payload?.birth_date),
		deathDate,
		deceased: Boolean(payload?.death_date || deathDate),
		bio: sanitizeLookupDescription(payload?.bio)
	};
}

module.exports = {
	name: "openLibrary",
	async fetchByIsbn({ isbn }) {
		const warnings = [];
		const [isbnResult, editionResult] = await Promise.allSettled([
			fetchJsonWithTimeout(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { timeoutMs: 3200 }),
			fetchJsonWithTimeout(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, { timeoutMs: 3200 })
		]);

		const isbnPayload = isbnResult.status === "fulfilled" ? isbnResult.value : null;
		const editionPayload = editionResult.status === "fulfilled" ? editionResult.value : null;

		if (!isbnPayload && !editionPayload) {
			throw editionResult.reason || isbnResult.reason || new Error("Open Library lookup failed.");
		}
		if (!isbnPayload && editionPayload) {
			warnings.push("Open Library returned partial edition data, so some lookup details may be missing.");
		}

		const isbnRecord = isbnPayload?.[`ISBN:${isbn}`] || null;
		const edition = editionPayload && typeof editionPayload === "object" ? editionPayload : null;
		if (!isbnRecord && !edition) {
			return { metadata: null, warnings };
		}

		let work = null;
		const workKey = normalizeOpenLibraryKey(
			Array.isArray(edition?.works) ? edition.works[0]?.key : Array.isArray(isbnRecord?.works) ? isbnRecord.works[0]?.key : null
		);
		if (workKey) {
			try {
				work = await fetchJsonWithTimeout(`https://openlibrary.org${workKey}.json`, { timeoutMs: 1800 });
			} catch (error) {
				warnings.push("Open Library work details were unavailable, so some description or series details may be missing.");
			}
		}

		const authorKeys = mergeNamedItems([
			...(Array.isArray(edition?.authors) ? edition.authors.map((entry) => ({ key: normalizeOpenLibraryKey(entry?.key || entry?.author?.key) })) : []),
			...(Array.isArray(isbnRecord?.authors) ? isbnRecord.authors.map((entry) => ({ key: normalizeOpenLibraryKey(entry?.key || entry?.url) })) : [])
		], (item) => item.key).map((entry) => entry.key).filter(Boolean).slice(0, 3);

		const authorDetailResults = await Promise.allSettled(authorKeys.map((key) => fetchOpenLibraryAuthor(key)));
		const authorDetailsByKey = new Map();
		authorDetailResults.forEach((result, index) => {
			const authorKey = authorKeys[index];
			if (result.status === "fulfilled" && result.value) {
				authorDetailsByKey.set(authorKey, result.value);
			} else if (result.status === "rejected") {
				warnings.push("Some Open Library author details were unavailable, so author biographies or life dates may be incomplete.");
			}
		});

		return {
			metadata: extractOpenLibraryMetadata({ isbnRecord, edition, work, authorDetailsByKey }),
			warnings: Array.from(new Set(warnings.filter(Boolean)))
		};
	}
};
