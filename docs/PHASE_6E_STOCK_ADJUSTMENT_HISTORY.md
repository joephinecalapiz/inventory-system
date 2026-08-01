# Phase 6E - Stock Adjustment History and Detail View

## History page

```text
/stock-adjustments/history
```

The page displays:

- submitted requests;
- posted adjustments;
- rejected requests;
- cancelled requests;
- system quantity at request;
- actual physical count;
- signed difference;
- posted previous and new quantities;
- request reason;
- requester and reviewer;
- count and finalization dates;
- estimated or posted value;
- create operation;
- final operation;
- permanent Stock Movement.

## Filters

```text
Search
Status
Reason
Product
Count Date From
Count Date To
```

## Immutable detail view

History is read-only. The page has no edit or delete action.

Posted records can load:

```text
stockAdjustmentRequests/{adjustmentId}
stockAdjustmentOperations/{createOperationId}
stockAdjustmentOperations/{postedOperationId}
stockMovements/{movementId}
```

Rejected and cancelled requests created after Phase 6E store:

```text
rejectedOperationId
cancelledOperationId
```

Older rejected or cancelled requests may not have these link fields, but their request audit information remains visible.

## Catch-up integration

Phase 6F was installed before Phase 6E. Therefore this package preserves Phase 6F and adds:

```text
Route
Sidebar item
Topbar title
```

for the history page.

## Security boundary

This package does not modify `firestore.rules`.

Read authorization and collection hardening remain part of Phase 6G.
