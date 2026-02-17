# Managing Authors (Full Guide)

Use this guide to create, find, edit, and restore authors in The Book Project.

It also explains how author links to books work, and when to use Author Details versus Book Details for link changes.

## What Is an Author?

An author is a reusable person profile in your library. You can link the same author to many books, and choose a role for each linked book.

Examples:

- J. R. R. Tolkien linked as Author.
- Christopher Tolkien linked as Editor.
- A translator linked as Translator on one title and Author on another title.

## When To Use This Guide

Use this guide when you need to:

- Create a new author profile.
- Correct names, dates, or bio information.
- Review all books linked to one author.
- Restore a deleted author.
- Permanently delete an author you no longer need.

## Steps To Manage Authors

1. Open Authors.
2. Click Add Author.
3. Fill in the author form and save.
4. Use Search by Author Name and Advanced filters to find the author you want.
5. Open the row to Author Details.
6. Use Edit to update the profile.
7. Use Books by this author actions to update a role or remove one link.
8. Use Delete, Restore, or Delete permanently for lifecycle actions.

## Author Form Fields

### Display Name (Required)

This is the main name shown in lists and details.

Use the version of the name you want to see everywhere in the app.

Validation:

- Required.
- Must be 2 to 150 characters.
- Must use supported name characters.

### First Name(s) (Optional)

Use this when you want separate first names for sorting or clarity.

Validation:

- Optional.
- If filled in, must be 2 to 150 characters.
- Must use supported name characters.

### Last Name (Optional)

Use this when you want a separate last name value for filtering or sorting.

Validation:

- Optional.
- If filled in, must be 2 to 100 characters.
- Must use supported name characters.

### Birth Date (Optional)

Use this for known birth information, including partial dates.

For date formats and examples, see [Using Partial Dates](/guides/library/partial-dates).

### Author Is Deceased and Death Date

Turn on Author is deceased first. The Death Date field is shown only after that toggle is enabled.

Death Date supports partial dates.

### Short Bio (Optional)

Use this for short profile notes that help you identify the person quickly.

Validation:

- Optional.
- Up to 1000 characters.

## Filters And Search

### Search by Author Name and Display name

Meaning:

- Finds authors by display name text.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, no display-name filter is applied.

Examples:

- tolkien finds display names containing tolkien.
- rowling finds display names containing rowling.

### First names

Meaning:

- Finds authors by first-name text.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, this filter is not used.

### Last name

Meaning:

- Finds authors by last-name text.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, this filter is not used.

### Bio

Meaning:

- Finds authors whose bio contains your text.

Logic:

- Contains match, case-insensitive.

Blank behavior:

- If blank, this filter is not used.

### Status

Meaning:

- Filters by living or deceased status.

Logic:

- Any applies no status filter.
- Deceased matches deceased authors.
- Living matches non-deceased authors.

### Born after / Born before and Died after / Died before

Meaning:

- Limits results to date windows.

Logic:

- After uses inclusive lower bound (`>=`).
- Before uses inclusive upper bound (`<=`).
- Using both creates a range.

Blank behavior:

- Blank after means no lower limit.
- Blank before means no upper limit.

### Created after / Created before and Updated after / Updated before

Meaning:

- Filters by record creation date and last update date.

Logic:

- Inclusive lower and upper bounds.

### Include deleted authors

Meaning:

- Shows deleted authors together with active authors.

Use this when you want to open deleted authors and restore them from Author Details.

### How Filters Combine

Different filter fields combine with AND.

Example: Status = Deceased + Last name = smith + Born before = 1900-12-31 returns only rows that match all three.

### Sorting, Pagination, And Reset Behavior

- Default sort is Display name (A to Z).
- Changing search, filters, sort, or Per page returns results to page 1.
- Per page accepts 2 to 200.
- Clear next to Search by Author Name clears top search.
- Reset filters and Clear all filters reset the advanced filters and turn Include deleted authors off.
- If there is active top search text, reset keeps that search and maps it to Display name.

## Other Ways To Manage Author Links

You can change author links from more than one place:

- Author Details > Books by this author is best when one author is your focus.
- Book Details > Manage Authors is best when one book is your focus.
- Edit Book author step is best when author changes are part of a bigger book update.

## Delete, Restore, And Permanent Delete

### Delete

Delete moves the author into the recycle bin state. The author is hidden from active-only views and can be restored later.

### Restore

You can restore from:

- Author Details using Restore.
- Account > Recycle bin.
- Authors list by enabling Include deleted authors, opening the deleted author, then clicking Restore.

A restore conflict means a matching active author already exists.

- Decline keeps the active match unchanged and leaves the deleted author deleted.
- Merge combines details into the active match where possible.
- Override restores the deleted author over the active match.

For full restore and conflict examples, see [Using the Recycle Bin](/guides/library/recycle-bin).

### Delete Permanently

Delete permanently is final and cannot be undone.

## Questions

### Can I Create an Author With Only Display Name?

Yes. Display Name is the only required field in the author form.

You can add dates and bio later.

### Why Do I Not See the Death Date Field?

Death Date is hidden until you turn on Author is deceased.

Enable the toggle first, then enter the date.

### Can I Remove an Author Link Without Deleting the Author Profile?

Yes. Remove the link from the book-author relationship actions.

That removes only the connection to that one book. The author profile remains available for other books.

### Why Did “Remove Author From This Book” Fail on Author Details?

On Author Details, the remove action blocks the change if that book would end up with zero authors.

If that happens, add another author to the book first, then remove the old one.

### Can a Book Exist With No Authors?

Yes. Book records can exist without authors.

In practice, behavior differs by page: Book Details can allow removing the last author, while Author Details can block that specific remove action. If one path blocks you, use the book page to complete your change.

### How Do I Pick Between Author Details and Book Details?

Use Author Details when your goal is to clean one author across many books.

Use Book Details when your goal is to fix one specific title quickly.

### What Does Include Deleted Authors Do?

It adds deleted rows to the current results so you can open and restore them.

It does not restore anything by itself. You still need to open the author and click Restore.

### How Should I Choose Decline, Merge, or Override During Restore?

Start with Decline when you are unsure. It is the safest option because it does not change active data.

Choose Merge when both rows represent the same person and you want one combined profile. Choose Override when the deleted profile is the one you trust and want to keep as the active version.

### Does Deleting an Author Delete Books?

No. Deleting an author does not delete books.

It changes author availability and links, but book records remain in your library.

### What Is the Best Final Check After Author Cleanup?

Open one or two affected books and confirm credits are shown as expected.

Then run a quick search for that author name on Authors to confirm there are no accidental duplicates.

---

## What's Next?

If you are on a cleanup streak, these pages are good next stops.

- [Managing Authors](/guides/library/managing-authors)
- [Book Details](/guides/library/books-book-details)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Browsing Books](/guides/library/books-browsing-books)
- [Using the Recycle Bin](/guides/library/recycle-bin)
