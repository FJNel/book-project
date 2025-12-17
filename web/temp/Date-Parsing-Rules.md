# Partial Date Parsing (Frontend)

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

## Preprocessing & Tolerance

- Case-insensitive; collapses repeated whitespace.
- Strips ordinal suffixes (`st/nd/rd/th/de/ste`) and connectors `of/van`.
- Removes weekday prefixes (English + Afrikaans) when present.
- Treats hyphens inside words as separators for spelled numbers/years (`twenty-one`, `twintig-twintig-vyf`).
- Accepts commas and periods as optional punctuation; numeric separators can be `-`, `/`, `.`, or spaces.
- Ignores trailing punctuation such as `.`, `;`, `:`, or stray commas after normalization.
- Diacritics are removed for matching (e.g., `môre` → `more`).

## Supported Months

- English full + abbreviations (`Jan`, `Jan.`, … `Dec`, `Dec.`)
- Afrikaans full + common abbreviations (`Januarie`, `Februarie`, `Maart/Mrt`, `Mei`, `Junie`, `Julie`, `Augustus`, `September/Sept`, `Oktober/Okt`, `November`, `Desember/Des`)

## Spelled Numbers

- English and Afrikaans cardinals + ordinals for days 1–31 (`first`, `twenty-second`, `fifth`, `eerste`, `vyfde`, etc.).
- Ordinal suffix forms (`5th`, `23rd`, `5de`, `1ste`, …) are normalized to digits.
- Year words support standard composition plus the `twenty twenty <N>` / `twintig twintig <N>` rule → `2000 + <N>` (e.g., `twenty twenty five` → 2025).

## Relative Expressions

Day-anchored (full dates):

- English: `today`, `now`, `yesterday`, `day before yesterday`, `tomorrow`, `day after tomorrow`, `today one year ago`, `yesterday one year ago`, `today one month ago`, `in one year from today`, `tomorrow in a year`, `in one month from today`, and numeric variants.
- Afrikaans: `vandag`, `nou`, `gister`, `eergister`, `môre/more`, `oormore`, `vandag een jaar gelede/terug`, `gister een jaar gelede/terug`, `more oor 'n jaar`, `oor een jaar van vandag`, etc.

Year-only (month/day `null` unless anchored):

- `this/current year`, `last/previous year`, `next year`, `X years ago/gelede/terug`, `in/oor X years`, `X year` (interpreted as past).

Month + year (day `null` unless anchored):

- `this/current month`, `last/previous month`, `next month`, `X months ago/gelede/terug`, `in/oor X months`, `X month` (interpreted as past).

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

## Canonical Text

- Full date: `D Month YYYY`
- Month + year: `Month YYYY`
- Year only: `YYYY`

Empty string when the parser cannot resolve a valid interpretation.
