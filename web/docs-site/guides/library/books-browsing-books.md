# Browsing Books

Use this guide to find books quickly with Search by Title, Advanced filters, sort options, and pagination on the Books page.

## What This Page Is For

Books is your main lookup page for your collection.

Use it to find a title first, then open Book Details for edits, copy updates, or restore actions.

## Steps To Browse Books Efficiently

1. Open Books.
2. Use Search by Title for quick title lookup.
3. Set Sort to the order you want.
4. Open Advanced filters for deeper filtering.
5. Click Apply & close to apply filter changes.
6. Review Active filters chips.
7. Use page controls and Per page to move through results.

## Search vs Advanced Filters

Search by Title and the Title contains filter both use the same title value.

What this means:

- Typing in Search by Title updates Title contains.
- Typing Title contains updates Search by Title after apply.
- There is one title filter value, not two separate title filters.

Use Search by Title when you need speed.

Use Advanced filters when you need combinations like title + tag + page range + include deleted.

## Filters And Search

### Search by Title and Title contains

Meaning:

- Finds books whose title contains the text you enter.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, no title filter is applied.

Examples:

- ring finds titles containing ring.
- hobbit finds titles containing hobbit.

### Subtitle contains

Meaning:

- Filters by subtitle text.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, no subtitle filter is applied.

### ISBN

Meaning:

- Filters by ISBN.

Logic:

- Exact ISBN match after normalization.

Blank behavior:

- If blank, no ISBN filter is applied.

Examples:

- `9780261103573` matches that ISBN.
- `0-261-10357-1` matches the same stored value after normalization.

### Book Type

Meaning:

- Filters by selected book type values.

Logic:

- One selected value matches books with that type.
- If you select multiple values, they currently combine with AND on this page.

Blank behavior:

- If no values are selected, no type filter is applied.

Examples:

- Selecting Hardcover returns hardcover books.
- Selecting Hardcover and Paperback usually returns no rows because one book has one type value.

### Publisher

Meaning:

- Filters by selected publisher values.

Logic:

- One selected value matches books linked to that publisher.
- If you select multiple values, they currently combine with AND on this page.

Blank behavior:

- If no values are selected, no publisher filter is applied.

Examples:

- Selecting Penguin returns books linked to Penguin.
- Selecting Penguin and HarperCollins usually returns no rows because one book has one publisher.

### Authors

Meaning:

- Filters by selected author links.

Logic:

- OR means any selected author can match.
- AND means all selected authors must match.

Blank behavior:

- If no authors are selected, no author filter is applied.

Examples:

- OR with Author A and Author B returns books with either author.
- AND with Author A and Author B returns books that include both.

### Series

Meaning:

- Filters by selected series links.

Logic:

- OR means any selected series can match.
- AND means all selected series must match.

### Tags

Meaning:

- Filters by selected tags.

Logic:

- OR means any selected tag can match.
- AND means all selected tags must match.

### Languages

Meaning:

- Filters by selected language values.

Logic:

- OR means any selected language can match.
- AND means all selected languages must match.

### Pages min and Pages max

Meaning:

- Sets a page-count range.

Logic:

- Pages min uses inclusive lower bound (`>=`).
- Pages max uses inclusive upper bound (`<=`).
- Using both creates a range.

Blank behavior:

- Blank Pages min means no lower bound.
- Blank Pages max means no upper bound.

Examples:

- Pages min = 300 shows books with 300 or more pages.
- Pages max = 120 shows books with 120 or fewer pages.
- Pages min = 200 and Pages max = 400 shows books in that range.

Edge cases:

- Pages min allows 0.
- Pages max must be at least 1.
- Books without a page count do not match page filters.

### Published after and Published before

Meaning:

- Sets a publication-date range.

Logic:

- Published after uses inclusive lower bound (`>=`).
- Published before uses inclusive upper bound (`<=`).

Blank behavior:

- Blank Published after means no lower date bound.
- Blank Published before means no upper date bound.

Examples:

- Published after = 2000-01-01 shows books from 2000 onward.
- Published before = 1980-12-31 shows books up to 1980.

### Include deleted

Meaning:

- Includes deleted books in results.

Logic:

- Off: active books only.
- On: active and deleted books.

Use this when you need to open a deleted book and restore it.

### Only books with covers

Meaning:

- Shows only books that currently have a cover image value.

Logic:

- Books without cover values are excluded.

Blank behavior:

- When off, books with and without covers are shown.

## How Filters Combine

Different filter groups combine with AND.

Example: Title contains + Pages min + Publisher means all selected conditions must match.

Inside one multi-select group, OR/AND controls only that group.

## Sorting, Pagination, And Filter Changes

- Default sort is Title (A to Z).
- Changing search, applying filters, changing sort, or changing Per page returns results to page 1.
- Filters apply across the full result set, not only the visible page.
- Per page accepts 2 to 200.

## Clear, Reset, And Close Behavior

- Clear next to Search by Title clears title search.
- Reset filters clears advanced-filter controls, but keeps current top title search.
- Clear all filters does the same as Reset filters.
- Reset turns off Include deleted and Only books with covers.
- Reset keeps the current sort and Per page values.
- Closing the filter panel with Close does not apply staged changes. Only Apply & close applies them.

## How To Find And Restore Deleted Books From Books

1. Open Advanced filters.
2. Turn on Include deleted.
3. Click Apply & close.
4. Open the deleted title.
5. On Book Details, click Restore.
6. Choose conflict handling and confirm.

For batch restore, use [Using the Recycle Bin](/guides/library/recycle-bin).

## Questions

### What Is the Practical Difference Between Search by Title and Advanced Filters?

Search by Title is the fastest single-field finder.

Advanced filters are for combination searches, such as title plus author plus date range plus include deleted.

### Why Did My Results Drop So Much After Applying Filters?

Most often, one group is very strict, such as AND mode for authors, tags, or languages, or a narrow pages/date range.

Check Active filters and remove one condition at a time to find the narrowing filter.

### Why Does Selecting Two Book Types Return No Rows?

Book Type currently combines selected values with AND on this page.

Because a book has one type value, selecting multiple types often returns no matches.

### Why Does Selecting Two Publishers Return No Rows?

Publisher behaves similarly to Book Type on this page.

Selecting multiple publishers usually returns no rows because one book has one publisher link.

### What Does Include Deleted Change?

It adds deleted books to your current list so you can open and restore them.

It does not restore automatically; you still restore from Book Details or Recycle bin.

### What Does Only Books With Covers Change?

It filters out books with no cover value.

This is useful for cover cleanup work, but it can make result counts look smaller than expected.

### How Do I Get Back to an Unfiltered List Quickly?

Click Clear for title search, then click Clear all filters.

This returns advanced controls to default values and leaves your sort and per-page settings in place.

### Are Filters Kept if I Refresh the Page?

Yes. Current search, filters, sort, page, and per-page settings are kept in the page address state.

Refreshing keeps the same view.

### Can I Restore a Deleted Book Without Leaving Books?

Yes. Use Include deleted, open the deleted row, then restore from Book Details.

If you need to restore many items, use [Using the Recycle Bin](/guides/library/recycle-bin).

### What Should I Do After I Find the Correct Title?

Open Book Details and choose the smallest next action that matches your task.

Use quick manage actions for focused updates, or Edit Book when you need a wider update.

---

## What's Next?

If you found the right title, these pages help you finish the job quickly.

- [Book Details](/guides/library/books-book-details)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Managing Book Copies](/guides/library/books-managing-copies)
- [Managing Tags](/guides/library/tags-managing-tags)
- [Using the Recycle Bin](/guides/library/recycle-bin)
