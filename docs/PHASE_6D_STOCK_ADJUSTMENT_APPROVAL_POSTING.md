# Phase 6D - Stock Adjustment Approval and Posting

Phase 6D adds the review page and the atomic approval workflow.

## Service actions

```js
approveAndPostStockAdjustment(...)
rejectStockAdjustmentRequest(...)
cancelStockAdjustmentRequest(...)
```

## Approve and post transaction

The service atomically:

1. validates the submitted request;
2. validates an active Superadmin or Admin reviewer;
3. blocks Admin self-approval;
4. reads the current Product balance;
5. requires confirmation when the request is stale;
6. applies the saved difference to the current Product quantity;
7. updates the Product and movement summary fields;
8. marks the request as POSTED;
9. creates a permanent Stock Movement;
10. creates an immutable post operation.

## Reject and cancel

Rejecting or cancelling requires a reason, creates an immutable decision
operation, and does not change Product stock.

## Phase boundary

This package does not modify App.jsx, Sidebar.jsx, Topbar.jsx, or
firestore.rules. Routes and navigation belong to Phase 6F. Firestore
security belongs to Phase 6G.
