# Phase 6C — Stock Adjustment Request Page

## New page

```text
src/pages/StockAdjustments.jsx
```

## New stylesheet

```text
src/styles/StockAdjustments.css
```

## Page functions

The page:

- subscribes to active Products;
- supports search by Product name, SKU, barcode, category, or unit;
- allows selecting Products with any non-negative stock balance, including zero;
- displays Product category, unit, cost price, and system quantity;
- accepts the actual physical count;
- automatically calculates the signed quantity difference;
- automatically determines IN or OUT direction;
- filters adjustment reasons according to direction;
- calculates the estimated cost value;
- validates count date, reference length, and remarks length;
- shows a confirmation modal before submitting;
- calls the Phase 6B request service;
- displays a success summary;
- gives Auditor accounts read-only Product access.

## Role behaviour

Request creation:

```text
SUPERADMIN
ADMIN
INVENTORY_STAFF
```

Read-only Product view:

```text
AUDITOR
```

No page access should be granted to Cashier once Phase 6F adds routing.

## Important Phase boundary

Phase 6C does not add:

```text
App.jsx route
Sidebar item
Topbar title
Approval page
History page
Firestore Rules
```

Route and navigation integration belong to Phase 6F.

The current Firestore Rules may deny request submission until Phase 6G.
