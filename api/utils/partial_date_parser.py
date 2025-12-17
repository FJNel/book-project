"""Partial date parser with CLI and tests.

This module parses partial or fuzzy date strings in English and Afrikaans without
third-party parsing libraries. It supports:
- Relative phrases (today, yesterday, gister, eergister, tomorrow, more, oormore, etc.).
- Month names/abbreviations (English and Afrikaans) with optional days/years.
- Numeric forms with slashes/dashes/concatenated digits, handling ambiguous DMY/MDY.
- Partial dates (year-only, month+year, day+month).

All parsing paths funnel into `parse_partial_date`, which returns a tuple of
`(result_dict, canonical_text)`. The canonical text is a human-friendly rendering
of the parsed components. When nothing can be parsed, it returns empty components
and an empty text string.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, Optional, Tuple

# When not provided, today's date defaults to date.today()
DEFAULT_TODAY: Optional[date] = None

# Month mapping includes English and Afrikaans forms
MONTH_ALIASES = {
    # English full
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    # English abbreviations
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "mrt": 3,  # Afrikaans abbreviation overlaps
    "apr": 4,
    "may": 5,
    "mei": 5,  # Afrikaans full and abbreviation
    "jun": 6,
    "junie": 6,
    "jul": 7,
    "july": 7,
    "julie": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "okt": 10,
    "oktober": 10,
    "oct": 10,
    "nov": 11,
    "dec": 12,
    "des": 12,
    # Afrikaans full names
    "januarie": 1,
    "februarie": 2,
    "maart": 3,
    "mei": 5,
    "augustus": 8,
    "desember": 12,
}

ENGLISH_MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


@dataclass
class ParseResult:
    day: Optional[int]
    month: Optional[int]
    year: Optional[int]
    text: str

    def as_dict(self) -> Dict[str, Optional[int]]:
        """Return only the numeric components (text is returned separately)."""
        return {"day": self.day, "month": self.month, "year": self.year}


ORDINAL_SUFFIX_RE = re.compile(r"(\d+)(st|nd|rd|th|de|ste)", re.IGNORECASE)
MULTISPACE_RE = re.compile(r"\s+")


def strip_ordinals(value: str) -> str:
    """Remove ordinal suffixes to simplify numeric parsing."""
    return ORDINAL_SUFFIX_RE.sub(r"\1", value)


def collapse_spaces(value: str) -> str:
    """Collapse multiple spaces and trim."""
    return MULTISPACE_RE.sub(" ", value.strip())


def normalize_input(s: str) -> str:
    """Normalize punctuation, ordinals, and whitespace before tokenizing."""
    s = s.replace(",", " ")
    s = re.sub(r"\bof\b", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"(?<=\D)-(?=\D)", " ", s)
    s = strip_ordinals(s)
    s = collapse_spaces(s)
    return s


NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
    # Afrikaans cardinals
    "een": 1,
    "twee": 2,
    "drie": 3,
    "vier": 4,
    "vyf": 5,
    "ses": 6,
    "sewe": 7,
    "agt": 8,
    "nege": 9,
    "tien": 10,
    "elf": 11,
    "twaalf": 12,
    "dertien": 13,
    "veertien": 14,
    "vyftien": 15,
    "sestien": 16,
    "sewentien": 17,
    "agtien": 18,
    "negentien": 19,
    "twintig": 20,
    "dertig": 30,
    "veertig": 40,
    "vyftig": 50,
    "sestig": 60,
    "sewentig": 70,
    "tagtig": 80,
    "negentig": 90,
}

ORDINAL_WORDS = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
    "sixth": 6,
    "seventh": 7,
    "eighth": 8,
    "ninth": 9,
    "tenth": 10,
    "eleventh": 11,
    "twelfth": 12,
    "thirteenth": 13,
    "fourteenth": 14,
    "fifteenth": 15,
    "sixteenth": 16,
    "seventeenth": 17,
    "eighteenth": 18,
    "nineteenth": 19,
    "twentieth": 20,
    "twenty-first": 21,
    "twenty-second": 22,
    "twenty-third": 23,
    "twenty-fourth": 24,
    "twenty-fifth": 25,
    "twenty-sixth": 26,
    "twenty-seventh": 27,
    "twenty-eighth": 28,
    "twenty-ninth": 29,
    "thirtieth": 30,
    "thirty-first": 31,
    # Afrikaans ordinals (common forms)
    "eerste": 1,
    "tweede": 2,
    "derde": 3,
    "vierde": 4,
    "vyfde": 5,
    "sesde": 6,
    "sewende": 7,
    "agtste": 8,
    "negende": 9,
    "tiende": 10,
    "elfde": 11,
    "twaalfde": 12,
    "dertiende": 13,
    "veertiende": 14,
    "vyftiende": 15,
    "sestiende": 16,
    "sewentiende": 17,
    "agtiende": 18,
    "negentiende": 19,
    "twintigste": 20,
    "een-en-twintigste": 21,
    "twee-en-twintigste": 22,
    "drie-en-twintigste": 23,
    "vier-en-twintigste": 24,
    "vyf-en-twintigste": 25,
    "ses-en-twintigste": 26,
    "sewe-en-twintigste": 27,
    "agt-en-twintigste": 28,
    "nege-en-twintigste": 29,
    "dertigste": 30,
    "een-en-dertigste": 31,
}


def parse_number_word_sequence(words: list[str]) -> Optional[int]:
    """Parse sequences like 'twenty two', 'negentien nege en negentig', or 'two hundred' into integers."""

    lower = [w.lower() for w in words]
    connectors = {"and", "en"}
    hundred_words = {"hundred", "honderd"}
    thousand_words = {"thousand", "duisend"}

    allowed = NUMBER_WORDS.keys() | ORDINAL_WORDS.keys() | connectors | hundred_words | thousand_words
    if not all(w in allowed for w in lower):
        return None

    total = 0
    current = 0
    numeric_components: list[int] = []

    for word in lower:
        if word in connectors:
            continue
        if word in hundred_words:
            current = 1 if current == 0 else current
            current *= 100
            continue
        if word in thousand_words:
            current = 1 if current == 0 else current
            total += current * 1000
            current = 0
            continue
        if word in NUMBER_WORDS:
            current += NUMBER_WORDS[word]
            numeric_components.append(NUMBER_WORDS[word])
            continue
        if word in ORDINAL_WORDS:
            current += ORDINAL_WORDS[word]
            numeric_components.append(ORDINAL_WORDS[word])
            continue
    total += current

    # Year-like heuristic (e.g., nineteen ninety nine -> 1999, twenty nineteen -> 2019)
    if total <= 200 and len(numeric_components) >= 2:
        rest_total = sum(numeric_components[1:])
        if (numeric_components[0] >= 19 and (numeric_components[1] >= 10 or len(numeric_components) >= 3)) or rest_total >= 20:
            year_guess = numeric_components[0] * 100 + rest_total
            if year_guess >= 100:
                return year_guess

    return total if total > 0 else None


def replace_number_words(tokens: list[str]) -> list[str]:
    """Convert spelled-out number/ordinal sequences into digits when possible."""
    result: list[str] = []
    i = 0
    while i < len(tokens):
        if tokens[i].lower() in NUMBER_WORDS or tokens[i].lower() in ORDINAL_WORDS:
            j = i
            phrase: list[str] = []
            while j < len(tokens) and (
                tokens[j].lower() in NUMBER_WORDS
                or tokens[j].lower() in ORDINAL_WORDS
                or tokens[j].lower() in {"hundred", "thousand", "and"}
            ):
                phrase.append(tokens[j])
                j += 1
            value = parse_number_word_sequence(phrase)
            if value is not None:
                result.append(str(value))
                i = j
                continue
        cleaned = ORDINAL_SUFFIX_RE.sub(r"\1", tokens[i])
        result.append(cleaned)
        i += 1
    return result


def month_from_token(token: str) -> Optional[int]:
    """Return month number if the token matches a known month name/abbreviation."""
    key = token.lower().rstrip(".")
    return MONTH_ALIASES.get(key)


def pivot_year(two_digit: int) -> int:
    """Expand two-digit years to a reasonable four-digit year (<=68 → 2000s, else 1900s)."""
    if two_digit <= 68:
        return 2000 + two_digit
    return 1900 + two_digit


def is_valid_date(y: int, m: int, d: int) -> bool:
    """Return True if the provided day/month/year is a real calendar date."""
    try:
        date(y, m, d)
        return True
    except ValueError:
        return False


def format_canonical(day: Optional[int], month: Optional[int], year: Optional[int]) -> str:
    """Render a human-friendly canonical string for the parsed components."""
    if day and month and year:
        return f"{day} {ENGLISH_MONTH_NAMES[month - 1]} {year}"
    if month and year:
        return f"{ENGLISH_MONTH_NAMES[month - 1]} {year}"
    if year and not month and not day:
        return f"{year}"
    if day and month and not year:
        return f"{day} {ENGLISH_MONTH_NAMES[month - 1]}"
    if month and not day and not year:
        return ENGLISH_MONTH_NAMES[month - 1]
    if day and not month and not year:
        return str(day)
    return ""


def last_day_of_month(year: int, month: int) -> int:
    """Return the last valid day number for the given month/year."""
    if month == 12:
        return 31
    first_next = date(year, month + 1, 1)
    return (first_next - timedelta(days=1)).day


def shift_months(dt: date, months: int) -> date:
    """Shift a date by N months while keeping the day in-range for the target month."""
    total_months = dt.year * 12 + (dt.month - 1) + months
    new_year = total_months // 12
    new_month = total_months % 12 + 1
    new_day = min(dt.day, last_day_of_month(new_year, new_month))
    return date(new_year, new_month, new_day)


def shift_years_safe(dt: date, years: int) -> date:
    """Shift a date by N years, clamping the day to the end of month when needed (e.g., Feb 29)."""
    target_year = dt.year + years
    new_day = min(dt.day, last_day_of_month(target_year, dt.month))
    return date(target_year, dt.month, new_day)


def parse_relative(text: str, today: date) -> Optional[ParseResult]:
    """Handle relative phrases anchored to `today` (English and Afrikaans)."""
    lowered = text.lower()
    number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "a": 1}
    if lowered in {"today", "now", "vandag", "nou"}:
        d = today
        return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
    if lowered in {"yesterday", "gister"}:
        d = today - timedelta(days=1)
        return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
    if lowered in {"day before yesterday", "eergister"}:
        d = today - timedelta(days=2)
        return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
    if lowered in {"tomorrow", "more"}:
        d = today + timedelta(days=1)
        return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
    if lowered in {"day after tomorrow", "oormore"}:
        d = today + timedelta(days=2)
        return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))

    today_year_plain = re.fullmatch(r"today (?:(one|two|three|\d+) )year(?:s)?", lowered)
    if today_year_plain:
        token = today_year_plain.group(1)
        count = number_words[token] if token in number_words else int(token)
        target = shift_years_safe(today, -count)
        return ParseResult(target.day, target.month, target.year, format_canonical(target.day, target.month, target.year))

    today_month_plain = re.fullmatch(r"today (?:(one|two|three|\d+) )month(?:s)?", lowered)
    if today_month_plain:
        token = today_month_plain.group(1)
        count = number_words[token] if token in number_words else int(token)
        target = shift_months(today, -count)
        return ParseResult(target.day, target.month, target.year, format_canonical(target.day, target.month, target.year))

    # year-relative phrases
    if lowered in {"this year", "current year"}:
        return ParseResult(None, None, today.year, format_canonical(None, None, today.year))
    if lowered in {"last year", "previous year"}:
        year = today.year - 1
        return ParseResult(None, None, year, format_canonical(None, None, year))
    if lowered in {"next year"}:
        year = today.year + 1
        return ParseResult(None, None, year, format_canonical(None, None, year))
    if lowered in {"one year", "a year", "two years", "two year"}:
        count = 1 if lowered.startswith("one") or lowered.startswith("a") else 2
        target_year = today.year - count
        return ParseResult(None, None, target_year, format_canonical(None, None, target_year))
    year_ago_match = re.fullmatch(r"(today )?(?:(one|two|three|a|\d+) )year(?:s)? ago", lowered)
    if year_ago_match:
        number = year_ago_match.group(2)
        if number in {"one", "a"}:
            count = 1
        else:
            count = number_words[number] if number in number_words else int(number)
        target = shift_years_safe(today, -count)
        if year_ago_match.group(1):
            return ParseResult(target.day, target.month, target.year, format_canonical(target.day, target.month, target.year))
        return ParseResult(None, None, target.year, format_canonical(None, None, target.year))
    in_year_match = re.fullmatch(r"in (?:(one|two|three|\d+) )year(?:s)?(?: from today)?", lowered)
    if in_year_match:
        token = in_year_match.group(1)
        count = number_words[token] if token in number_words else int(token)
        d = shift_years_safe(today, count)
        if lowered.endswith("from today"):
            return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
        return ParseResult(None, None, d.year, format_canonical(None, None, d.year))

    # month-relative phrases
    if lowered in {"this month", "current month"}:
        return ParseResult(None, today.month, today.year, format_canonical(None, today.month, today.year))
    if lowered in {"last month", "previous month"}:
        d = shift_months(today, -1)
        return ParseResult(None, d.month, d.year, format_canonical(None, d.month, d.year))
    if lowered == "next month":
        d = shift_months(today, 1)
        return ParseResult(None, d.month, d.year, format_canonical(None, d.month, d.year))

    if lowered in {"one month", "a month", "two months", "two month"}:
        token = lowered.split()[0]
        count = 1 if token in {"one", "a"} else 2
        d = shift_months(today, -count)
        return ParseResult(None, d.month, d.year, format_canonical(None, d.month, d.year))

    month_ago_match = re.fullmatch(r"(today )?(?:(one|two|three|a|\d+) )month(?:s)? ago", lowered)
    if month_ago_match:
        token = month_ago_match.group(2)
        count = number_words[token] if token in number_words else int(token)
        d = shift_months(today, -count)
        if month_ago_match.group(1):
            return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
        return ParseResult(None, d.month, d.year, format_canonical(None, d.month, d.year))

    in_month_match = re.fullmatch(r"in (?:(one|two|three|\d+) )month(?:s)?(?: from today)?", lowered)
    if in_month_match:
        token = in_month_match.group(1)
        count = number_words[token] if token in number_words else int(token)
        d = shift_months(today, count)
        if lowered.endswith("from today"):
            return ParseResult(d.day, d.month, d.year, format_canonical(d.day, d.month, d.year))
        return ParseResult(None, d.month, d.year, format_canonical(None, d.month, d.year))

    if lowered.startswith("today "):
        relative_tail = lowered.replace("today ", "", 1)
        relative_result = parse_relative(relative_tail, today)
        if relative_result:
            return ParseResult(relative_result.day, relative_result.month, relative_result.year, relative_result.text)

    return None


def parse_numeric_parts(parts: Tuple[str, str, str], prefer_mdy: bool, today: date) -> Optional[ParseResult]:
    """Parse numeric triplets separated by -, /, or spaces."""
    a, b, c = parts
    if not (a.isdigit() and b.isdigit() and c.isdigit()):
        return None
    nums = list(map(int, parts))
    lens = list(map(len, parts))

    # ISO-like: year first
    if lens[0] == 4:
        year = nums[0]
        m = nums[1]
        d = nums[2]
        if is_valid_date(year, m, d):
            return ParseResult(d, m, year, format_canonical(d, m, year))

    # Heuristic for day-month-year vs month-day-year
    first, second, third = nums
    year = None
    day = None
    month = None
    if lens[2] == 4:
        year = third
        if first > 31 or second > 31:
            return None
        if first > 12:
            day, month = first, second
        elif second > 12:
            month, day = first, second
        else:
            if prefer_mdy:
                month, day = first, second
            else:
                day, month = first, second
        if is_valid_date(year, month, day):
            return ParseResult(day, month, year, format_canonical(day, month, year))

    # Numeric without explicit year: two-part or ambiguous three-part
    if lens[2] <= 2 and lens[0] <= 2 and lens[1] <= 2:
        first, second, third = nums
        if first == 0 or second == 0 or third == 0:
            return None
        # Attempt DD/MM/YY or MM/DD/YY using heuristic
        if first > 12:
            day, month = first, second
        elif second > 12:
            month, day = first, second
        else:
            if prefer_mdy:
                month, day = first, second
            else:
                day, month = first, second
        year = pivot_year(third) if lens[2] == 2 else third
        if is_valid_date(year, month, day):
            return ParseResult(day, month, year, format_canonical(day, month, year))

    return None


def parse_concatenated_digits(s: str, prefer_mdy: bool) -> Optional[ParseResult]:
    """Handle compact numeric forms like 20250115 or 15012025."""
    if not s.isdigit():
        return None
    if len(s) != 8:
        return None
    # Try YYYYMMDD
    y, m, d = int(s[:4]), int(s[4:6]), int(s[6:])
    if is_valid_date(y, m, d):
        return ParseResult(d, m, y, format_canonical(d, m, y))
    # Try DDMMYYYY
    d, m, y = int(s[:2]), int(s[2:4]), int(s[4:])
    if is_valid_date(y, m, d):
        return ParseResult(d, m, y, format_canonical(d, m, y))
    # Try MMDDYYYY
    m, d, y = int(s[:2]), int(s[2:4]), int(s[4:])
    if is_valid_date(y, m, d):
        return ParseResult(d, m, y, format_canonical(d, m, y))
    return None


def parse_with_month_names(tokens: list[str], prefer_mdy: bool, today: date) -> Optional[ParseResult]:
    """Parse sequences that include a recognizable month name/abbreviation."""
    month_idx = None
    for i, token in enumerate(tokens):
        if month_from_token(token):
            month_idx = i
            break
    if month_idx is None:
        return None
    month = month_from_token(tokens[month_idx])
    assert month is not None
    others = [t for i, t in enumerate(tokens) if i != month_idx]
    numbers = [t for t in others if t.lstrip("-").isdigit()]
    day = None
    year = None
    if len(numbers) == 2:
        first, second = numbers
        first_num, second_num = int(first), int(second)
        if len(second) >= 3:
            year = int(second) if len(second) == 4 else None
            day = first_num
        elif len(first) >= 3:
            year = int(first) if len(first) == 4 else None
            day = second_num
        else:
            # Decide which is year/day based on plausibility
            if first_num > 31 and len(first) >= 3:
                year = first_num
                day = second_num
            elif second_num > 31 and len(second) >= 3:
                year = second_num
                day = first_num
            else:
                day = first_num
                year = None if len(second) <= 2 else int(second)
        if year is None and len(second) == 2:
            year = pivot_year(second_num)
    elif len(numbers) == 1:
        num = numbers[0]
        if len(num) >= 3:
            year = int(num) if len(num) == 4 else None
        else:
            day = int(num)
    if year is None:
        year = today.year
    if day is not None:
        if not is_valid_date(year, month, day):
            return None
    text = format_canonical(day, month, year)
    return ParseResult(day, month, year, text)


def parse_two_numbers(tokens: list[str], prefer_mdy: bool, today: date) -> Optional[ParseResult]:
    """Parse inputs with exactly two numeric tokens, inferring the missing year."""
    if len(tokens) != 2:
        return None
    a, b = tokens
    if not (a.isdigit() and b.isdigit()):
        return None
    first, second = int(a), int(b)
    if first == 0 or second == 0:
        return None
    if first > 12:
        day, month = first, second
    elif second > 12:
        month, day = first, second
    else:
        if prefer_mdy:
            month, day = first, second
        else:
            day, month = first, second
    year = today.year
    if not is_valid_date(year, month, day):
        return None
    return ParseResult(day, month, year, format_canonical(day, month, year))


def parse_two_part_with_separators(s: str, prefer_mdy: bool, today: date) -> Optional[ParseResult]:
    """Parse two-part numeric expressions with separators (e.g., 12/05 or 05-2019)."""
    two_part = re.fullmatch(r"(\d{1,4})[-./](\d{1,4})", s)
    if not two_part:
        return None
    first, second = two_part.groups()
    if len(first) == 4 and first.isdigit() and second.isdigit():
        year = int(first)
        if len(second) <= 2:
            month = int(second)
            if 1 <= month <= 12:
                return ParseResult(None, month, year, format_canonical(None, month, year))
    if len(second) == 4 and first.isdigit() and second.isdigit():
        year = int(second)
        month = int(first)
        if 1 <= month <= 12:
            return ParseResult(None, month, year, format_canonical(None, month, year))
    # day-month without year
    if len(first) <= 2 and len(second) <= 2 and first.isdigit() and second.isdigit():
        return parse_two_numbers([first, second], prefer_mdy, today)
    return None


def parse_single_token(token: str, today: date) -> Optional[ParseResult]:
    """Parse a lone token (month name, year, or day/month fallback)."""
    month = month_from_token(token)
    if month:
        return ParseResult(None, month, today.year, format_canonical(None, month, today.year))
    if token.isdigit():
        num = int(token)
        if len(token) == 4 and 1 <= num <= 9999:
            return ParseResult(None, None, num, format_canonical(None, None, num))
        if 1 <= num <= 12:
            return ParseResult(None, num, today.year, format_canonical(None, num, today.year))
        if 13 <= num <= 31:
            day = num
            month = today.month
            year = today.year
            if is_valid_date(year, month, day):
                return ParseResult(day, month, year, format_canonical(day, month, year))
    return None


def parse_partial_date(s: str, today: Optional[date] = DEFAULT_TODAY, prefer_mdy: bool = False) -> Tuple[Dict[str, Optional[int]], str]:
    """Main entry point: parse a free-form date string into components.

    - today: reference date; defaults to date.today() when not provided.
    - prefer_mdy: choose MM/DD interpretation when day/month order is ambiguous.
    """
    raw = s
    if raw is None:
        raise ValueError("Input string cannot be None")
    normalized = normalize_input(raw)
    if today is None:
        today = date.today()
    if not normalized:
        return {"day": None, "month": None, "year": None}, ""

    relative = parse_relative(normalized.lower(), today)
    if relative:
        return relative.as_dict(), relative.text

    tokens = [t for t in replace_number_words(re.split(r"[-./\s]+", normalized)) if t]

    # With month names
    result = parse_with_month_names(tokens, prefer_mdy, today)
    if result:
        return result.as_dict(), result.text

    # Numeric separators
    sep_match = re.match(r"^(\d{1,4})[-./\s](\d{1,2})[-./\s](\d{1,4})$", normalized)
    if sep_match:
        parts = sep_match.groups()
        result = parse_numeric_parts(parts, prefer_mdy, today)
        if result:
            return result.as_dict(), result.text

    sep_two_part = parse_two_part_with_separators(normalized, prefer_mdy, today)
    if sep_two_part:
        return sep_two_part.as_dict(), sep_two_part.text

    if len(tokens) == 2:
        result = parse_two_numbers(tokens, prefer_mdy, today)
        if result:
            return result.as_dict(), result.text

    if len(tokens) == 1:
        token = tokens[0]
        result = parse_concatenated_digits(token, prefer_mdy)
        if result:
            return result.as_dict(), result.text
        result = parse_single_token(token, today)
        if result:
            return result.as_dict(), result.text

    return {"day": None, "month": None, "year": None}, ""


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Parse partial dates")
    parser.add_argument("input", help="Date string to parse")
    parser.add_argument("--mdy", action="store_true", help="Prefer MM/DD when ambiguous")
    parser.add_argument("--today", help="Reference date in YYYY-MM-DD to treat as today", default=None)
    args = parser.parse_args()

    ref_today = None
    if args.today:
        try:
            ref_today = datetime.strptime(args.today, "%Y-%m-%d").date()
        except ValueError:
            raise SystemExit("Invalid --today date; expected YYYY-MM-DD")

    parsed, text = parse_partial_date(args.input, today=ref_today, prefer_mdy=args.mdy)
    if not any([parsed.get("day"), parsed.get("month"), parsed.get("year")]) and not text:
        raise SystemExit("Could not parse date")
    print(json.dumps(parsed))
    print(text)
