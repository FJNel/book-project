# Managing Tags

Tags are flexible labels you attach to books for themes, reading plans, and custom grouping. This guide explains where tags are managed, how validation works, and how tag filtering behaves.

## What is a tag?

A tag is a short reusable label attached to a book.

It is useful when fixed fields are not enough. For example:

- Theme tags: mythology, war memoir
- Reading-plan tags: to-reread, gift-candidate

## Where tags are managed

Tags are managed in book pages (not in a standalone tag list page).

- Add Book -> `Step 7: Add Book Tags`
- Edit Book -> `Step 6: Add Book Tags`
- Book Details -> Manage Tags

## Steps to manage tags from Book Details

1. Open a book’s Book Details page.
2. Click Manage Tags.
3. In Add Book Tag, type the tag and click Add.
4. Remove staged tags with the remove button.
5. Review change text (Adding tags..., Removing tags...).
6. Click Save changes.

## Tag field guidance and validation

Tag input rules are consistent across add/edit and Book Details tag dialogs.

- Minimum 2 characters
- Maximum 50 characters
- Must include at least one letter
- Unsupported characters are rejected
- Duplicates are blocked case-insensitively on the same book

Good examples:

- Historical Fiction
- Read in 2026

## Filters and Search (Tags on Books)

Use Books -> Advanced filters -> Tags when you want tag-based discovery.

### Tags multi-select

- Meaning: limit results to books that carry selected tags
- Logic:
- With OR, a book can have any selected tag
- With AND, a book must have all selected tags
- Blank behavior: no selected tags means tag filtering is off
- Examples:
- Select to-reread and history with OR to get books with either tag
- Select to-reread and history with AND to get books that contain both tags
- Edge case: AND mode is strict and often returns fewer rows than expected

### Mode toggle OR / AND

- Meaning: controls how multiple selected tag values combine
- Logic:
- OR = any selected value (broader)
- AND = all selected values (narrower)
- Blank behavior: when no tags are selected, mode has no effect
- Examples:
- One selected tag behaves the same in either mode
- Three selected tags in AND require all three on one book

### How tag filters combine with other filters

- Tag filtering combines with other active filter fields as AND
- Example: Tags + Publisher + Pages min means a book must satisfy all of them

### Sorting and pagination interactions

- Changing tag selection or mode resets books results to page 1
- Current sort choice stays active when tag filters change
- Pagination applies after tag filtering, across the full filtered result set

### Deleted-record behavior with tag filtering

- If Include deleted is off, only active books are filtered by tags
- If Include deleted is on, deleted books can also appear in tag-filtered results
- Restore path: open the deleted book and use Restore on Book Details, or use [Using the Recycle Bin](/guides/library/recycle-bin)

### Clear and reset behavior

- Clear next to Search by Title clears top search/title filtering, not only tag filters
- Removing the tag chip from Active filters clears just the tag filter
- Reset filters and Clear all filters clear selected tags and return tag mode to default
- Clear/reset actions keep your current sort and Per page settings
- Clear/reset actions return results to page 1
- Closing filters with Close does not apply staged tag changes; use Apply & close

## Other ways to manage this

- Use tag steps in Add Book or Edit Book when you are already doing a full book pass
- Use Manage Tags on Book Details for quick one-book cleanup

Use book steps when tags are part of a full edit. Use Book Details when only tags need attention.

## Delete and restore notes for tags

There is no separate tag record details page with its own Delete/Restore actions in current user-facing library pages.

Tag changes are made by adding or removing tags from books.

## Questions

### Are tags global records or only text on one book?

Tags are attached to books, and used values appear again in book filtering options.

In practice, this works like reusable labels across your library.

### What is the fastest way to fix tags on one title?

Open Book Details and use Manage Tags.

It is shorter than running all full edit steps when tags are the only change.

### Can I add tags while creating a book?

Yes. Use Step 7: Add Book Tags while adding a book.

You can also adjust tags later while editing the book or from Book Details.

### Can I add the same tag twice with different case?

No. Duplicate checks are case-insensitive for a single book.

For example, History and history count as duplicates.

### Why was my tag rejected?

Common reasons are short length, unsupported characters, missing letters, or duplicate value.

Check the helper text under the tag input for the exact reason.

### How do AND and OR change tag filter results?

OR is broader and matches any selected tag. AND is stricter and requires every selected tag.

If results look too small, switch from AND to OR first.

### Does changing tags affect sorting?

No. Sorting still uses sort fields such as title, publication date, page count, created, and updated.

Tags affect filtering and display, not sort order.

### Can I restore deleted tags from the Recycle bin?

There is no standalone tag restore action in current user-facing pages.

Recycle-bin records currently cover books, book types, authors, publishers, and series.

### Is there a bulk rename or bulk delete screen for tags?

Not in current user-facing library pages.

For broad tag cleanup, work through filtered book lists and update tags per title.

### What is the best way to recover from an over-filtered tag search?

Use Reset filters (or Clear all filters) on Books, and clear top search if needed.

Then reapply only the tag filters you actually need.

---

## What's Next?

If your tag strategy is looking sharp, these pages help you use it even better.

- [Browsing Books](/guides/library/books-browsing-books)
- [Book Details](/guides/library/books-book-details)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Languages in Books](/guides/library/languages-in-books)
- [Using the Recycle Bin](/guides/library/recycle-bin)
