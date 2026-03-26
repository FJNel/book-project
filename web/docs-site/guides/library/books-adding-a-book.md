# Adding a Book

Use this guide when you are creating a new title from the Books page.

It explains the full Add Book flow, including ISBN lookup, linked-entity suggestions, first-copy details, and the final review/save process.

## When To Use Add Book

Use Add Book when the title does not exist in your library yet.

This process creates:

- The book record for one specific edition.
- The first physical copy of that book.
- Any approved linked entities you choose to add while completing the form.

If the title already exists, use [Editing a Book](/guides/library/books-editing-a-book) instead.

## What Add Book Does

Add Book is one page with a guided multi-step flow.

1. Step 1: Lookup by ISBN
2. Step 2: Enter Book Details
3. Step 3: Select Book Type
4. Step 4: Add Book Authors
5. Step 5: Add Book Publisher
6. Step 6: Add Book Series
7. Step 7: Add Book Tags
8. Step 8: Enter Book Copy Details
9. Review and Confirm

Step 1 is optional. If you skip ISBN lookup, the rest of the page still works normally.

## Step 1: Lookup by ISBN

ISBN lookup is an optional helper. It can fill in parts of the page for you and may recognise related items you already use, but it does not save the book on its own.

### What ISBN lookup can do

- Prefill core book fields such as title, subtitle, ISBN, publication date, page count, cover image URL, and description.
- Automatically match things you already have in your library, such as authors, publishers, book types, languages, series, or tags, when the match is clear.
- Show contextual suggestion alerts for new related entities that are not yet in your library.

### What ISBN lookup does not do

- It does not save the book.
- It does not create the first copy.
- It does not bypass Review and Confirm.
- It does not auto-create new authors, publishers, series, or book types without your approval.

### How to use it

1. Enter an ISBN-10 or ISBN-13 in Step 1.
2. Click **Lookup ISBN**.
3. Wait while the loading modal shows progress.
4. Review the prefilled fields and any linked-entity suggestions.
5. Continue through the normal Add Book steps.
6. Click **Review and then Add Book**.
7. Click **Confirm and Add Book**.

The book is only created after the final confirmation.

### Loading, progress, timeout, and recovery

While lookup is running:

- a loading modal opens,
- a simulated progress bar advances toward completion,
- the lookup controls are temporarily disabled.

If the lookup succeeds:

- the loading modal closes,
- book fields are prefilled,
- strong existing matches are linked automatically,
- new suggestions appear in the relevant step cards.

If the lookup fails or returns no usable metadata:

- the loading modal closes,
- the ISBN input/button are restored,
- you see a clear warning or error,
- you can continue adding the book manually.

If the lookup does not complete within about 10 seconds:

- it is treated as a timeout,
- the loading modal closes,
- the UI is restored,
- an error explains that the lookup timed out and can be retried.

## Existing Matches And New Suggestions

ISBN lookup can lead to two different kinds of related-item results.

### Existing strong matches

If the app is confident that an author, publisher, book type, series, language, or tag matches something already in your library, it links that existing item automatically.

This is the same as if you had selected it manually yourself.

You will see a status alert in Step 1 summarizing what was auto-linked.

### New suggestions

If the app is not sure, it leaves the item as a suggestion instead of making the choice for you.

Suggestions appear inside the relevant step cards:

- Book Type suggestion alert in Step 3
- Authors suggestion alert in Step 4
- Publisher suggestion alert in Step 5
- Series suggestion alert in Step 6
- Tags suggestion alert in Step 7

This keeps each suggestion close to the part of the form it affects.

For a full ISBN lookup and suggestion guide, see [ISBN Lookup And Suggestions](/guides/library/books-isbn-lookup).

## Step 2: Enter Book Details

These fields describe the edition or version of the book itself, not your personal copy.

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

If Step 1 succeeded, this field is also filled in for you.

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

Behaviour:

- Duplicate language picks are blocked.
- If all available languages are already selected, Add is disabled.
- Languages already available in the app may be selected for you if the match is clear.

### Book Cover Image URL (Optional)

Used for cover display.

Validation:

- Must be a valid `http://` or `https://` address when filled in.

If ISBN lookup finds a usable cover image, this field is filled in and you can still use Preview as normal.

### Book Description (Optional)

Summary text shown on the book page.

Validation:

- Up to 2000 characters.

## Steps 3 To 7: Linked Records

These steps control book type, authors, publisher, series, and tags.

ISBN lookup may affect these sections in two ways:

- clear existing matches may already be linked for you,
- new suggestions may appear in per-card alerts for your approval.

### Book Type

- One book type can be linked.
- Existing strong matches are auto-linked.
- New suggestions appear in the Step 3 alert when available.
- Approving a suggestion adds the book type and selects it immediately.

### Authors

- One or more authors can be linked.
- Existing strong matches are auto-linked into the author list.
- New author suggestions appear in the Step 4 alert.
- Each suggested author can include role and richer author details.
- Approving a suggestion adds the author and links them to the book.

### Publisher

- One publisher can be linked.
- Existing strong matches are auto-linked.
- New publisher suggestions appear in the Step 5 alert.
- Approving a suggestion adds the publisher and selects it immediately.

### Series

- A book can belong to one or more series.
- Existing strong matches are auto-linked.
- New series suggestions appear in the Step 6 alert.
- Suggested series may include book order in the series.

### Tags

- Tags can overlap freely.
- Existing strong tag matches are linked automatically.
- New tag suggestions appear in the Step 7 alert as suggestion pills.
- Approving a tag suggestion adds it into the normal tags list.

## Step 8: Enter Book Copy Details

This step captures details for your first physical copy of the book.

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

## Review And Save

ISBN lookup does not change how the book is saved.

You still save the book the usual way:

1. Review the combined data.
2. Confirm the add action.
3. Save the book and its first copy.

That means:

- prefilled fields are still editable,
- automatically matched items are treated like normal selections,
- approved suggestions become part of the book before review,
- rejected suggestions are simply dismissed and are not saved.

## Other Ways To Manage These Details Later

After saving, use Book Details for focused updates:

- Manage Authors
- Manage Series
- Manage Tags
- Add Copy and Edit Copy

Use Edit Book when you want a full book-information pass later.

## Questions

### Is ISBN Lookup Required?

No. You can add books without using lookup.

Step 1 is optional, and the rest of Add Book still works as a manual flow.

### Can I Add a Book Without an ISBN?

Yes. ISBN is optional.

You can still save the book if required fields pass validation.

### What Happens If the Lookup Finds Existing Authors Or a Publisher I Already Have?

Strong existing matches are linked automatically into the normal Add Book form.

You do not need to approve those again as “new” suggestions.

### What Happens If the Lookup Suggests a New Author, Publisher, Series, or Book Type?

The suggestion appears in the relevant step card.

You can:

- approve it, which creates and links it,
- reject it, which dismisses only that suggestion.

### Are Suggested Entities Saved Automatically?

No.

Only strong existing matches are auto-linked. New unmatched suggestions require your approval first.

### What Happens If the Lookup Times Out?

After 10 seconds, the lookup stops, the loading modal closes, and the page returns to a usable state.

You can retry the lookup or continue entering the book manually.

### What Are the Most Important Fields To Confirm Before Saving?

Always confirm title, type, author links, and first-copy location.

Those fields have the biggest impact on later search and cleanup work.

### Can I Add Related Records While Adding the Book?

Yes. You can create missing Author, Publisher, Series, Book Type, and Storage Location entries from this page.

ISBN suggestions use those same normal creation/linking flows after approval.

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

### Can I Add a Dewey Decimal Code While Adding a Book?

Yes. Dewey Code is optional in Phase 1.

If the Dewey dataset is available, the page interprets the code instantly on the page itself and shows the matched caption and hierarchy path.

If the dataset is temporarily unavailable, you can still save a valid Dewey-shaped code manually.

### What Happens Right After Confirm And Add Book?

You are taken to that book’s details page.

Use that page to verify links and add extra copies.

### What Is the Fastest Way To Avoid Validation Mistakes?

Work step by step and pause on the review step before final confirm.

Check dates, series order, and optional text lengths in particular, because those are common error points.

---

## What's Next?

If you are ready to refine what you just added, these guides are great next steps.

- [ISBN Lookup And Suggestions](/guides/library/books-isbn-lookup)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Book Details](/guides/library/books-book-details)
- [Managing Book Copies](/guides/library/books-managing-copies)
- [Browsing Books](/guides/library/books-browsing-books)
- [Using Partial Dates](/guides/library/partial-dates)
