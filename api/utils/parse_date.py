import sys
import json
import re
from datetime import datetime, timedelta

import dateparser
from dateutil.relativedelta import relativedelta


MONTH_WORDS = {
    "jan",
    "january",
    "januarie",
    "feb",
    "february",
    "februarie",
    "mar",
    "march",
    "maart",
    "apr",
    "april",
    "may",
    "mei",  # Afrikaans
    "jun",
    "june",
    "junie",
    "jul",
    "july",
    "julie",
    "aug",
    "august",
    "sep",
    "sept",
    "september",
    "oktober",
    "oct",
    "october",
    "nov",
    "november",
    "dec",
    "december",
    "desember",
}

YEAR_WORDS = {"year", "years", "jaar", "jare"}
MONTH_KEYWORDS = {"month", "months", "maand", "maande"}
DAY_KEYWORDS = {"day", "days", "dag", "dae"}
RELATIVE_DAY_WORDS = {"today", "vandag", "yesterday", "gister", "eergister", "day before yesterday"}

EN_ONES = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
    11: "eleven",
    12: "twelve",
    13: "thirteen",
    14: "fourteen",
    15: "fifteen",
    16: "sixteen",
    17: "seventeen",
    18: "eighteen",
    19: "nineteen",
}
EN_ONES_ORD = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth",
    6: "sixth",
    7: "seventh",
    8: "eighth",
    9: "ninth",
    10: "tenth",
    11: "eleventh",
    12: "twelfth",
    13: "thirteenth",
    14: "fourteenth",
    15: "fifteenth",
    16: "sixteenth",
    17: "seventeenth",
    18: "eighteenth",
    19: "nineteenth",
}
EN_TENS = {20: "twenty", 30: "thirty"}
EN_TENS_ORD = {20: "twentieth", 30: "thirtieth"}

AF_ONES = {
    1: "een",
    2: "twee",
    3: "drie",
    4: "vier",
    5: "vyf",
    6: "ses",
    7: "sewe",
    8: "agt",
    9: "nege",
    10: "tien",
    11: "elf",
    12: "twaalf",
    13: "dertien",
    14: "veertien",
    15: "vyftien",
    16: "sestien",
    17: "sewentien",
    18: "agtien",
    19: "negentien",
}
AF_TENS = {20: "twintig", 30: "dertig"}


def _english_phrase(n: int) -> str:
    if n < 20:
        return EN_ONES[n]
    tens = (n // 10) * 10
    ones = n % 10
    base = EN_TENS[tens]
    return base if ones == 0 else f"{base} {EN_ONES[ones]}"


def _english_ordinal_phrase(n: int) -> str:
    if n < 20:
        return EN_ONES_ORD[n]
    tens = (n // 10) * 10
    ones = n % 10
    if ones == 0:
        return EN_TENS_ORD[tens]
    return f"{EN_TENS[tens]} {EN_ONES_ORD[ones]}"


def _afrikaans_phrase(n: int) -> str:
    if n < 20:
        return AF_ONES[n]
    tens = (n // 10) * 10
    ones = n % 10
    if ones == 0:
        return AF_TENS[tens]
    return f"{AF_ONES[ones]} en {AF_TENS[tens]}"


def build_spelled_number_map() -> dict[str, int]:
    mapping: dict[str, int] = {}
    for n in range(1, 32):
        en_cardinal = _english_phrase(n)
        en_ordinal = _english_ordinal_phrase(n)
        af_cardinal = _afrikaans_phrase(n)

        for phrase in (en_cardinal, en_ordinal):
            mapping[phrase] = n
            mapping[phrase.replace(" ", "-")] = n

        mapping[af_cardinal] = n
        if " en " in af_cardinal:
            mapping[af_cardinal.replace(" en ", "-en-")] = n

        for suffix in ("ste", "de"):
            mapping[f"{af_cardinal}{suffix}"] = n
            if " en " in af_cardinal:
                mapping[f"{af_cardinal.replace(' en ', '-en-')}{suffix}"] = n

    return mapping


SPELLED_NUMBER_MAP = build_spelled_number_map()


def strip_ordinal_suffixes(text: str) -> str:
    """Remove English/Afrikaans ordinal suffixes to help parsing."""

    return re.sub(
        r"\b([12]?\d|3[01])(st|nd|rd|th|ste|de)\b", r"\1", text, flags=re.IGNORECASE
    )


def parse_numeric_date(text: str, current_year: int) -> tuple[datetime | None, str | None]:
    """Handle numeric-only dates before falling back to dateparser."""

    normalized = re.sub(r"[./]", "-", text.strip())

    # YYYY-MM or YYYY-MM-DD forms.
    ymd_match = re.fullmatch(r"(\d{1,4})-(\d{1,2})-(\d{1,4})", normalized)
    if ymd_match:
        a, b, c = ymd_match.groups()
        attempts: list[str] = []
        if len(a) == 4 and len(c) == 4:
            attempts = ["%Y-%m-%d", "%Y-%d-%m"]
        elif len(a) == 4:
            attempts = ["%Y-%m-%d", "%Y-%d-%m"]
        elif len(c) == 4:
            attempts = ["%d-%m-%Y", "%m-%d-%Y"]
        else:
            # Two-digit year, prefer DMY but allow MDY fallback.
            attempts = ["%d-%m-%y", "%m-%d-%y"]

        for fmt in attempts:
            try:
                return datetime.strptime(normalized, fmt), "DAY"
            except ValueError:
                continue

    # YYYY-MM month precision.
    if re.fullmatch(r"\d{4}-\d{1,2}", normalized):
        try:
            dt = datetime.strptime(normalized + "-01", "%Y-%m-%d")
            return dt, "MONTH"
        except ValueError:
            return None, None

    # DD-MM or MM-DD forms without a year.
    short_match = re.fullmatch(r"(\d{1,2})-(\d{1,2})", normalized)
    if short_match:
        first = int(short_match.group(1))
        second = int(short_match.group(2))

        def try_date(day: int, month: int) -> datetime | None:
            try:
                return datetime(current_year, month, day)
            except ValueError:
                return None

        # Prefer DMY; fallback to MDY if DMY invalid.
        dt = try_date(first, second)
        if dt:
            return dt, "DAY"
        dt = try_date(second, first)
        if dt:
            return dt, "DAY"

    return None, None


def parse_month_of_year(text: str, current_year: int) -> tuple[datetime | None, str | None]:
    """
    Handle phrases like 'the 5th month of 2025' by converting to a month-level date.
    """

    match = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+month(?:\s+of\s+(\d{4}))?\b",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None

    month_num = int(match.group(1))
    year_num = int(match.group(2)) if match.group(2) else current_year
    if 1 <= month_num <= 12:
        return datetime(year_num, month_num, 1), "MONTH"

    return None, None


def normalize_spelled_numbers(text: str) -> str:
    """
    Convert spelled-out English/Afrikaans numbers (cardinals/ordinals up to 31) to digits.
    """

    normalized = text.lower()
    for phrase, number in sorted(
        SPELLED_NUMBER_MAP.items(), key=lambda item: len(item[0]), reverse=True
    ):
        pattern = rf"(?<!\w){re.escape(phrase)}(?!\w)"
        normalized = re.sub(pattern, str(number), normalized)
    return normalized


def normalize_relative_years(text: str, current_year: int) -> str:
    """
    Convert patterns like '3 May 2 years ago' into an absolute year (e.g., '3 May 2023').
    """

    match = re.search(
        r"\b(\d{1,2})\s+([a-z]+)\s+(\d+)\s+years?\s+ago\b", text, flags=re.IGNORECASE
    )
    if not match:
        return text

    day = match.group(1)
    month_word = match.group(2)
    years_back = int(match.group(3))
    target_year = current_year - years_back
    replacement = f"{day} {month_word} {target_year}"

    return (
        text[: match.start()] + replacement + text[match.end() :]
        if match
        else text
    )


def normalize_relative_keywords(text: str, current_year: int) -> str:
    """Handle 'last year' to a concrete year."""

    text = re.sub(
        r"\blast year\b", f"{current_year - 1}", text, flags=re.IGNORECASE
    )
    return text


def resolve_relative_phrases(text: str, current_date: datetime) -> tuple[str, datetime | None, str | None]:
    """
    Resolve phrases anchored to today/yesterday/day-before-yesterday or month-relative phrases.
    Returns (normalized_text, dt, precision_hint).
    """

    lowered = text.lower()

    # Day-anchored phrases.
    base_date = None
    if "today" in lowered or "vandag" in lowered:
        base_date = current_date
    elif "yesterday" in lowered or "gister" in lowered:
        base_date = current_date - timedelta(days=1)
    elif "day before yesterday" in lowered or "eergister" in lowered:
        base_date = current_date - timedelta(days=2)

    years_back = 0
    months_back = 0

    match_years = re.search(r"(\d+)\s+(?:year|years|jaar)", lowered)
    if match_years:
        years_back = int(match_years.group(1))

    match_months = re.search(r"(\d+)\s+(?:month|months|maand|maande)", lowered)
    if match_months:
        months_back = int(match_months.group(1))

    if base_date:
        target_date = base_date - relativedelta(years=years_back, months=months_back)
        normalized = f"{target_date.day} {target_date.strftime('%B')} {target_date.year}"
        return normalized, target_date, "DAY"

    # Month-anchored phrases.
    base_month = None
    if re.search(r"\b(this|hierdie)\s+(?:month|maand)\b", lowered):
        base_month = current_date
    elif re.search(r"\b(last|laas|vorige)\s+(?:month|maand)\b", lowered):
        base_month = current_date - relativedelta(months=1)

    if base_month:
        target_month = base_month - relativedelta(years=years_back, months=months_back)
        normalized = target_month.strftime("%B %Y")
        # store the first day to keep a concrete date
        return normalized, target_month.replace(day=1), "MONTH"

    return text, None, None


def guess_precision(original: str) -> str:
    """
    Inspect the original input string to guess the precision.
    Returns "YEAR", "MONTH", or "DAY".
    """

    text = original.strip()
    lowered = text.lower()

    if any(re.search(rf"\b{kw}\b", lowered) for kw in RELATIVE_DAY_WORDS):
        return "DAY"

    if re.fullmatch(r"\d{4}", text):
        return "YEAR"

    # Detect relative expressions using the smallest mentioned unit.
    if any(re.search(rf"\b{kw}\b", lowered) for kw in DAY_KEYWORDS):
        return "DAY"
    if any(re.search(rf"\b{kw}\b", lowered) for kw in MONTH_KEYWORDS):
        return "MONTH"
    if any(re.search(rf"\b{kw}\b", lowered) for kw in YEAR_WORDS):
        return "YEAR"

    # Numeric full dates like 23/05/2025 or 2025-05-23.
    full_date_numeric_patterns = [
        r"\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}",
        r"\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}",
    ]
    if any(re.fullmatch(pattern, text) for pattern in full_date_numeric_patterns):
        return "DAY"

    # Ordinal or plain day numbers paired with text months.
    day_number_pattern = r"\b([12]?\d|3[01])(st|nd|rd|th|ste|de)?\b"
    has_day_number = re.search(day_number_pattern, lowered) is not None
    has_month_word = any(re.search(rf"\b{month}\b", lowered) for month in MONTH_WORDS)

    if has_month_word:
        return "DAY" if has_day_number else "MONTH"

    # Month-year numeric without explicit day, e.g. 05/2025 or 2025-05.
    month_year_numeric_patterns = [
        r"\d{1,2}[/\-.]\d{4}",
        r"\d{4}[/\-.]\d{1,2}",
    ]
    if any(re.fullmatch(pattern, text) for pattern in month_year_numeric_patterns):
        return "MONTH"

    return "DAY"


def main() -> None:
    try:
        raw_input = sys.stdin.read()
        data = json.loads(raw_input)
        text = data["text"]
        locale = data.get("locale")
        explicit_precision = data.get("precision")

        normalized_text = strip_ordinal_suffixes(text)
        normalized_text = normalized_text.strip().rstrip(".,;:!?")
        current_year = datetime.now().year
        normalized_text = re.sub(
            r"\bof this year\b", f"{current_year}", normalized_text, flags=re.IGNORECASE
        )
        normalized_text = re.sub(
            r"\bthis year\b", f"{current_year}", normalized_text, flags=re.IGNORECASE
        )
        normalized_text = normalize_spelled_numbers(normalized_text)
        normalized_text = re.sub(
            r"\b(\d{1,2})\s+of\s+([a-z]+)\b", r"\1 \2", normalized_text, flags=re.IGNORECASE
        )
        normalized_text = re.sub(
            r"\bthe\s+(\d{1,2}\b)", r"\1", normalized_text, flags=re.IGNORECASE
        )
        normalized_text = normalize_relative_years(normalized_text, current_year)
        normalized_text = normalize_relative_keywords(normalized_text, current_year)
        normalized_text, relative_dt, relative_precision = resolve_relative_phrases(
            normalized_text, datetime.now()
        )

        language_hint = None
        if locale:
            # Accept both "en" and "en-GB" style inputs.
            language_hint = locale.split("-")[0].split("_")[0]

        settings = {
            "DATE_ORDER": "DMY",
            "PREFER_DATES_FROM": "past",
            "STRICT_PARSING": False,
        }

        language_attempts = []
        if language_hint in {"en", "af"}:
            language_attempts.append([language_hint])
        for fallback in ("en", "af"):
            if not language_hint or fallback != language_hint:
                language_attempts.append([fallback])
        language_attempts.append(None)  # Let dateparser detect automatically.

        if relative_dt is not None:
            dt, precision_hint = relative_dt, relative_precision
        else:
            dt, precision_hint = parse_numeric_date(normalized_text, current_year)
        if dt is None:
            dt, precision_hint = parse_month_of_year(normalized_text, current_year)
        if dt is None:
            for languages in language_attempts:
                dt = dateparser.parse(
                    normalized_text, languages=languages, settings=settings
                )
                if dt:
                    break

        if dt is None:
            sys.stdout.write(json.dumps({"ok": False, "error": "Could not parse date"}))
            return

        precision_source = normalized_text.strip() or dt.strftime("%Y-%m-%d")
        precision_guess = precision_hint or guess_precision(precision_source)
        precision = (
            explicit_precision.upper()
            if isinstance(explicit_precision, str)
            and explicit_precision.upper() in {"YEAR", "MONTH", "DAY"}
            else precision_guess
        )
        year = dt.year
        month = dt.month if precision in ("MONTH", "DAY") else None
        day = dt.day if precision == "DAY" else None

        if precision == "DAY":
            display = dt.strftime("%d %B %Y")
        elif precision == "MONTH":
            display = dt.strftime("%B %Y")
        else:
            display = dt.strftime("%Y")

        result = {
            "ok": True,
            "year": year,
            "month": month,
            "day": day,
            "precision": precision,
            "display": display,
        }
        sys.stdout.write(json.dumps(result))
    except json.JSONDecodeError:
        sys.stdout.write(json.dumps({"ok": False, "error": "Invalid JSON input"}))
        sys.exit(1)
    except KeyError as exc:
        sys.stdout.write(
            json.dumps({"ok": False, "error": f"Missing field: {exc}"})
        )
        sys.exit(1)
    except Exception as exc:  # pragma: no cover - unexpected paths
        sys.stdout.write(
            json.dumps({"ok": False, "error": f"Unexpected error: {exc}"})
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
