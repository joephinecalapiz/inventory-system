# Phase 6F - Route, Sidebar, Topbar, and Role Integration

This package contains only Phase 6F files.

## Routes added

```text
/stock-adjustments
/stock-adjustments/review
/stock-adjustments/history
```

## Sidebar items added

```text
Stock Adjustments
Adjustment Review
Adjustment History
```

## Topbar titles added

```text
Stock Adjustments
Stock Adjustment Review
Stock Adjustment History
```

## Role access

### Stock Adjustments

```text
SUPERADMIN
ADMIN
INVENTORY_STAFF
AUDITOR
```

### Adjustment Review

```text
SUPERADMIN
ADMIN
```

### Adjustment History

```text
SUPERADMIN
ADMIN
INVENTORY_STAFF
AUDITOR
```

Cashier is denied from all Stock Adjustment routes.

## Phase boundary

This ZIP does not include Phase 6A, 6B, 6C, 6D, or 6E files.

Install those phases first, then install this Phase 6F package.
