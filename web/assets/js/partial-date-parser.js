/**
 * Partial date parser implemented in JavaScript for browser/Node usage.
 * It implements the "Partial Date Parser Contract (Updated)" supplied for the project.
 * The parser accepts fuzzy, bilingual (English/Afrikaans), relative, numeric, and spelled-out
 * date expressions and returns a deterministic JSON object:
 *   { day: number|null, month: number|null, year: number|null, text: string }
 *
 * The parser always prefers the most recent date that is not after a provided reference date
 * when resolving partial inputs (day-only, month-only, or day+month without year).
 *
 * Exported API:
 *   parsePartialDate(input, options?)
 *      - input: string to parse
 *      - options.referenceDate: Date or date-like string; defaults to today's local date
 *      - options.preferMdy: boolean, only affects ambiguous numeric inputs; defaults to false (DD/MM first)
 *
 * The module attaches itself to `module.exports` (CommonJS) and to `window.partialDateParser`
 * when running in the browser.
 */
(function attachPartialDateParser(global) {
	const MONTH_MAP = {
		// English
		january: 1, jan: 1, "jan.": 1,
		february: 2, feb: 2, "feb.": 2,
		march: 3, mar: 3, "mar.": 3,
		april: 4, apr: 4, "apr.": 4,
		may: 5,
		june: 6, jun: 6, "jun.": 6,
		july: 7, jul: 7, "jul.": 7,
		august: 8, aug: 8, "aug.": 8,
		september: 9, sep: 9, "sep.": 9, sept: 9, "sept.": 9,
		october: 10, oct: 10, "oct.": 10,
		november: 11, nov: 11, "nov.": 11,
		december: 12, dec: 12, "dec.": 12,
		// Afrikaans
		januarie: 1,
		februarie: 2,
		maart: 3, mrt: 3,
		april: 4,
		mei: 5,
		junie: 6,
		julie: 7,
		augustus: 8,
		sept: 9, "sept.": 9, september: 9,
		oktober: 10, okt: 10, "okt.": 10,
		november: 11,
		desember: 12, des: 12, "des.": 12
	};
	const MONTH_NAMES_CANONICAL = [
		"january", "february", "march", "april", "may", "june",
		"july", "august", "september", "october", "november", "december",
		"januarie", "februarie", "maart", "april", "mei", "junie", "julie", "augustus", "september", "oktober", "november", "desember"
	];

	const MONTH_NAMES = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];

	const WEEKDAY_PATTERN = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|maandag|dinsdag|woensdag|donderdag|vrydag|saterdag|sondag),?\s+/i;

	const NUMBER_WORDS = {
		// English cardinals
		zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
		ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
		seventeen: 17, eighteen: 18, nineteen: 19,
		twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
		a: 1, an: 1,
		// Afrikaans cardinals
		een: 1, n: 1, twee: 2, drie: 3, vier: 4, vyf: 5, ses: 6, sewe: 7, agt: 8, nege: 9,
		tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vyftien: 15, sestien: 16,
		sewentien: 17, agtien: 18, negentien: 19,
		twintig: 20, dertig: 30, veertig: 40, vyftig: 50, sestig: 60, sewentig: 70, tagtig: 80, negentig: 90
	};

	const ORDINAL_WORDS = {
		// English ordinals
		first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
		eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
		eighteenth: 18, nineteenth: 19, twentieth: 20, twentyfirst: 21,
		"twenty-first": 21, "twenty-second": 22, "twenty-third": 23, "twenty-fourth": 24, "twenty-fifth": 25,
		"twenty-sixth": 26, "twenty-seventh": 27, "twenty-eighth": 28, "twenty-ninth": 29,
		thirtieth: 30, "thirty-first": 31,
		// Afrikaans ordinals
		eerste: 1, tweede: 2, derde: 3, vierde: 4, vyfde: 5, sesde: 6, sewende: 7, agtste: 8, negende: 9,
		tiende: 10, elfde: 11, twaalfde: 12, dertiende: 13, veertiende: 14, vyftiende: 15, sestiende: 16,
		sewentiende: 17, agtiende: 18, negentiende: 19, twintigste: 20,
		"een-en-twintigste": 21, "twee-en-twintigste": 22, "drie-en-twintigste": 23, "vier-en-twintigste": 24,
		"vyf-en-twintigste": 25, "ses-en-twintigste": 26, "sewe-en-twintigste": 27, "agt-en-twintigste": 28, "nege-en-twintigste": 29,
		dertigste: 30, "een-en-dertigste": 31
	};

	const CONNECTORS = new Set(["and", "en"]);
	const HUNDREDS = new Set(["hundred", "honderd"]);
	const THOUSANDS = new Set(["thousand", "duisend"]);

	const FAILURE_RESULT = { day: null, month: null, year: null, text: "" };

	function stripDiacritics(value) {
		return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	}

	function normalizeInput(raw) {
		const text = String(raw ?? "").replace(/[’‘]/g, "'").trim();
		if (!text) return "";

		let normalized = stripDiacritics(text);
		normalized = normalized.replace(WEEKDAY_PATTERN, "");
		normalized = normalized.replace(/,/g, " ");
		normalized = normalized.replace(/\b(of|van)\b/gi, " ");
		normalized = normalized.replace(/(\d+)(st|nd|rd|th|de|ste)\b/gi, "$1");
		normalized = normalized.replace(/([A-Za-z])\-([A-Za-z])/g, "$1 $2");
		normalized = normalized.replace(/[.;:]+$/, "");
		normalized = normalized.replace(/\s+/g, " ").trim();
		return normalized;
	}

	function monthFromToken(token) {
		if (!token) return null;
		const key = token.toLowerCase().replace(/\.$/, "");
		if (MONTH_MAP[key]) return MONTH_MAP[key];
		const lettersOnly = key.replace(/[^a-z]/gi, "");
		if (lettersOnly.length >= 3) {
			const match = MONTH_NAMES_CANONICAL.find((name) => name.startsWith(lettersOnly));
			if (match) return MONTH_MAP[match];
		}
		return null;
	}

	function isValidDate(year, month, day) {
		if (!year || !month || !day) return false;
		const d = new Date(year, month - 1, day);
		return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
	}

	function lastDayOfMonth(year, month) {
		return new Date(year, month, 0).getDate();
	}

	function shiftDays(baseDate, deltaDays) {
		const shifted = new Date(baseDate);
		shifted.setDate(baseDate.getDate() + deltaDays);
		return shifted;
	}

	function shiftMonths(baseDate, deltaMonths) {
		const startYear = baseDate.getFullYear();
		const startMonth = baseDate.getMonth();
		const totalMonths = startYear * 12 + startMonth + deltaMonths;
		const targetYear = Math.floor(totalMonths / 12);
		const targetMonth = totalMonths % 12;
		const maxDay = lastDayOfMonth(targetYear, targetMonth + 1);
		const targetDay = Math.min(baseDate.getDate(), maxDay);
		return new Date(targetYear, targetMonth, targetDay);
	}

	function shiftYears(baseDate, deltaYears) {
		const targetYear = baseDate.getFullYear() + deltaYears;
		const targetMonth = baseDate.getMonth();
		const maxDay = lastDayOfMonth(targetYear, targetMonth + 1);
		const targetDay = Math.min(baseDate.getDate(), maxDay);
		return new Date(targetYear, targetMonth, targetDay);
	}

	function formatText(day, month, year) {
		if (day && month && year) return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
		if (!day && month && year) return `${MONTH_NAMES[month - 1]} ${year}`;
		if (!day && !month && year) return String(year);
		if (!day && month && !year) return MONTH_NAMES[month - 1];
		return "";
	}

	function expandTwoDigitYear(value, referenceDate) {
		const refYear = referenceDate.getFullYear();
		const pivot = refYear % 100;
		if (value <= pivot) return 2000 + value;
		return 1900 + value;
	}

	function wordsToNumber(tokens) {
		let total = 0;
		let current = 0;
		for (const raw of tokens) {
			const word = raw.toLowerCase();
			if (CONNECTORS.has(word)) continue;
			if (HUNDREDS.has(word)) {
				current = current === 0 ? 100 : current * 100;
				continue;
			}
			if (THOUSANDS.has(word)) {
				current = current === 0 ? 1 : current;
				total += current * 1000;
				current = 0;
				continue;
			}
			if (NUMBER_WORDS[word] !== undefined) {
				current += NUMBER_WORDS[word];
				continue;
			}
			if (ORDINAL_WORDS[word] !== undefined) {
				current += ORDINAL_WORDS[word];
				continue;
			}
			return null;
		}
		total += current;
		return total > 0 ? total : null;
	}

	function parseYearWords(tokens) {
		const lowered = tokens.map((t) => t.toLowerCase());

		const containsMagnitude = lowered.some((w) => HUNDREDS.has(w) || THOUSANDS.has(w));
		const hasDoubleTwenty = lowered.length >= 2 && ((lowered[0] === "twenty" && lowered[1] === "twenty") || (lowered[0] === "twintig" && lowered[1] === "twintig"));
		const hasLikelyCentury = lowered.length >= 2 && (lowered[0] === "nineteen" || lowered[0] === "eighteen" || lowered[0] === "twenty");

		if (hasDoubleTwenty) {
			const remainder = wordsToNumber(lowered.slice(1)) ?? 0;
			const yearGuess = 2000 + remainder;
			if (yearGuess >= 1000 && yearGuess <= 2999) return yearGuess;
		}

		if (containsMagnitude || hasDoubleTwenty) {
			const direct = wordsToNumber(lowered);
			if (direct !== null && direct >= 1000 && direct <= 2999) return direct;
		}

		// Handle patterns like "nineteen ninety nine" -> 1999 (only when clearly year-like)
		const componentValues = [];
		for (const word of lowered) {
			if (CONNECTORS.has(word)) continue;
			const numeric = NUMBER_WORDS[word] ?? ORDINAL_WORDS[word];
			if (numeric === undefined) return null;
			componentValues.push(numeric);
		}
		if (componentValues.length >= 3 && hasLikelyCentury) {
			const candidate = componentValues[0] * 100 + componentValues.slice(1).reduce((a, b) => a + b, 0);
			if (candidate >= 1000 && candidate <= 2999) return candidate;
		}
		if (componentValues.length >= 2 && hasLikelyCentury && componentValues[1] >= 10) {
			const candidate = componentValues[0] * 100 + componentValues.slice(1).reduce((a, b) => a + b, 0);
			if (candidate >= 1000 && candidate <= 2999) return candidate;
		}
		return null;
	}

	function isNumberWordish(token) {
		const lower = token.toLowerCase();
		return NUMBER_WORDS[lower] !== undefined || ORDINAL_WORDS[lower] !== undefined || CONNECTORS.has(lower) || HUNDREDS.has(lower) || THOUSANDS.has(lower);
	}

	function replaceNumberWords(tokens) {
		const output = [];
		for (let i = 0; i < tokens.length; i += 1) {
			const token = tokens[i];
			if (isNumberWordish(token)) {
				const phrase = [];
				let j = i;
				while (j < tokens.length && isNumberWordish(tokens[j])) {
					phrase.push(tokens[j]);
					j += 1;
				}
				const parsedYear = parseYearWords(phrase);
				const parsedGeneric = parsedYear !== null ? parsedYear : wordsToNumber(phrase);
				if (parsedGeneric !== null) {
					output.push(String(parsedGeneric));
					i = j - 1;
					continue;
				}
			}
			output.push(token);
		}
		return output;
	}

	function buildResult(day, month, year) {
		const text = formatText(day, month, year);
		return { day: day ?? null, month: month ?? null, year: year ?? null, text };
	}

	function resolveYearForDayMonth(day, month, referenceDate) {
		const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
		const candidates = [
			new Date(ref.getFullYear() - 1, month - 1, day),
			new Date(ref.getFullYear(), month - 1, day),
			new Date(ref.getFullYear() + 1, month - 1, day)
		];
		let best = candidates[1];
		let bestDiff = Math.abs(best.getTime() - ref.getTime());
		for (const cand of candidates) {
			const diff = Math.abs(cand.getTime() - ref.getTime());
			if (diff < bestDiff || (diff === bestDiff && cand.getTime() > ref.getTime())) {
				best = cand;
				bestDiff = diff;
			}
		}
		return best.getFullYear();
	}

	function resolveMonthOnly(month, referenceDate) {
		const refMonth = referenceDate.getMonth() + 1;
		const refYear = referenceDate.getFullYear();
		if (month === refMonth) return { month, year: refYear };
		// Choose the nearer of this year or next year, preferring future on ties.
		const thisYear = new Date(refYear, month - 1, 1);
		const nextYear = new Date(refYear + 1, month - 1, 1);
		const ref = new Date(refYear, referenceDate.getMonth(), referenceDate.getDate());
		const diffThis = Math.abs(thisYear.getTime() - ref.getTime());
		const diffNext = Math.abs(nextYear.getTime() - ref.getTime());
		if (diffNext < diffThis || (diffNext === diffThis && nextYear.getTime() > ref.getTime())) {
			return { month, year: refYear + 1 };
		}
		return { month, year: refYear };
	}

	function resolveDayOnly(day, referenceDate) {
		const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
		const thisMonthDay = Math.min(day, lastDayOfMonth(ref.getFullYear(), ref.getMonth() + 1));
		const candidateThis = new Date(ref.getFullYear(), ref.getMonth(), thisMonthDay);
		const nextMonthDate = ref.getMonth() === 11
			? new Date(ref.getFullYear() + 1, 0, Math.min(day, lastDayOfMonth(ref.getFullYear() + 1, 1)))
			: new Date(ref.getFullYear(), ref.getMonth() + 1, Math.min(day, lastDayOfMonth(ref.getFullYear(), ref.getMonth() + 2)));

		const diffThis = Math.abs(candidateThis.getTime() - ref.getTime());
		const diffNext = Math.abs(nextMonthDate.getTime() - ref.getTime());
		const useNext = diffNext < diffThis || (diffNext === diffThis && nextMonthDate.getTime() > ref.getTime()) || candidateThis.getTime() < ref.getTime();
		const chosen = useNext ? nextMonthDate : candidateThis;
		return { day: chosen.getDate(), month: chosen.getMonth() + 1, year: chosen.getFullYear() };
	}

	function parseRelative(text, referenceDate) {
		const lowered = stripDiacritics(text.toLowerCase().trim());

		const dayKeywords = {
			today: 0, now: 0, vandag: 0, nou: 0,
			yesterday: -1, gister: -1,
			"day before yesterday": -2, eergister: -2,
			tomorrow: 1, more: 1,
			"day after tomorrow": 2, oormore: 2
		};

		if (dayKeywords[lowered] !== undefined) {
			const d = shiftDays(referenceDate, dayKeywords[lowered]);
			return buildResult(d.getDate(), d.getMonth() + 1, d.getFullYear());
		}

		const relativeCount = (value) => {
			if (!value) return null;
			const cleaned = value.replace(/^['’]/, "");
			if (/^-?\d+$/.test(cleaned)) return parseInt(cleaned, 10);
			return wordsToNumber(cleaned.split(/[\s-]+/));
		};

		const dayAnchorShift = /^(today|vandag|nou|yesterday|gister|tomorrow|more)\s+(?:in|oor)\s+([\w\s'-]+)\s+(?:year|years|jaar|jare)$/;
		let match = dayAnchorShift.exec(lowered);
		if (match) {
			const delta = relativeCount(match[2]);
			if (delta !== null) {
				const anchorKey = match[1];
				const baseShift = dayKeywords[anchorKey] ?? 0;
				const base = shiftDays(referenceDate, baseShift);
				const shifted = shiftYears(base, delta);
				return buildResult(shifted.getDate(), shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		const anchoredYearPast = /^(today|vandag|nou|yesterday|gister)\s+([\w\s'-]+)\s+(?:year|years|jaar|jare)(?:\s+(?:ago|gelede|terug))?$/;
		const anchoredMonthPast = /^(today|vandag|nou|yesterday|gister)\s+([\w\s'-]+)\s+(?:month|months|maand|maande)(?:\s+(?:ago|gelede|terug))?$/;
		const anchoredYearFuture = /^(?:in|oor)\s+([\w\s'-]+)\s+(?:year|years|jaar|jare)\s+(?:from\s+today|van\s+vandag|van\s+m\u00f4re|from\s+tomorrow)$/;
		const anchoredMonthFuture = /^(?:in|oor)\s+([\w\s'-]+)\s+(?:month|months|maand|maande)\s+(?:from\s+today|van\s+vandag|van\s+m\u00f4re|from\s+tomorrow)$/;

		match = anchoredYearPast.exec(lowered);
		if (match) {
			const delta = relativeCount(match[2]);
			if (delta !== null) {
				const shifted = shiftYears(referenceDate, -delta);
				return buildResult(shifted.getDate(), shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		match = anchoredMonthPast.exec(lowered);
		if (match) {
			const delta = relativeCount(match[2]);
			if (delta !== null) {
				const shifted = shiftMonths(referenceDate, -delta);
				return buildResult(shifted.getDate(), shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		match = anchoredYearFuture.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				const shifted = shiftYears(referenceDate, delta);
				return buildResult(shifted.getDate(), shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		match = anchoredMonthFuture.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				const shifted = shiftMonths(referenceDate, delta);
				return buildResult(shifted.getDate(), shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		const yearOnlyMap = {
			"this year": 0, "current year": 0, "hierdie jaar": 0, "huidige jaar": 0,
			"last year": -1, "previous year": -1, "verlede jaar": -1, "vorige jaar": -1,
			"next year": 1, "volgende jaar": 1
		};
		if (yearOnlyMap[lowered] !== undefined) {
			const targetYear = referenceDate.getFullYear() + yearOnlyMap[lowered];
			return buildResult(null, null, targetYear);
		}

		const monthOnlyMap = {
			"this month": 0, "current month": 0, "hierdie maand": 0, "huidige maand": 0,
			"last month": -1, "previous month": -1, "verlede maand": -1, "vorige maand": -1,
			"next month": 1, "volgende maand": 1
		};
		if (monthOnlyMap[lowered] !== undefined) {
			const shifted = shiftMonths(referenceDate, monthOnlyMap[lowered]);
			return buildResult(null, shifted.getMonth() + 1, shifted.getFullYear());
		}

		const relativeYearAgo = /^([\w\s'-]+)\s+(?:year|years|jaar|jare)\s+(?:ago|gelede|terug)$/;
		match = relativeYearAgo.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				return buildResult(null, null, referenceDate.getFullYear() - delta);
			}
		}

		const relativeMonthAgo = /^([\w\s'-]+)\s+(?:month|months|maand|maande)\s+(?:ago|gelede|terug)$/;
		match = relativeMonthAgo.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				const shifted = shiftMonths(referenceDate, -delta);
				return buildResult(null, shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		const relativeYearFuture = /^(?:in|oor)\s+([\w\s'-]+)\s+(?:year|years|jaar|jare)$/;
		match = relativeYearFuture.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				return buildResult(null, null, referenceDate.getFullYear() + delta);
			}
		}

		const relativeMonthFuture = /^(?:in|oor)\s+([\w\s'-]+)\s+(?:month|months|maand|maande)$/;
		match = relativeMonthFuture.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				const shifted = shiftMonths(referenceDate, delta);
				return buildResult(null, shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		const ambiguousYear = /^([\w\s'-]+)\s+(?:year|years|jaar|jare)$/;
		match = ambiguousYear.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				return buildResult(null, null, referenceDate.getFullYear() - delta);
			}
		}

		const ambiguousMonth = /^([\w\s'-]+)\s+(?:month|months|maand|maande)$/;
		match = ambiguousMonth.exec(lowered);
		if (match) {
			const delta = relativeCount(match[1]);
			if (delta !== null) {
				const shifted = shiftMonths(referenceDate, -delta);
				return buildResult(null, shifted.getMonth() + 1, shifted.getFullYear());
			}
		}

		return null;
	}

	function parseThreePartNumeric(normalized, referenceDate, preferMdy) {
		const match = /^(\d{1,4})[-/.\s](\d{1,4})[-/.\s](\d{1,4})$/.exec(normalized);
		if (!match) return null;
		const parts = match.slice(1);
		const lens = parts.map((p) => p.length);
		const nums = parts.map((p) => parseInt(p, 10));

		let yearIndex = lens.findIndex((len) => len === 4);
		let year = null;
		let day = null;
		let month = null;

		if (yearIndex !== -1) {
			year = nums[yearIndex];
			const remaining = [0, 1, 2].filter((idx) => idx !== yearIndex);
			const first = nums[remaining[0]];
			const second = nums[remaining[1]];

			if (preferMdy) {
				month = first;
				day = second;
			} else {
				day = first;
				month = second;
			}
			if (month > 12 || day > 31) {
				day = second;
				month = first;
			}
		} else {
			year = lens[2] === 2 ? expandTwoDigitYear(nums[2], referenceDate) : nums[2];
			day = nums[0];
			month = nums[1];
			if (month > 12 || !isValidDate(year, month, day)) {
				month = nums[0];
				day = nums[1];
			}
		}

		if (!isValidDate(year, month, day)) return null;
		return buildResult(day, month, year);
	}

	function parseTwoPartNumeric(normalized, referenceDate, preferMdy) {
		const match = /^(\d{1,4})[-/.\s](\d{1,4})$/.exec(normalized);
		if (!match) return null;
		const [rawA, rawB] = match.slice(1);
		const a = parseInt(rawA, 10);
		const b = parseInt(rawB, 10);

		// Month + explicit year (any order)
		if (rawA.length === 4 && b >= 1 && b <= 12) {
			return buildResult(null, b, a);
		}
		if (rawB.length === 4 && a >= 1 && a <= 12) {
			return buildResult(null, a, b);
		}

		if (a === 0 || b === 0) return null;

		let day;
		let month;
		if (a > 12 && b <= 12) {
			day = a; month = b;
		} else if (b > 12 && a <= 12) {
			month = a; day = b;
		} else if (preferMdy) {
			month = a; day = b;
		} else {
			day = a; month = b;
		}

		if (day < 1 || day > 31 || month < 1 || month > 12) return null;
		const year = resolveYearForDayMonth(day, month, referenceDate);
		if (!isValidDate(year, month, day)) return null;
		return buildResult(day, month, year);
	}

	function parseTwoNumberTokens(tokens, referenceDate, preferMdy) {
		if (tokens.length !== 2) return null;
		if (!tokens.every((t) => /^\d+$/.test(t))) return null;
		return parseTwoPartNumeric(tokens.join(" "), referenceDate, preferMdy);
	}

	function parseCompactNumeric(normalized) {
		const compact = normalized.replace(/\s+/g, "");
		if (!/^\d{8}$/.test(compact)) return null;

		const y1 = parseInt(compact.slice(0, 4), 10);
		const m1 = parseInt(compact.slice(4, 6), 10);
		const d1 = parseInt(compact.slice(6, 8), 10);
		if (y1 >= 1900 && y1 <= 2099 && isValidDate(y1, m1, d1)) {
			return buildResult(d1, m1, y1);
		}

		const d2 = parseInt(compact.slice(0, 2), 10);
		const m2 = parseInt(compact.slice(2, 4), 10);
		const y2 = parseInt(compact.slice(4, 8), 10);
		if (isValidDate(y2, m2, d2)) {
			return buildResult(d2, m2, y2);
		}

		const m3 = parseInt(compact.slice(0, 2), 10);
		const d3 = parseInt(compact.slice(2, 4), 10);
		const y3 = parseInt(compact.slice(4, 8), 10);
		if (isValidDate(y3, m3, d3)) {
			return buildResult(d3, m3, y3);
		}
		return null;
	}

	function parseWithMonthTokens(tokens, referenceDate, preferMdy) {
		const monthIndex = tokens.findIndex((token) => monthFromToken(token) !== null);
		if (monthIndex === -1) return null;
		if (tokens.filter((t) => monthFromToken(t) !== null).length > 1) {
			return null;
		}
		const month = monthFromToken(tokens[monthIndex]);
		const numbers = [];
		tokens.forEach((tok, idx) => {
			if (idx === monthIndex) return;
			if (/^\d+$/.test(tok)) {
				numbers.push({ value: parseInt(tok, 10), raw: tok, pos: idx < monthIndex ? "before" : "after" });
			}
		});

		let year = null;
		let day = null;

		const explicitYearCandidates = numbers.filter((n) => n.raw.length === 4 || n.value >= 1000);
		if (explicitYearCandidates.length > 0) {
			year = explicitYearCandidates[0].value;
		}

		const potentialTwoDigitYears = numbers.filter((n) => n.raw.length === 2);
		if (year === null && potentialTwoDigitYears.length === 1) {
			// Only one two-digit token present alongside a month: interpret as year unless another day token exists.
			year = expandTwoDigitYear(potentialTwoDigitYears[0].value, referenceDate);
			numbers.splice(numbers.indexOf(potentialTwoDigitYears[0]), 1);
		}

		const dayCandidate = numbers.find((n) => n.value >= 1 && n.value <= 31 && n.raw.length <= 2 && n.value !== year);
		if (dayCandidate) {
			day = dayCandidate.value;
		}

		if (day === null && numbers.length === 1 && year === null && numbers[0].value <= 31) {
			day = numbers[0].value;
		}

		if (day !== null && (day < 1 || day > 31)) return null;

		if (day !== null && year === null) {
			year = resolveYearForDayMonth(day, month, referenceDate);
		}

		if (day === null && year === null) {
			const resolved = resolveMonthOnly(month, referenceDate);
			return buildResult(null, resolved.month, resolved.year);
		}

		if (day === null && year !== null) {
			return buildResult(null, month, year);
		}

		if (!isValidDate(year, month, day)) return null;
		return buildResult(day, month, year);
	}

	function parseSingleToken(token, referenceDate) {
		const month = monthFromToken(token);
		if (month) {
			const resolved = resolveMonthOnly(month, referenceDate);
			return buildResult(null, resolved.month, resolved.year);
		}
		if (/^\d{4}$/.test(token)) {
			const year = parseInt(token, 10);
			if (year >= 1000 && year <= 2999) {
				return buildResult(null, null, year);
			}
		}
		if (/^\d{1,2}$/.test(token)) {
			const dayVal = parseInt(token, 10);
			if (dayVal >= 1 && dayVal <= 31) {
				const resolved = resolveDayOnly(dayVal, referenceDate);
				if (isValidDate(resolved.year, resolved.month, resolved.day)) {
					return buildResult(resolved.day, resolved.month, resolved.year);
				}
			}
		}
		return null;
	}

	function normalizeReferenceDate(ref) {
		if (ref instanceof Date) {
			return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
		}
		if (typeof ref === "string") {
			const ymd = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;
			const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
			let match = ymd.exec(ref.trim());
			if (match) {
				const [, y, m, d] = match.map((v) => parseInt(v, 10));
				const dt = new Date(y, m - 1, d);
				if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
					return dt;
				}
			}
			match = dmy.exec(ref.trim());
			if (match) {
				const [, d, m, y] = match.map((v) => parseInt(v, 10));
				const dt = new Date(y, m - 1, d);
				if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
					return dt;
				}
			}
		}
		const parsed = ref ? new Date(ref) : null;
		if (parsed && !Number.isNaN(parsed.getTime())) {
			return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
		}
		const today = new Date();
		return new Date(today.getFullYear(), today.getMonth(), today.getDate());
	}

	function parsePartialDate(input, options = {}) {
		if (input === null || input === undefined) return FAILURE_RESULT;
		if (typeof input !== "string") return FAILURE_RESULT;

		const referenceDate = normalizeReferenceDate(options.referenceDate ?? new Date());
		const preferMdy = options.preferMdy === true || options.preferMdy === "true";

		const normalized = normalizeInput(input);
		if (!normalized) return FAILURE_RESULT;

		const relative = parseRelative(normalized, referenceDate);
		if (relative) return relative;

		const tokens = normalized.split(/[\s]+/).filter(Boolean);
		const numericTokens = replaceNumberWords(tokens);

		const monthResult = parseWithMonthTokens(numericTokens, referenceDate, preferMdy);
		if (monthResult) return monthResult;

		const threePart = parseThreePartNumeric(normalized, referenceDate, preferMdy);
		if (threePart) return threePart;

		const twoPart = parseTwoPartNumeric(normalized, referenceDate, preferMdy);
		if (twoPart) return twoPart;

		const twoToken = parseTwoNumberTokens(numericTokens, referenceDate, preferMdy);
		if (twoToken) return twoToken;

		const compact = parseCompactNumeric(normalized);
		if (compact) return compact;

		if (numericTokens.length === 1) {
			const single = parseSingleToken(numericTokens[0], referenceDate);
			if (single) return single;
		}

		return FAILURE_RESULT;
	}

	const api = { parsePartialDate };
	if (typeof module !== "undefined" && module.exports) {
		module.exports = api;
	}
	global.partialDateParser = api;
})(typeof window !== "undefined" ? window : globalThis);
