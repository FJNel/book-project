# Dewey Dashboard

The Dewey Dashboard lets you browse your Dewey hierarchy in a way that feels similar to Storage Locations.

## What You Can Do

- browse Dewey roots and child nodes
- search by Dewey code or caption
- open a Dewey node and view its breadcrumb path
- see books assigned to that node
- switch between exact-only books and books that include descendants

## How Browsing Works

The dashboard uses your effective Dewey dataset:

- built-in default dataset
- plus your active uploaded overrides, if you have one

Hierarchy is derived from Dewey code prefixes, not from `parent_code`.

That means the dashboard still works even if your uploaded dataset is incomplete.

## Book Modes

### Exact only

Shows only books whose stored `dewey_code` exactly matches the selected node.

### Include descendants

Shows:

- books with the selected Dewey code
- books under narrower Dewey codes that fall within that branch

## Search

Search matches:

- Dewey codes like `510`
- captions like `Mathematics`

Select a search result to open that node in the dashboard.

## Availability

The Dewey Dashboard is only available when Dewey is active for your account.

If the deployment disables Dewey, or if your account has Dewey turned off, the dashboard is hidden from normal navigation.
