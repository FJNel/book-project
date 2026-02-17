# Adding a Book

Use this guide when you are creating a new title from the Books page.

It explains each step on Add Book, including first-copy details and common validation problems.

## When To Use Add Book

Use Add Book when the title does not exist in your library yet.

This process creates:

- The book information (title, ISBN, description, links).
- The first physical copy and its acquisition details.

If the title already exists, use [Editing a Book](/guides/library/books-editing-a-book) instead.

## Steps To Add a Book

1. Open Books.
2. Click Add Book.
3. Review Step 1: Lookup by ISBN.
4. Complete Step 2: Enter Book Details.
5. Choose a type in Step 3: Select Book Type.
6. Add links in Step 4: Add Book Authors, Step 5: Add Book Publisher, Step 6: Add Book Series, and Step 7: Add Book Tags.
7. Fill first-copy fields in Step 8: Enter Book Copy Details.
8. Click Review and then Add Book.
9. Click Confirm and Add Book.

## Important Note About ISBN Lookup

Step 1: Lookup by ISBN is visible, but the ISBN input and Lookup ISBN button are currently disabled on this page.

Add Book currently works as a manual entry process.

## Field Guidance And Validation

## Step 2: Enter Book Details

### Title (Required)

Main title shown in lists and details.

Validation:

- Required.
- 2 to 255 characters.
- Supported title characters only.

### Subtitle (Optional)

Secondary title text shown with the main title.

Validation:

- Optional.
- Up to 255 characters.
- Supported title characters only.

### ISBN (Optional)

Edition identifier.

Validation:

- Optional.
- Must be a valid ISBN-10 or ISBN-13 when filled in.

### Publication Date (Optional)

Publication timing for this edition.

Partial dates are supported. See [Using Partial Dates](/guides/library/partial-dates).

### Number of Pages (Optional)

Used in filters and sorting.

Validation:

- Whole number.
- 1 to 10000.

### Book Language(s) (Optional)

Choose one or more languages and click Add for each one.

Behavior:

- Duplicate language picks are blocked.
- If all available languages are already selected, Add is disabled.

### Book Cover Image URL (Optional)

Used for cover display.

Validation:

- Must be a valid `http://` or `https://` address when filled in.

### Book Description (Optional)

Summary text shown on the book page.

Validation:

- Up to 2000 characters.

## Linked Steps

- Author custom role (Other): 2 to 100 characters.
- Series order: whole number from 1 to 10000.
- Tags: 2 to 50 characters, must include at least one letter, and cannot duplicate on the same book.

## Step 8: Enter Book Copy Details

### Storage Location

Choose where this physical copy is kept.

Use Add new Storage Location if the location is missing.

### Acquisition Date

Optional. Partial dates are supported.

### Acquired From

Optional source name (person, shop, donor).

Validation:

- Up to 255 characters.
- Supported text characters only.

### Acquisition Type

Optional type such as purchase or gift.

Validation:

- Up to 100 characters.
- Supported text characters only.

### Acquisition Location

Optional place where you got the copy.

Validation:

- Up to 255 characters.
- Supported text characters only.

### Acquisition Story and Other Notes or Details

Optional copy notes.

Validation:

- Up to 2000 characters each.

## Other Ways To Manage These Details Later

After saving, use Book Details for focused updates:

- Manage Authors.
- Manage Series.
- Manage Tags.
- Add Copy and Edit Copy.

Use Edit Book when you want a full book-information pass.

## Questions

### Is ISBN Lookup Required?

No. You can add books without using lookup.

At the moment, the lookup controls are disabled, so all entries are manual.

### Can I Add a Book Without an ISBN?

Yes. ISBN is optional.

You can still save the book if required fields pass validation.

### What Are the Most Important Fields To Confirm Before Saving?

Always confirm title, type, author links, and first-copy location.

Those fields have the biggest impact on later search and cleanup work.

### Can I Add Related Records While Adding the Book?

Yes. You can create missing Author, Publisher, Series, Book Type, and Storage Location entries from this page.

The new values become reusable in other parts of the app.

### Why Is the Review Button Not Proceeding?

One or more fields still have validation errors.

Check inline help text, fix the highlighted fields, then review again.

### Can I Save a Draft and Finish Later?

No. This page does not have a draft save option.

The book is created only after Confirm and Add Book.

### Does Add Book Always Create a Copy?

Yes. This process includes first-copy entry in Step 8.

If you need more copies, add them later from Book Details.

### How Do I Fix a Wrong Author Role or Series Order After Save?

Open Book Details and use Manage Authors or Manage Series.

For broader changes, use Edit Book.

### What Happens Right After Confirm and Add Book?

You are taken to that book’s details page.

Use that page to verify links and add extra copies.

### What Is the Fastest Way To Avoid Validation Mistakes?

Work step by step and pause on the review step before final confirm.

Check dates, series order, and optional text lengths in particular, because those are common error points.

---

## What's Next?

If you are ready to refine what you just added, these guides are great next steps.

- [Editing a Book](/guides/library/books-editing-a-book)
- [Book Details](/guides/library/books-book-details)
- [Managing Book Copies](/guides/library/books-managing-copies)
- [Browsing Books](/guides/library/books-browsing-books)
- [Using Partial Dates](/guides/library/partial-dates)
