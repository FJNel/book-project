# Managing Series

This guide explains how to manage series records and series-book links across Series, Series Details, and book pages.

## What is a series?

A series is a named collection of related books, often connected by story order or theme.

In The Book Project, a book can be linked to one or more series, and each link can store an order value.

Examples:

- The Lord of the Rings
- The Stormlight Archive

## When to use this guide

Use this guide when you need to:

- Create or rename series records
- Adjust website or description values
- Maintain book membership and order
- Restore deleted series records

## Steps to manage series

1. Open Series.
2. Click Add Series.
3. Fill form values and save.
4. Use search, sort, and Advanced filters.
5. Open a row to Series Details.
6. Use Edit for series profile updates.
7. In Books in this series, use row actions such as Edit series order and Remove book from this series.
8. Use Delete, Restore, or Delete permanently for lifecycle actions.

## Series form fields

### Series Name (required)

- Purpose: shared series label used in links and filters
- Rules: 2 to 150 characters, supported punctuation

### Series Website (optional)

- Purpose: reference link for the series
- Rule: valid `http://` or `https://` URL

### Description (optional)

- Purpose: quick summary/context for the series
- Rule: up to 1000 characters

### Order in series (link-level field)

- Where used: Series Details -> Edit series order
- Rule: positive whole number
- Tip: leave blank to clear order

## Series dates: what is editable vs calculated

In series create/edit forms, you do not manually type start/end dates.

Started and Ended shown on series pages are calculated from linked books.

## Filters and Search

### Search by Series Name and Series name

- Meaning: quick series-name lookup from the top search box
- Logic: contains match (case-insensitive), same rule as Series name
- Blank behavior: empty value removes name filtering
- Examples:
- chronicles matches series names containing chronicles
- stormlight matches series names containing stormlight
- Edge case: top search and Series name stay synced

### Description

- Meaning: narrow by series description text
- Logic: contains match (case-insensitive)
- Blank behavior: no description filter is applied
- Examples:
- fantasy matches descriptions containing fantasy
- anthology matches descriptions containing anthology
- Edge case: series with empty descriptions do not match when this filter is set

### Website

- Meaning: narrow by website text
- Logic: contains match (case-insensitive)
- Blank behavior: no website filter is applied
- Examples:
- example.com matches website values containing that text
- `https://` narrows to records storing protocol text
- Edge case: empty website rows do not match when this filter is set

### Started after and Started before

- Meaning:
- Started after keeps series that start on/after a date
- Started before keeps series that start on/before a date
- Logic:
- Started after uses `>=` (inclusive)
- Started before uses `<=` (inclusive)
- Both together create a start-date window
- Blank behavior:
- Blank Started after means no lower start-date limit
- Blank Started before means no upper start-date limit
- Examples:
- `Started after = 2000-01-01` keeps newer-starting series
- `Started before = 1980-12-31` keeps older-starting series
- Edge case: start/end values are derived from linked book dates

### Ended after and Ended before

- Meaning:
- Ended after keeps series ending on/after a date
- Ended before keeps series ending on/before a date
- Logic:
- Ended after uses `>=` (inclusive)
- Ended before uses `<=` (inclusive)
- Both together create an end-date window
- Blank behavior:
- Blank Ended after means no lower end-date limit
- Blank Ended before means no upper end-date limit
- Examples:
- `Ended after = 2010-01-01` keeps more recently ended series
- `Ended before = 1990-12-31` keeps older completed series
- Edge case: ongoing series with no end date do not match when end-date filters are set

### Created after and Created before

- Meaning: filter by when the series record was created
- Logic: inclusive date comparisons (`>=` and `<=`)
- Blank behavior: blank values remove created-date filtering
- Examples:
- `Created after = 2025-01-01` shows records created from that date
- `Created before = 2024-12-31` shows records created up to that date

### Updated after and Updated before

- Meaning: filter by last update date
- Logic: inclusive date comparisons (`>=` and `<=`)
- Blank behavior: blank values remove updated-date filtering
- Examples:
- `Updated after = 2026-01-01` shows recently edited records
- `Updated before = 2025-01-01` shows older unchanged records

### Include deleted series

- Meaning: include deleted and active series in one results set
- Logic: when enabled, deleted rows are included
- Blank behavior: when off, only active rows are shown
- Examples:
- Off: active series only
- On: active + deleted series
- Edge case: use this to open deleted rows and restore them

### How filters combine

- Different filter fields combine with AND
- Example: Series name + Started after + Include deleted series means all selected conditions apply together

### Sorting and pagination with filters

- Default sort: Name (A to Z)
- Changing search, applying filters, resetting filters, changing sort, and changing Per page all reset to page 1
- Filters apply to the full result set, not only the current page
- Per page accepts 2 to 200

### Clear and reset behavior

- Clear next to top search:
- Clears top search and synced name filter
- Keeps other filters unchanged
- Reset filters:
- Resets advanced filters
- Keeps active top search mapped into Series name
- Turns Include deleted series off
- Keeps current sort and Per page values
- Clear all filters:
- Same behavior as Reset filters
- Removing a single filter chip:
- Removes only that filter
- Any clear/reset action returns results to page 1
- Closing with Close:
- Does not apply new values unless you click Apply & close

## Other ways to manage this

Series links can be managed from more than one page.

- Add Book -> `Step 6: Add Book Series`
- Edit Book -> series step
- Book Details -> Manage Series
- Series Details -> Books in this series

Use Book Details for one-book fixes. Use Series Details for one-series cleanup across many books.

## Delete, restore, and permanent delete

### Soft delete

Delete on Series Details moves the record to recycle-bin state.

### Restore

Restore paths:

- Series Details -> Restore
- Account Recycle bin
- List path: Advanced filters -> Include deleted series -> open deleted series -> Restore

Conflict handling:

- Decline: keeps the active matching series unchanged and leaves the deleted one deleted. Choose this when you want to review first.
- Merge: combines details into the active matching series where possible. Choose this when both rows are the same series.
- Override: replaces the active matching series with the deleted one you are restoring. Choose this when the deleted row is the correct final version.

Example:

- Deleted series: Chronicles of Narnia with fuller description and website
- Active series: Narnia Chronicles with minimal data
- Choose Merge to combine into one series
- Choose Override if the deleted series row should replace the active one

### Permanent delete

Delete permanently requires typing `DELETE` and is final.

Use [Using the Recycle Bin](/guides/library/recycle-bin) for broader restore/delete sessions.

## Questions

### Can one book belong to multiple series?

Yes. The add/edit book steps and series management pages support more than one series link.

Use order values where ordering matters.

### Where is the fastest place to change one series order?

Use Edit series order in Series Details if you are already reviewing that series.

If you are working on one title, Book Details -> Manage Series is often faster.

### Can I clear an order value?

Yes. In the order dialog, leave the field blank and save.

That removes the stored order for that link.

### What happens when I remove a book from a series?

Only the relationship is removed.

The book and the series records both remain.

### Can I create a series while adding a book?

Yes. Use Add new Series in book steps.

That keeps your book process moving without leaving the page.

### How do restore conflicts work for series?

If a matching active series exists, choose Decline, Merge, or Override in restore.

Use Decline when you need a safe no-change decision, Merge when both rows are truly one series, and Override when the deleted row should replace the active one.

If you are unsure, restore with Decline first, compare details, then restore again with the final choice.

### Is series delete recoverable?

Delete is recoverable from Series Details or Recycle bin. Delete permanently is not recoverable.

Choose soft delete first when unsure.

### Are filters and pagination remembered after refresh?

Yes. Current list state is preserved.

This helps when working through large series lists.

### Why do started/ended values differ from what I expected?

Those values are derived from linked book date data, not manually typed in the series form.

Check publication-date data on linked books if dates seem off.

### Which page should I use for series-heavy cleanup?

Use Series Details when one series is your focus. Use Books/Book Details when one title is your focus.

Switching based on focus makes cleanup much faster.

---

## What's Next?

If your series links look good, these guides help you finish the surrounding relationship work.

- [Book Details](/guides/library/books-book-details)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Managing Authors (Full Guide)](/guides/library/authors-managing-authors)
- [Managing Publishers](/guides/library/publishers-managing-publishers)
- [Using the Recycle Bin](/guides/library/recycle-bin)
