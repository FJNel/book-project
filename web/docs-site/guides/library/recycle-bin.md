# Using the Recycle Bin

Use this guide to restore deleted library items or permanently remove them.

It explains where Recycle bin lives, how conflict handling works, and how bulk actions behave.

## What Is Recycle Bin?

Recycle bin is on the Account page. It shows items that were deleted but are still recoverable.

In this area:

- Delete means the item is moved to deleted state and can be restored.
- Delete permanently means the item is removed for good and cannot be recovered.

## Where To Find It

1. Open Account.
2. Select the Recycle bin tab.
3. Use the Deleted items table.

## Item Types Shown

Recycle bin currently lists these types:

- Books.
- Book Types.
- Authors.
- Publishers.
- Series.

## Filters And Selection

### Type Checkboxes

Use the type checkboxes to show or hide rows by type.

Behavior:

- Checked types are included.
- Unchecked types are hidden.
- If all types are unchecked, the table appears empty.

### Refresh

Refresh reloads deleted items from the server and keeps the newest deleted items first.

### Row Selection and Select all

Use row checkboxes to select items for bulk restore or permanent delete.

Select all affects visible rows only.

Important behavior:

- If you select rows and then hide their type with checkboxes, those hidden rows stay selected until you clear selection or refresh.

### Row Action Buttons

Each row has:

- Restore button for that one row.
- Delete permanently button for that one row.

You can also click a row to open the item’s details page.

## Sort And Pagination in Recycle Bin

- Rows are sorted by Deleted date (newest first).
- There is no page-size control.
- There is no page navigation control.

## Restore From Recycle Bin

1. Select one or more rows.
2. Click Restore selected.
3. Choose a Conflict handling option.
4. Click Restore.

Restored rows leave the deleted list and become active again.

## Restore From List Pages

You can also restore by opening deleted items from their normal list pages:

1. Open Books, Authors, Publishers, Series, or Book Types.
2. Open Advanced filters.
3. Turn on include-deleted for that page.
4. Apply filters.
5. Open the deleted item.
6. Click Restore on the details page.

## Restore Conflicts: How To Choose

A restore conflict happens when an active item already exists that matches the deleted item.

### Decline

What it does:

- Keeps the active item unchanged.
- Leaves the deleted item in deleted state.

When to choose it:

- You are unsure which version should win.
- You want the safest no-change option first.

Example:

- A deleted author and an active author look similar, but you need to compare them first.

### Merge

What it does:

- Combines details into the active matching item where possible.

When to choose it:

- Both rows represent the same real item.
- You want one combined final item.

Example:

- A deleted series has extra notes, while the active duplicate has newer links.

### Override

What it does:

- Restores the deleted item over the active matching item.

When to choose it:

- The deleted version is the one you trust.
- The active matching row should be replaced.

Example:

- You accidentally deleted the richer book entry and later created a minimal duplicate.

## Permanent Delete

1. Select one or more rows.
2. Click Delete permanently.
3. Type `DELETE`.
4. Confirm Delete permanently.

Permanent delete cannot be undone.

## Questions

### What Is the Difference Between Delete and Delete Permanently?

Delete is recoverable through restore.

Delete permanently is final.

### Which Restore Option Is Safest If I Am Not Sure?

Use Decline first.

It keeps active data unchanged and lets you review before applying Merge or Override.

### Can I Restore More Than One Item at a Time?

Yes. Select multiple rows and use Restore selected.

Your selected conflict mode is applied to that restore run.

### Can I Permanently Delete More Than One Item at a Time?

Yes. Select multiple rows, choose Delete permanently, type `DELETE`, and confirm.

Double-check your selection first because this cannot be reversed.

### Why Does the Table Look Empty?

Most often, type checkboxes are all off or your selected type has no deleted rows.

Turn type checkboxes back on or click Refresh.

### Why Did an Item Stay Selected After I Hid Its Type?

Selection is kept until you clear it or refresh.

Hiding a type only changes visibility, not selection state.

### Why Did Restore Show a Conflict Message?

A matching active item already exists.

Pick Decline, Merge, or Override based on whether you want no change, combine, or replace.

### Where Else Can I Restore a Single Item?

You can restore directly from that item’s details page after enabling include-deleted on its list page.

Use Recycle bin when you want one place for multi-item cleanup.

### Is There a Reset Filters Button Here?

No. Recycle bin does not have a reset-filters button.

To reset view quickly, re-enable all type checkboxes.

### What Should I Review After a Big Restore?

Open a few restored items and confirm names, links, and status look correct.

If conflicts were involved, verify the final data before moving on.

---

## What's Next?

If you just recovered records, these guides help you verify and tidy them quickly.

- [Book Details](/guides/library/books-book-details)
- [Managing Authors (Full Guide)](/guides/library/authors-managing-authors)
- [Managing Publishers](/guides/library/publishers-managing-publishers)
- [Managing Series](/guides/library/series-managing-series)
- [Managing Book Types](/guides/library/book-types-managing-book-types)
