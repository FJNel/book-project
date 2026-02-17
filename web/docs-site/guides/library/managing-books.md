# Managing Books

This page is your guide hub for the full book lifecycle in The Book Project. Use it to choose the right page for adding books, editing existing books, browsing your catalogue, managing copies, and handling deletion or restore work.

## What is a book in The Book Project?

A book record represents one specific edition in your library catalogue. It stores details such as title, ISBN, language, publisher, and linked authors, series, and tags.

Your physical items are tracked as **copies** under that book. For example, one title can have two copies stored in different places.

## When to use this guide hub

Use this hub when you need to:

- Add a new title and its first copy
- Update core details of an existing title
- Quickly change linked authors, series, or tags
- Find books with search, filters, sorting, and paging
- Restore deleted books or remove them permanently

## Choose the right page for your task

1. Start with [Adding a Book](/guides/library/books-adding-a-book) when the title is not in your library yet.
2. Use [Editing a Book](/guides/library/books-editing-a-book) when the title already exists and you need broad changes.
3. Use [Book Details](/guides/library/books-book-details) for one-book maintenance (authors, series, tags, copies, delete/restore).
4. Use [Managing Book Copies](/guides/library/books-managing-copies) when your focus is storage and acquisition details for physical copies.
5. Use [Browsing Books](/guides/library/books-browsing-books) for filter-heavy lookup work.

## Add Book vs Edit Book

Add Book and Edit Book use the same multi-step page, but they are opened from different places and behave differently.

- Add Book is opened from the Books page for a new title. It includes Step 1: Lookup by ISBN and Step 8: Enter Book Copy Details.
- Edit Book is opened from Book Details for an existing title. It hides the ISBN lookup step and the copy step, then uses save-change button wording.

If you only need one small link update (for example tags only), use Book Details quick actions instead of running the full edit steps.

## Other ways to manage linked data

You can update related information in more than one place.

- Authors: Book Details -> Manage Authors, Author Details -> Books by this author actions, or the authors step in Edit Book.
- Series: Book Details -> Manage Series, Series Details -> Books in this series actions, or the series step in Edit Book.
- Tags: Book Details -> Manage Tags or the tags step in Add Book / Edit Book.
- Publisher and Book Type: usually changed in Edit Book, but can also be created from in-step Add new ... buttons.

## Delete, restore, and permanent delete

Book lifecycle actions are available on Book Details.

- Delete moves the book to the recycle bin (soft delete).
- Restore returns it, with conflict handling (Decline, Merge, Override).
- Delete permanently removes it permanently after typing `DELETE`.

You can access restore in two ways:

1. Account page -> Recycle bin tab -> select item -> Restore selected.
2. Books page -> Advanced filters -> turn on Include deleted -> open deleted book -> Restore.

A restore conflict means the app found an active book that already matches the deleted one:

- Decline: keeps the active match unchanged and leaves the deleted book deleted. Use this when you want to review first. Example: two similar books might not be true duplicates.
- Merge: combines data into the active matching book where possible. Use this when both records represent the same title and you want one final record.
- Override: restores the deleted book over the active match. Use this when the deleted record is the one you trust and want to keep as final.

For full recovery guidance, use [Using the Recycle Bin](/guides/library/recycle-bin).

## Questions

### I am new to the book pages. What is the best order to learn them?

A good order is: Add a book, edit a book, then book details and copies. That sequence matches how most real tasks happen.

Once you are comfortable with those pages, use Browsing Books to speed up filter-based search work.

### When should I use Edit Book instead of Manage Authors, Manage Series, or Manage Tags?

Use Edit Book when you want a full review and several changes in one save pass. It is better for coordinated updates across title, type, publisher, languages, and links.

Use the Manage buttons on Book Details when you only need a quick relationship change.

### Can I keep a book with no copies?

No. The app blocks removing the last copy. On Book Details, trying to remove the final copy shows a validation error.

If you need to replace copy details, edit the copy instead of removing the last one.

### Where do I change publisher, book type, and languages for an existing title?

Use Edit Book from the Book Details page. Those fields are part of the multi-step edit process.

Book Details quick actions are focused on authors, series, tags, and copies.

### What happens right after I delete a book?

The book moves into deleted state and is hidden from normal active views. You can bring it back later from its details page or from the account Recycle bin.

Use include-deleted filters on list pages when you want to locate deleted records from library lists.

### How do restore conflicts work for books?

A conflict appears when a matching active book already exists while restoring a deleted one.

Choose Decline when you want no automatic merge or replacement yet, Merge when both rows are truly the same title and should become one, and Override when the deleted row should replace the current active match.

A safe pattern is: start with Decline, compare records, then run restore again with Merge or Override if needed.

### Where can I restore books if I am cleaning up many records?

Open your account page and use the Recycle bin tab for bulk restore and bulk permanent delete.

That page is usually faster than opening each book one at a time.

### What is the difference between soft delete and permanent delete?

Soft delete means hidden but recoverable. Permanent delete means removed and not recoverable.

If you are unsure, use soft delete first and decide on permanent deletion later.

### Are filters and sort remembered when I leave and return to Books?

Yes. The page keeps your current search, filters, sort, page, and page-size state.

That helps when you refresh or continue working through the same result set.

### I only need to fix one author role on one book. What is the fastest path?

Open that title in Book Details, click Manage Authors, and adjust only that role.

If you are already working from the author side, you can also do it in Author Details under Books by this author.

---

## What's Next?

If you’re on a roll, these pages will keep your book tasks smooth from start to finish.

- [Adding a Book](/guides/library/books-adding-a-book)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Book Details](/guides/library/books-book-details)
- [Managing Book Copies](/guides/library/books-managing-copies)
- [Using the Recycle Bin](/guides/library/recycle-bin)
