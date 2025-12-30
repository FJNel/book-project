# Partial Date Parsing

Date parsing lives in the frontend/Node layer at `web/assets/js/partial-date-parser.js` and is exported as both `module.exports.parsePartialDate` and `window.partialDateParser.parsePartialDate` for browser use.

## Quick Usage

```js
const { parsePartialDate } = require("./web/assets/js/partial-date-parser");
// or window.partialDateParser.parsePartialDate in the browser

parsePartialDate("23 November 2005");
// => { day: 23, month: 11, year: 2005, text: "23 November 2005" }
```

Options: `parsePartialDate(input, { referenceDate, preferMdy })`

- `referenceDate` (Date | date-like string) defaults to **today** (local timezone). All partial and relative resolution is anchored to this date.
- `preferMdy` (boolean) defaults to **false**; when `true` only affects ambiguous numeric day/month ordering.

## Output Contract

Returns a single object with `day`, `month`, `year`, and canonical `text`:

- `day`: 1–31 or `null`
- `month`: 1–12 or `null`
- `year`: 4-digit year or `null`
- `text`: normalized English display string (`""` when unparseable)

On failure/unparseable input: `{ day: null, month: null, year: null, text: "" }`.

## How the parser works (high level)

1. **Normalize the text** by removing weekday prefixes, stripping ordinal suffixes, expanding hyphenated number words, and turning punctuation (`-`, `/`, `.`, commas) into whitespace so tokens are predictable.
2. **Convert number words to digits** (including Afrikaans) and eagerly resolve obvious month tokens.
3. **Try relative-only patterns** (e.g., `tomorrow`, `two months ago`, `two days and three months from now`). Multi-unit expressions are applied in the written order so month clamping behaves naturally.
4. **Handle hybrid absolute + relative-year phrases** (e.g., `31 January next year`, `15 March in two years`). If the base date is impossible in the current year, it is retried against the shifted year so leap days are validated correctly.
5. **Parse absolute and partial dates** using month tokens, numeric formats, compact digits, or single-token shortcuts. Missing year/month/day values are resolved relative to the provided reference date as described below.

## Preprocessing & Tolerance

- Case-insensitive; collapses repeated whitespace.
- Strips ordinal suffixes (`st/nd/rd/th/de/ste`).
- Removes weekday prefixes (English + Afrikaans) when present.
- Treats hyphens inside words as separators for spelled numbers/years (`twenty-one`, `twintig-twintig-vyf`).
- Treats `-`, `/`, `.`, and commas as token separators between alphanumerics (e.g., `23-2005-Nov` → `23 2005 Nov`).
- Removes connectors English `of` **and** Afrikaans `van`.
- Ignores trailing punctuation such as `.`, `;`, `:`, or stray commas after normalization.
- Diacritics are removed for matching (e.g., `môre` → `more`).

## Supported Months

- English full + abbreviations (`Jan`, `Jan.`, … `Dec`, `Dec.`)
- Afrikaans full + common abbreviations (e.g., `Januarie`, `Februarie`, `Maart/Mrt`, `Mei`, `Junie`, `Julie`, `Augustus`, `September/Sept/Sept.`, `Oktober/Okt/Okt.`, `November`, `Desember/Des/Des.`)

## Spelled Numbers

- English and Afrikaans cardinals + ordinals for days 1–31 (`first`, `twenty-second`, `fifth`, `eerste`, `vyfde`, etc.).
- Ordinal suffix forms (`5th`, `23rd`, `5de`, `1ste`, …) are normalized to digits.
- Year words support standard composition plus the `twenty twenty <N>` / `twintig twintig <N>` rule → `2000 + <N>` (e.g., `twenty twenty five` → 2025).

## Relative Expressions

Day-anchored (full dates):

- English: `today`, `now`, `yesterday`, `day before yesterday`, `tomorrow`, `day after tomorrow`, `today one year ago`, `yesterday one year ago`, `today one month ago`, `in one year from today`, `tomorrow in a year`, `in one month from today`, and numeric variants.
- Afrikaans: `vandag`, `nou`, `gister`, `eergister`, `môre/more`, `oormore`, `vandag een jaar gelede/terug`, `gister een jaar gelede/terug`, `more oor 'n jaar`, `oor een jaar van vandag`, etc.
- Supports anchored month/year shifts from **today**, **tomorrow**, or **now** (`van môre` / `from tomorrow`) with `in/oor X month(s)/year(s)` phrasing.
- Also handles direct `X day(s)/month(s)/year(s) from today/tomorrow/now` and Afrikaans `X dag(e)/maand(e)/jaar van vandag/môre/nou af` phrasing (numeric or spelled).

Year-only (month/day `null` unless anchored):

- `this/current year`, `last/previous year`, `next year`, `X years ago/gelede/terug`, `in/oor X years`, `X year` (interpreted as past).

- Day/month anchors can combine with relative year offsets such as `31 January next year`, `31 January in two years`, or `31 January 2 years ago`; impossible dates (e.g., 29 February) are re-evaluated in the shifted year.

- Multi-unit offsets are supported in English and Afrikaans (`two days and three months from now`, `drie maande en twee dae gelede`) with optional anchors `from now/today/tomorrow` or `van nou/vandag/môre af`.

Month + year (day `null` unless anchored):

- `this/current month`, `last/previous month`, `next month`, `X months ago/gelede/terug`, `in/oor X months`, `X month` (interpreted as past).
- `next <month name>` / `volgende <month name>` resolve to the next occurrence of that month (month + year).

Relative shifts clamp days when moving to shorter months (e.g., Feb 29 → Feb 28 in non-leap years).

## Absolute & Partial Date Resolution

- Full dates with month names (English/Afrikaans, including obvious prefixes), numeric day/year, or spelled-out day/year; optional weekday prefixes are ignored.
- Numeric three-part forms (`a/b/c`, `a-b-c`, `a b c`):
  - If a 4-digit year is present, it is used as the year.
  - Remaining two parts prefer **DD/MM**; fallback to **MM/DD** if needed.
  - 2-digit years use the pivot rule below.
- Numeric two-part forms (`a/b`, `a-b`, `a b`):
  - Prefer **DD/MM**; if the second part cannot be a month (>12) then treat as **MM/DD**.
  - If one part is 4 digits and the other 1–12, treat as **Month + Year** (day = `null`).
- Inputs containing more than one month token are rejected to avoid ambiguous parses.
- When month names are present, a 2-digit year is only considered if there are at least two numeric tokens; otherwise day+month resolves the year from the reference date.
- Compact 8-digit forms:
  - Prefer `YYYYMMDD` when the leading 4 digits are in 1900–2099.
  - Otherwise try `DDMMYYYY`, then `MMDDYYYY`.
- Day + month without year: choose the most recent occurrence on or before `referenceDate` (fall back to the previous year if the day/month would land in the future).
- Month only: day = `null`; choose the most recent occurrence on or before `referenceDate` (use the previous year if the month is still upcoming).
- Month + year (any order): day = `null`; use provided month/year.
- Day only: anchor to the current month; if that day is after `referenceDate`, move to the previous month (clamp if needed).
- Year only (digits or spelled-out year): month/day `null`.
- Invalid calendar dates fail parsing (e.g., 31 February).

## Disambiguation Rules

- Ambiguous numeric day/month always prefers **DD/MM** unless `preferMdy` is explicitly `true`.
- Pivot for 2-digit years uses `referenceDate.year % 100`:
  - `00..pivot` → `2000..(2000+pivot)`
  - `(pivot+1)..99` → `1900+(yy)`

- The `preferMdy` option flips the default ambiguity handling for numeric dates (e.g., `07/08/05` → `8 July 2005`).

## Canonical Text

- Full date: `D Month YYYY`
- Month + year: `Month YYYY`
- Year only: `YYYY`

Compact numeric parsing only triggers on continuous 8-digit inputs (no embedded separators after normalization).

Empty string when the parser cannot resolve a valid interpretation.

## Worked examples

- **`"15 March in two years"` (reference: 15 Dec 2025)**
  1. Normalize → tokens: `15`, `March`, `in`, `2`, `years`.
  2. Absolute day/month `15 March` resolves to 15 March 2025 (most recent occurrence).
  3. Relative-year offset `in 2 years` shifts the resolved year to 2027.
  4. Result: `{ day: 15, month: 3, year: 2027, text: "15 March 2027" }`.

- **`"Two months and five days from tomorrow"` (reference: 15 Dec 2025)**
  1. Normalize and replace number words → `2 months and 5 days from tomorrow`.
  2. Detect future anchor `from tomorrow` → base = 16 Dec 2025, direction = forward.
  3. Apply units in order: +2 months → 16 Feb 2026; +5 days → 21 Feb 2026.
  4. Result: `{ day: 21, month: 2, year: 2026, text: "21 February 2026" }`.

- **`"11/10/05"` with `preferMdy: true` (reference: 15 Dec 2025)**
  1. Normalize separators → tokens `11`, `10`, `05`.
  2. Ambiguous numeric format resolves as **MM/DD/YY** because `preferMdy` is set.
  3. Expand two-digit year using pivot (25) → `2005`.
  4. Result: `{ day: 10, month: 11, year: 2005, text: "10 November 2005" }`.

- **`"23 November"` (reference: 15 Dec 2025)**
  1. Parse absolute day/month without a year.
  2. Resolve missing year to the most recent occurrence not after the reference date → 23 Nov 2025.
  3. Result: `{ day: 23, month: 11, year: 2025, text: "23 November 2025" }`.

- **`"31 February 2020"`**
  1. Parse absolute full date.
  2. Detect invalid calendar date (Feb 31 does not exist).
  3. Result: `{ day: null, month: null, year: null, text: "" }`.
