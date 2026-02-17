# Managing Publishers

This guide covers publisher management across Publishers, Publisher Details, and book pages. Use it to keep publisher records clear and links to books accurate.

## What is a publisher?

A publisher record represents the organization responsible for publishing a book edition.

In The Book Project, one book record can have one publisher link.

Examples:

- Penguin Random House
- HarperCollins

## When to use this guide

Use this guide when you need to:

- Add or edit publisher profiles
- Review publisher-linked books from one place
- Remove a publisher from one specific title
- Restore deleted publisher records

## Steps to manage publishers

1. Open Publishers.
2. Click Add Publisher.
3. Fill form values and save.
4. Use search, sort, and Advanced filters to find records.
5. Open a row to Publisher Details.
6. Click Edit for profile changes.
7. In Books by this publisher, use row actions such as Remove Publisher from Book.
8. Use Delete, Restore, or Delete permanently as needed.

## Publisher form fields

### Publisher Name (required)

- Purpose: main name shown in lists and book links
- Rules: 2 to 150 characters, supported punctuation

### Founded Date (optional)

- Purpose: timeline context for the publisher profile
- Behavior: partial dates supported

### Website (optional)

- Purpose: reference link shown in details
- Rule: valid `http://` or `https://` URL

### Notes (optional)

- Purpose: additional publisher context
- Rule: up to 1000 characters

Partial-date reference: [Using Partial Dates](/guides/library/partial-dates)

## Filters and Search

### Search by Publisher Name and Publisher name

- Meaning: quick publisher-name lookup from the top search box
- Logic: contains match (case-insensitive), same rule as Publisher name
- Blank behavior: empty value removes name filtering
- Examples:
- penguin matches names containing penguin
- harper matches names containing harper
- Edge case: top search and Publisher name stay synced

### Website

- Meaning: narrow by website text
- Logic: contains match (case-insensitive)
- Blank behavior: no website filter is applied
- Examples:
- penguin.co matches website values containing that text
- `https://` matches rows that include protocol text
- Edge case: empty website rows do not match when this filter has a value

### Notes

- Meaning: narrow by notes text
- Logic: contains match (case-insensitive)
- Blank behavior: no notes filter is applied
- Examples:
- imprint matches notes containing imprint
- out of print matches those words in notes
- Edge case: publishers with empty notes do not match when this filter is set

### Founded after and Founded before

- Meaning:
- Founded after keeps publishers founded on/after a date
- Founded before keeps publishers founded on/before a date
- Logic:
- Founded after uses `>=` (inclusive)
- Founded before uses `<=` (inclusive)
- Both together create a founded-date window
- Blank behavior:
- Blank Founded after means no lower founded-date limit
- Blank Founded before means no upper founded-date limit
- Examples:
- `Founded after = 1950-01-01` keeps publishers founded in 1950 or later
- `Founded before = 1900-12-31` keeps publishers founded up to 1900
- Edge case: publishers without founded dates do not match when founded filters are set

### Created after and Created before

- Meaning: filter by when the publisher record was created
- Logic: inclusive date comparisons (`>=` and `<=`)
- Blank behavior: blank values remove created-date filtering
- Examples:
- `Created after = 2025-01-01` shows records created from that date onward
- `Created before = 2024-12-31` shows records created up to that date

### Updated after and Updated before

- Meaning: filter by last update date
- Logic: inclusive date comparisons (`>=` and `<=`)
- Blank behavior: blank values remove updated-date filtering
- Examples:
- `Updated after = 2026-01-01` shows recently updated records
- `Updated before = 2025-01-01` shows older unchanged records

### Include deleted publishers

- Meaning: include deleted and active publishers together
- Logic: when enabled, deleted rows are included
- Blank behavior: when off, only active rows are shown
- Examples:
- Off: active publishers only
- On: active + deleted publishers
- Edge case: open deleted rows and use Restore from details

### How filters combine

- Different filter fields combine with AND
- Example: Publisher name + Founded before + Include deleted publishers means all selected conditions apply at once

### Sorting and pagination with filters

- Default sort: Name (A to Z)
- Changing search, applying filters, resetting filters, changing sort, and changing Per page all reset to page 1
- Filters apply across the full list, not just visible rows
- Per page accepts 2 to 200

### Clear and reset behavior

- Clear next to top search:
- Clears top search and synced name filter
- Keeps other filters unchanged
- Reset filters:
- Resets advanced filters
- Keeps active top search mapped into Publisher name
- Turns Include deleted publishers off
- Keeps current sort and Per page values
- Clear all filters:
- Same behavior as Reset filters
- Removing a filter chip:
- Removes only that chip’s filter
- Any clear/reset action returns results to page 1
- Closing with Close:
- Does not apply staged edits unless you click Apply & close

## Other ways to manage this

- Add Book -> publisher step -> Add new Publisher
- Edit Book -> publisher step
- Publisher Details -> Books by this publisher -> Remove Publisher from Book

Use book pages when assigning one title. Use publisher pages for profile-level cleanup.

## Delete, restore, and permanent delete

### Soft delete

Delete on Publisher Details moves the profile to recycle-bin state (recoverable).

### Restore

Restore paths:

- Publisher Details -> Restore
- Account Recycle bin
- List path: Advanced filters -> Include deleted publishers -> open deleted publisher -> Restore

Conflict handling:

- Decline: keeps the active matching publisher unchanged and leaves the deleted one deleted. Choose this when you need to review first.
- Merge: combines details into the active matching publisher where possible. Choose this when both rows are the same publisher.
- Override: replaces the active matching publisher with the deleted one you are restoring. Choose this when the deleted row is the trusted final version.

Example:

- Deleted row: Penguin Random House with fuller notes and website
- Active row: Penguin RandomHouse with limited data
- Use Merge for one combined profile
- Use Override when the deleted row should become the final active profile

### Permanent delete

Delete permanently requires typing `DELETE` and is final.

For bulk restore or delete work, use [Using the Recycle Bin](/guides/library/recycle-bin).

## Questions

### Can I create a publisher while adding a book?

Yes. Use Add new Publisher in book steps.

That publisher is then available in other book forms.

### Can I remove a publisher from one book without deleting the publisher record?

Yes. In Publisher Details, use the row action for Remove Publisher from Book.

That only removes that single link.

### Does removing a publisher from one book delete that book?

No. The book remains in your library.

Only the publisher link is removed.

### What is the best place to correct publisher website and notes?

Use Edit in Publisher Details for profile fields like website and notes.

Use book edit steps for one-title assignment changes.

### Why is my website value rejected?

Website fields require a valid `http://` or `https://` URL format.

If needed, paste the full web address instead of partial text.

### How do restore conflicts work for publishers?

When a matching active publisher exists, choose Decline, Merge, or Override in restore.

Use Decline for a safe review-first choice. Use Merge when both records represent the same publisher. Use Override when the deleted record should replace the active one.

For full conflict examples and bulk restore steps, see [Using the Recycle Bin](/guides/library/recycle-bin).

### Can I restore publishers from the list page?

Yes. Enable Include deleted publishers, open the deleted profile, then use Restore.

For many records, the account Recycle bin is faster.

### What does permanent delete change?

Permanent delete removes the publisher record completely and cannot be undone.

Use soft delete first if you might need recovery later.

### Are filters and sorting remembered after refresh?

Yes. Current search/filter/sort/page/per-page state is preserved.

That helps when working through long cleanup lists.

### How do I avoid duplicate publisher records?

Search first, then edit an existing profile if it already represents the same publisher.

This keeps assignment and filtering cleaner over time.

---

## What's Next?

If publisher details are in good shape, these pages help complete the rest of your library cleanup.

- [Editing a Book](/guides/library/books-editing-a-book)
- [Book Details](/guides/library/books-book-details)
- [Managing Series](/guides/library/series-managing-series)
- [Managing Book Types](/guides/library/book-types-managing-book-types)
- [Using the Recycle Bin](/guides/library/recycle-bin)
