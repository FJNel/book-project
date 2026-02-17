# Managing Storage Locations

Use Storage Locations to organize where your physical copies are stored. This page supports a nested location tree, location maintenance actions, and a built-in books panel for the selected location.

## What is a storage location?

A storage location is a place in your real-world storage hierarchy.

Examples:

- Home
- `Home -> Study`
- `Home -> Study -> Top Shelf`

You assign book copies to these locations so you can find physical items quickly.

## When to use this guide

Use this guide when you need to:

- Create a new location tree
- Add nested locations under an existing location
- Move a location to another parent
- Review books in one location or its sub-locations
- Remove old locations safely

## Steps to manage locations

1. Open Storage Locations.
2. Click Add a new base location for top-level locations.
3. Select a location and click Add a location nested in this location for children.
4. Use Edit to update name or notes.
5. Use Move to change parent location.
6. Use Delete when removing a location and subtree.

## Form fields and validation

### On the Storage Locations page dialogs

These are the dedicated dialogs on this page (Add location, Edit location):

- Name (required): 2 to 120 characters, supported characters only
- Notes (optional): up to 500 characters

### In quick create dialogs from book pages

When you click Add new Storage Location inside book forms, the shared dialog has different limits:

- Location Name: 2 to 150
- Notes: up to 2000

If you see different limits between pages, this is why.

## Filters and Search

### Search locations

- Meaning: narrows the location tree by location name or full path text
- Logic: contains match (case-insensitive) against both name and path
- Blank behavior: blank search shows the full tree again
- Examples:
- study finds locations with study in name or path
- `home -> garage` finds matching path text
- Edge case: matching parent locations auto-expand so child matches are visible

### Clear next to Search locations

- Meaning: clears the tree search text quickly
- Logic: resets the search box to empty and redraws the full tree
- Blank behavior: if already blank, it keeps full-tree view
- Examples:
- Clear after study restores all location rows
- Clear after shelf restores all branches

### Direct only and Include sub-locations

- Meaning:
- Direct only shows books with copies linked exactly to the selected location
- Include sub-locations shows books linked to the selected location or any child location
- Logic:
- Direct only uses exact location match
- Include sub-locations uses recursive subtree matching
- Blank behavior: one mode is always active when a location is selected
- Examples:
- Select `Home -> Study` with Direct only to see only copies directly in Study
- Switch to Include sub-locations to include `Home -> Study -> Top Shelf` copies too
- Edge case: switching modes resets the books list to page 1

### Sort books

- Meaning: changes result ordering in the books panel for the selected location
- Logic:
- Title A to Z and Title Z to A use title ordering
- Newest published and Oldest published use publication-date ordering
- Newest added and Oldest added use created-date ordering
- When Include sub-locations is active, the sort list also shows Most books and Fewest books
- In the current version, Most books and Fewest books behave the same as title sorting
- Blank behavior: defaults to title ascending
- Examples:
- Choose Newest published to see newest publications first
- Choose Title Z to A for reverse title order
- Edge case: changing sort resets books to page 1

### Per page

- Meaning: number of books shown per page in the books panel
- Logic: integer value clamped between 2 and 50
- Blank behavior: empty or invalid input is corrected to a valid value
- Examples:
- Set `20` to show up to 20 books per page
- Set `2` for a compact review page
- Edge case: changing this value resets to page 1

### How location filters combine

- Location selection itself is the base filter
- Tree search only controls which locations are visible in the left tree
- Books panel controls (Direct only/Include sub-locations, sort, and per-page) apply to the selected location’s books list

### Pagination behavior

- Pagination applies to the selected location’s full matching result set
- Changing location, mode, sort, or per-page resets to page 1

### Expand/collapse controls

- Expand all opens all branches in the tree
- Collapse all closes all branches
- These buttons do not change books filters; they only change tree visibility

## Delete behavior on this page

Delete location on this page is a typed-confirmation action (Type `DELETE` to confirm).

Important behavior shown in the delete message:

- Selected location and subtree are deleted
- Books are unlinked from that location
- Book data is retained

### Soft delete vs permanent delete for locations

For storage locations on this page, there is no separate recycle-bin restore action in current user-facing screens.

That means deletion here should be treated as direct removal from the location tree. For recycle-bin steps on other record types, see [Using the Recycle Bin](/guides/library/recycle-bin).

## Questions

### How many nested levels can I create?

You can keep nesting as needed by selecting a location and adding a child.

Build the depth that matches your real storage setup.

### What is the difference between Direct only and Include sub-locations?

Direct only shows books linked exactly to the selected node. Include sub-locations also includes all descendant nodes.

Use Direct only for tight shelf checks, and subtree mode for room-level totals.

### Can I add a child location from the right panel?

Yes. Select a location and click Add a location nested in this location.

That new location is created under the selected parent.

### Can I move a location to a different parent later?

Yes. Use Move, pick New parent, then confirm.

Review path changes afterward with the breadcrumb panel.

### Does deleting a location delete books?

No. The delete dialog states books are unlinked while data is retained.

You can reassign those copies to new locations later.

### Can I restore a deleted storage location from Recycle bin?

There is no storage-location restore action in the account Recycle bin in current user-facing pages.

Plan location deletes carefully because the tree node is removed.

### Why is the delete button disabled?

The delete confirm button enables only after you type `DELETE`.

This prevents accidental removal of location branches.

### How do I find one location in a large tree quickly?

Use Search locations, then click the matching location row.

Expand all can help if you want to inspect surrounding branches.

### Can I open book details from the location books list?

Yes. Books in the panel are clickable and open the corresponding book details page.

That is helpful when auditing copy placement.

### Should I create locations from book pages or from this page?

Use book pages for quick one-off location creation while adding or editing a copy. Use Storage Locations page for structure work, moves, and cleanup.

Choose based on whether your focus is one copy or the full tree.

---

## What's Next?

If your location tree is improving, these guides help keep copy and title records aligned with it.

- [Managing Book Copies](/guides/library/books-managing-copies)
- [Book Details](/guides/library/books-book-details)
- [Adding a Book](/guides/library/books-adding-a-book)
- [Editing a Book](/guides/library/books-editing-a-book)
- [Using the Recycle Bin](/guides/library/recycle-bin)
