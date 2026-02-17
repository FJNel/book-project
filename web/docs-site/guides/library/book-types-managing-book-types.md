# Managing Book Types

Book types are shared format labels used by books, such as Hardcover or Paperback.

This guide covers creating, finding, editing, restoring, and permanently deleting book types.

## What Is a Book Type?

A book type is the format label attached to a book.

It helps you keep format values consistent across your library and makes filtering easier.

Examples:

- Hardcover for printed hardback editions.
- Paperback for soft-cover editions.

## When To Use This Guide

Use this guide when you need to:

- Add a missing format label.
- Rename an existing shared format label.
- Restore a deleted type.
- Permanently remove old type entries.

## Steps To Manage Book Types

1. Open Book Types.
2. Click Add Book Type.
3. Fill in the form and save.
4. Use Search by Name, Sort, and Advanced filters to find the type.
5. Open the row to Book Type Details.
6. Use Edit, Delete, Restore, or Delete permanently as needed.

## Form Fields

### Book Type Name (Required)

This is the label shown on books that use this type.

Validation:

- Required.
- Must be 2 to 100 characters.
- Must use supported name characters.

### Description (Optional)

Use this to describe when the type should be used.

Validation:

- Optional.
- Up to 500 characters.

## Filters And Search

### Search by Name and Book type name

Meaning:

- Finds rows by type name text.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, no name filter is applied.

### Description

Meaning:

- Finds rows by description text.

Logic:

- Contains match, case-insensitive.

### Created after / Created before and Updated after / Updated before

Meaning:

- Filters by record creation date and last update date.

Logic:

- Inclusive date windows (`>=` and `<=`).

### Include deleted

Meaning:

- Shows deleted rows together with active rows.

Use this when you need to find deleted types and open them for restore.

### How Filters Combine

Different filter fields combine with AND.

### Sorting, Pagination, And Reset Behavior

- Default sort is Name (A to Z).
- Per page accepts 2 to 200.
- Search, filters, sort, and Per page changes return results to page 1.
- Clear removes top search text.
- Reset filters and Clear all filters reset advanced filters and turn Include deleted off.
- On this page, reset also clears top search text.

## Other Ways To Manage This

You can also create a new type while working on a book:

- Add Book > Select Book Type > Create new Book Type.
- Edit Book > Select Book Type > Create new Book Type.

### Rename a Shared Type vs Change One Book’s Type

Use Book Type Details > Edit when you want to rename the shared label itself. This affects every book that uses that type.

Use Edit Book when you want to change only one book from one type to another.

## Delete, Restore, And Permanent Delete

### Delete

On Book Type Details, Delete opens Move book type to recycle bin.

Current behavior: you must type `DELETE` before this recycle-bin delete button is enabled.

### Restore

You can restore from:

- Book Type Details using Restore.
- Account > Recycle bin.
- Book Types list by enabling Include deleted, opening the deleted row, then clicking Restore.

A restore conflict means a matching active type already exists.

- Decline keeps the active match unchanged and keeps the deleted row deleted.
- Merge combines details into the active match where possible.
- Override restores the deleted row over the active match.

For full conflict examples, see [Using the Recycle Bin](/guides/library/recycle-bin).

### Delete Permanently

Delete permanently is final and cannot be undone.

It also requires typing `DELETE`.

## Questions

### What Is the Difference Between Renaming a Type and Changing One Book’s Type?

Renaming a type from Book Type Details changes the shared label used by every linked book.

Changing one book’s type is done from that book’s Edit Book page, so only that title changes.

### Why Does Delete Ask for `DELETE` Even for Recycle-Bin Delete?

That is the current page behavior in Book Type Details.

You must type `DELETE` for both Move book type to recycle bin and Delete permanently.

### Where Can I Find Deleted Book Types?

Use either path:

- Book Types > Advanced filters > Include deleted.
- Account > Recycle bin.

### How Do I Restore a Deleted Book Type From Book Types?

Turn on Include deleted, apply filters, open the deleted row, then click Restore.

If a conflict is shown, choose Decline, Merge, or Override based on your goal.

### What Should I Pick: Decline, Merge, or Override?

Start with Decline when unsure.

Use Merge when both rows are the same real type and should become one. Use Override when the deleted row is the one you trust and should replace the active match.

### Does Permanent Delete Affect Books That Used That Type?

Yes. If books still point to that type, the permanent-delete dialog explains that type values are cleared from those books.

Afterward, review affected books and set the correct replacement type.

### Can I Add a New Type Without Leaving Add Book?

Yes. Use Create new Book Type in the book form.

The new type becomes selectable immediately.

### Are Filters Kept When I Refresh the Page?

Yes. Current search, filters, sort, and page settings are kept in the page address state.

You can refresh without losing your current working view.

### How Do I Quickly Return to the Full List?

Click Clear for top search, then Reset filters or Clear all filters.

This returns advanced controls to defaults and removes include-deleted view.

### Where Can I Review Usage Before Deleting?

Open Book Type Details and review the usage information there before deleting.

That helps you estimate the impact of shared-label changes.

---

## What's Next?

If you want to keep your format data consistent, these guides are strong follow-ups.

- [Adding a Book](/guides/library/books-adding-a-book)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Book Details](/guides/library/books-book-details)
- [Browsing Books](/guides/library/books-browsing-books)
- [Using the Recycle Bin](/guides/library/recycle-bin)
