# Using Partial Dates

Partial dates let you save useful date information even when you do not know the full day, month, and year. This guide explains where partial dates are supported, which formats work, and how to avoid common mistakes.

## What is a partial date?

A partial date is a date with only the parts you know.

Examples:

- Year only: `1999`
- Month and year: March 1999
- Full date: `14 March 1999`

In The Book Project, partial dates are helpful for older books or author history where exact day details are unknown.

## Where partial dates are supported

Partial-date input is supported in these fields:

- Publication Date on Add Book and Edit Book
- Acquisition date in copy forms (Step 8 when adding, and Add Copy / Edit Copy on Book Details)
- Birth Date and Death Date in author forms
- Founded Date in publisher forms

> Started and Ended values shown for series are calculated from linked books. They are not entered as partial-date form fields.

## How the live help text works

When you type in a partial-date field, the help text under the field updates.

- Valid input: shows how the date will be stored (for example, `This date will be saved as: March 1999`)
- Invalid input: shows an error message

This is the fastest way to confirm your date before saving.

## Supported input styles

These styles are supported by the parser used in the app:

- Numeric dates with separators (such as day/month/year or year-month-day)
- Month names with year (March 1999)
- Day + month + year (`14 March 1999`)
- Year only (`1999`)
- Month only (March), which resolves against the current date context

The parser also accepts many natural-language variants, but the most reliable pattern is to enter clear numeric or month-name dates.

## Recommended entry formats

For clear, predictable results, use:

- YYYY for year only
- Month YYYY for month + year
- D Month YYYY for full date

Examples:

- `2005`
- November 2005
- `23 November 2005`

## Common mistakes and fixes

- Mistake: entering unclear short numbers.
- Fix: use month names (for example March 2001) when you can.

- Mistake: entering text that is not date-like.
- Fix: watch the help text under the field and adjust until it shows a valid stored value.

- Mistake: mixing up full-date and partial-date expectations.
- Fix: if you only know part of the date, enter only that part instead of guessing a day.

## Questions

### Why should I use partial dates instead of guessing a full date?

Partial dates let you keep records accurate without inventing missing information. If you only know the year, saving just the year is cleaner than adding a guessed month and day.

That improves trust in your data later, especially when sorting and reviewing history.

### Which book fields accept partial dates?

Publication Date and copy Acquisition date accept partial-date input. Both show live help under the field so you can confirm the stored format before saving.

If the help text shows an error, fix that field before confirming changes.

### Which author fields accept partial dates?

Birth Date and Death Date accept partial dates. For death date, make sure Author is deceased is enabled.

If Death Date is filled while Author is deceased is off, the form shows a validation error.

### Which publisher fields accept partial dates?

Founded Date supports partial dates in publisher create and edit forms.

You can store year-only or month-year if that is all you know.

### Do I need to type dates in one exact format?

No. The parser accepts multiple patterns, including numeric and month-name forms.

For predictable results, month-name formats like `14 March 1999` are usually easiest to verify.

### How do I know if my typed date is valid?

Check the help text directly under the field. A valid value shows how it will be saved.

If it is invalid, the help text changes to an error message you can fix immediately.

### Can I leave a partial-date field empty?

Yes for optional fields. Most date fields in these forms are optional.

If you do not know the date yet, leave it blank and add it later.

### Why does my date look different after save?

The app stores dates in a normalized readable format. That can differ slightly from your typed spacing or separators.

This is expected and helps keep display consistent across pages.

### Does series use partial-date entry?

Series Started and Ended values are shown on series pages, but they are not typed as partial-date form fields.

Those dates are calculated from linked books.

### Where should I go next if date validation keeps failing?

Return to the form field and simplify the input to a clear pattern like YYYY, Month YYYY, or D Month YYYY.

If you are still blocked, continue with other optional fields and come back later once you have better source information.

---

## What's Next?

If you’re building detailed records, these guides help you apply partial dates in the right places.

- [Adding a Book](/guides/library/books-adding-a-book)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Managing Book Copies](/guides/library/books-managing-copies)
- [Managing Authors (Full Guide)](/guides/library/authors-managing-authors)
- [Managing Publishers](/guides/library/publishers-managing-publishers)
