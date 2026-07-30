# Phase 6A — Stock Adjustment Requirements and Firestore Schema

## 1. Purpose

Stock Adjustment corrects a verified difference between the quantity recorded by the system and the quantity found during a physical count.

Use it for:

- physical count corrections;
- encoding errors;
- damaged or expired stock discovered during counting;
- unrecorded stock found;
- verified loss or shortage;
- unit-conversion corrections.

Do not use it for:

- supplier deliveries;
- purchase-order receiving;
- normal stock releases;
- internal-use releases;
- transfers;
- customer sales.

Those transactions must continue to use Stock In, Goods Receiving, Stock Out, or the future POS module.

---

## 2. Quantity calculation

The request records:

```text
quantityDifference =
actualCountedQuantity - systemQuantityAtRequest
```

Examples:

```text
System quantity: 100
Actual count:     96
Difference:       -4
Direction:        OUT
```

```text
System quantity: 50
Actual count:     53
Difference:       +3
Direction:        IN
```

A difference of `0` is not a valid Stock Adjustment.

All inventory quantities remain non-negative whole numbers.

---

## 3. Posting policy

A request stores the system quantity that existed when the physical count was entered.

Stock may change before an administrator reviews the request. To avoid overwriting valid Stock In or Stock Out movements, posting uses:

```text
postedNewQuantity =
currentProductQuantity + quantityDifference
```

It does not blindly set the Product quantity to the old counted quantity.

Example:

```text
Quantity when counted: 100
Actual count:           96
Difference:             -4

A valid Stock Out of 2 happens before approval.

Current quantity:       98
Posted adjustment:      -4
New quantity:           94
```

The review page must display a stale-request warning when:

```text
currentProductQuantity != systemQuantityAtRequest
```

Posting must be blocked when the calculated new quantity would be below zero or above the configured maximum.

---

## 4. Workflow

```text
Draft in browser
    ↓
Submit request
    ↓
SUBMITTED
    ├── Reject  → REJECTED
    ├── Cancel  → CANCELLED
    └── Approve and post atomically
            ↓
          POSTED
```

`DRAFT` is client-side only and is not stored in Firestore.

`APPROVED` is reserved for a future split approval/posting workflow. Phase 6D should normally approve and post in one atomic transaction.

---

## 5. Role permissions

| Role | Create request | Review | Approve and post | Cancel any request | View history |
|---|---:|---:|---:|---:|---:|
| SUPERADMIN | Yes | Yes | Yes | Yes | Yes |
| ADMIN | Yes | Yes | Yes | Yes | Yes |
| INVENTORY_STAFF | Yes | No | No | No | Yes |
| AUDITOR | No | No | No | No | Yes |
| CASHIER | No | No | No | No | No |

Additional policy:

- The original requester may cancel their own `SUBMITTED` request.
- An Administrator may not approve their own request.
- A Super Administrator may approve their own request for emergency administration.
- Rejection and cancellation require a reason.
- Posted, rejected, and cancelled requests are final.

---

## 6. Collections

### 6.1 Stock Adjustment requests

```text
stockAdjustmentRequests/{adjustmentId}
```

Example submitted request:

```js
{
  adjustmentId: "stockadj_...",
  createOperationId: "stockadj_create_...",
  status: "SUBMITTED",

  productId: "product-id",
  productName: "Water Meter",
  productSku: "WAME-001",
  barcode: "optional",

  category: "WATER METERS",
  categoryCode: "optional",

  unitCode: "PCS",
  unitName: "Pieces",
  unitAbbreviation: "pc",

  systemQuantityAtRequest: 100,
  actualCountedQuantity: 96,
  quantityDifference: -4,
  adjustmentDirection: "OUT",

  unitCostAtRequest: 250,
  estimatedAdjustmentValue: 1000,

  reason: "PHYSICAL_COUNT_CORRECTION",
  referenceNumber: "COUNT-2026-001",
  countDate: "2026-07-29",
  remarks: "Physical count in main storage.",

  requestedBy: "firebase-auth-uid",
  requestedByName: "Inventory Staff",
  createdBy: "firebase-auth-uid",

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

After successful posting, the same request is updated atomically:

```js
{
  status: "POSTED",

  approvedBy: "reviewer-uid",
  approvedByName: "Administrator",
  approvedAt: serverTimestamp(),

  postedOperationId: "stockadj_post_...",
  movementId: "stockadj_post_...",

  postedPreviousQuantity: 98,
  postedNewQuantity: 94,
  postedUnitCost: 250,
  postedTotalValue: 1000,
  postedAt: serverTimestamp(),

  updatedAt: serverTimestamp()
}
```

Rejected request fields:

```js
{
  status: "REJECTED",
  rejectedBy: "reviewer-uid",
  rejectedByName: "Administrator",
  rejectedAt: serverTimestamp(),
  rejectionReason: "Count sheet is incomplete.",
  updatedAt: serverTimestamp()
}
```

Cancelled request fields:

```js
{
  status: "CANCELLED",
  cancelledBy: "user-uid",
  cancelledByName: "Inventory Staff",
  cancelledAt: serverTimestamp(),
  cancellationReason: "A recount is required.",
  updatedAt: serverTimestamp()
}
```

---

### 6.2 Permanent Stock Movement

A movement is created only when the request is posted successfully.

```text
stockMovements/{movementId}
```

Recommended rule:

```text
movementId = postedOperationId
```

Example:

```js
{
  movementId: "stockadj_post_...",
  operationId: "stockadj_post_...",
  adjustmentId: "stockadj_...",

  movementType: "OUT",
  reason: "STOCK_ADJUSTMENT",
  adjustmentReason: "PHYSICAL_COUNT_CORRECTION",
  adjustmentDirection: "OUT",

  productId: "product-id",
  productName: "Water Meter",
  productSku: "WAME-001",

  quantity: 4,
  quantityDifference: -4,
  previousQuantity: 98,
  newQuantity: 94,

  unitCost: 250,
  totalCost: 1000,

  referenceNumber: "COUNT-2026-001",
  countDate: "2026-07-29",
  remarks: "Physical count in main storage.",

  requestedBy: "requester-uid",
  requestedByName: "Inventory Staff",

  approvedBy: "reviewer-uid",
  approvedByName: "Administrator",

  createdBy: "reviewer-uid",
  createdAt: serverTimestamp()
}
```

For a positive adjustment:

```text
movementType = IN
quantityDifference > 0
quantity = absolute value of quantityDifference
```

For a negative adjustment:

```text
movementType = OUT
quantityDifference < 0
quantity = absolute value of quantityDifference
```

Movement documents are permanent and immutable.

---

### 6.3 Immutable operation records

```text
stockAdjustmentOperations/{operationId}
```

Operation types:

```text
CREATE_REQUEST
POST_ADJUSTMENT
REJECT_REQUEST
CANCEL_REQUEST
```

Create-request operation:

```js
{
  operationId: "stockadj_create_...",
  operationType: "CREATE_REQUEST",
  operationStatus: "COMPLETED",

  adjustmentId: "stockadj_...",
  productId: "product-id",

  actualCountedQuantity: 96,
  quantityDifference: -4,
  adjustmentDirection: "OUT",
  reason: "PHYSICAL_COUNT_CORRECTION",
  referenceNumber: "COUNT-2026-001",

  performedBy: "requester-uid",
  performedByName: "Inventory Staff",

  createdBy: "requester-uid",
  createdAt: serverTimestamp()
}
```

Post operation:

```js
{
  operationId: "stockadj_post_...",
  operationType: "POST_ADJUSTMENT",
  operationStatus: "COMPLETED",

  adjustmentId: "stockadj_...",
  movementId: "stockadj_post_...",
  productId: "product-id",

  previousQuantity: 98,
  newQuantity: 94,

  quantity: 4,
  quantityDifference: -4,
  adjustmentDirection: "OUT",

  unitCost: 250,
  totalCost: 1000,

  performedBy: "reviewer-uid",
  performedByName: "Administrator",

  createdBy: "reviewer-uid",
  createdAt: serverTimestamp()
}
```

Operation documents are immutable and provide idempotency for retried actions.

---

## 7. Atomic posting requirement

Phase 6D must post these writes in one Firestore transaction:

```text
1. Read stockAdjustmentRequests/{adjustmentId}
2. Read products/{productId}
3. Confirm request status is SUBMITTED
4. Confirm Product is ACTIVE
5. Recalculate the posted balance
6. Update products/{productId}
7. Update stockAdjustmentRequests/{adjustmentId} to POSTED
8. Create stockMovements/{movementId}
9. Create stockAdjustmentOperations/{operationId}
```

The transaction must fail completely when any validation fails.

---

## 8. Product update fields

When posting succeeds, update the Product document with:

```js
{
  quantity: postedNewQuantity,

  lastStockMovementId: movementId,
  lastStockMovementType: "IN" | "OUT",
  lastStockMovementReason: "STOCK_ADJUSTMENT",
  lastStockMovementAt: serverTimestamp(),
  lastStockMovementBy: reviewerUid,

  updatedAt: serverTimestamp(),
  updatedBy: reviewerUid
}
```

Direct quantity editing outside the approved Stock In, Stock Out, Goods Receiving, and Stock Adjustment transaction paths must remain blocked by Firestore Rules.

---

## 9. Reason and direction restrictions

| Reason | Allowed direction |
|---|---|
| PHYSICAL_COUNT_CORRECTION | IN or OUT |
| ENCODING_ERROR | IN or OUT |
| DAMAGED_FOUND_DURING_COUNT | OUT only |
| EXPIRED_FOUND_DURING_COUNT | OUT only |
| UNRECORDED_STOCK_FOUND | IN only |
| LOSS_OR_SHORTAGE | OUT only |
| UNIT_CONVERSION_CORRECTION | IN or OUT |
| OTHER | IN or OUT |

---

## 10. Phase 6A completion criteria

Phase 6A is complete when:

- `src/constants/stockAdjustment.js` is added;
- adjustment statuses, reasons, directions, permissions, and limits are defined;
- ID generators and validation helpers are available;
- the request, movement, and operation schemas are documented;
- the signed-difference posting policy is accepted;
- no page, service, route, or Firestore Rules change is claimed yet.
