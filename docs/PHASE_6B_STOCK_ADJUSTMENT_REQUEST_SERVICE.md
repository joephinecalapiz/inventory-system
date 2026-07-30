# Phase 6B — Stock Adjustment Request Service

## Purpose

Phase 6B creates the service used to submit a Stock Adjustment request.

It does not change Product stock.

It creates these linked documents atomically:

```text
stockAdjustmentRequests/{adjustmentId}
stockAdjustmentOperations/{createOperationId}
```

## Main API

```js
createStockAdjustmentRequest(stockAdjustmentData);
subscribeToStockAdjustmentRequests(onData, onError);
getStockAdjustmentRequest(adjustmentId);
```

## Required input

```js
{
  adjustmentId: "stockadj_...",
  createOperationId: "stockadj_create_...",
  productId: "product-document-id",
  actualCountedQuantity: 96,
  reason: "PHYSICAL_COUNT_CORRECTION",
  referenceNumber: "COUNT-2026-001",
  countDate: "2026-07-29",
  remarks: "Physical count in main storage."
}
```

## Validation performed

The service verifies:

- the user is signed in;
- the Firestore user profile exists;
- the profile is ACTIVE;
- the role is SUPERADMIN, ADMIN, or INVENTORY_STAFF;
- IDs are valid and safe Firestore document IDs;
- the Product exists;
- the Product is ACTIVE;
- the Product stock is a valid non-negative whole number;
- actual count is a valid non-negative whole number;
- the difference is not zero;
- the reason matches the IN or OUT direction;
- the count date is valid and not in the future;
- reference and remarks lengths are valid;
- the estimated value is within limits.

## Idempotency

The create-operation document is read before other request work.

Reusing the same operation ID with identical request data returns the stored request as:

```js
{
  isReplay: true;
}
```

Reusing the same operation ID with different data is rejected.

## No stock mutation

Phase 6B intentionally does not write:

```text
products/{productId}
stockMovements/{movementId}
```

Stock changes belong to Phase 6D after approval.

## Firestore Rules note

This package does not modify `firestore.rules`.

The existing rules may deny request creation until Phase 6G adds the secured Stock Adjustment rule set.
