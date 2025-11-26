import sys
import json
import re
from datetime import datetime

import dateparser


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


def strip_ordinal_suffixes(text: str) -> str:
    """Remove English/Afrikaans ordinal suffixes to help parsing."""

    return re.sub(r"\b([12]?\d|3[01])(st|nd|rd|th|ste|de)\b", r"\1", text, flags=re.IGNORECASE)


def parse_numeric_date(text: str) -> tuple[datetime | None, str | None]:
    """Handle numeric-only dates before falling back to dateparser."""

    normalized = re.sub(r"[./]", "-", text.strip())

    # YYYY-MM or YYYY-MM-DD forms.
    if re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", normalized):
        for fmt in ("%Y-%m-%d", "%Y-%d-%m"):
            try:
                return datetime.strptime(normalized, fmt), "DAY"
            except ValueError:
                continue
    if re.fullmatch(r"\d{4}-\d{1,2}", normalized):
        try:
            dt = datetime.strptime(normalized + "-01", "%Y-%m-%d")
            return dt, "MONTH"
        except ValueError:
            return None, None

    # DD-MM-YYYY or MM-DD-YYYY forms.
    if re.fullmatch(r"\d{1,2}-\d{1,2}-\d{4}", normalized):
        for fmt in ("%d-%m-%Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(normalized, fmt), "DAY"
            except ValueError:
                continue

    return None, None


def guess_precision(original: str) -> str:
    """
    Inspect the original input string to guess the precision.
    Returns "YEAR", "MONTH", or "DAY".
    """

    text = original.strip()
    lowered = text.lower()

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

        dt, precision_hint = parse_numeric_date(normalized_text)
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
