# Phase 6G - Firestore Rules and Security Hardening

## Collections secured

```text
stockAdjustmentRequests/{adjustmentId}
stockAdjustmentOperations/{operationId}
stockMovements/{movementId}
products/{productId}
```

## Request creation

A valid request must atomically create:

```text
stockAdjustmentRequests/{adjustmentId}
stockAdjustmentOperations/{createOperationId}
```

The rules verify:

- active authenticated user;
- allowed role;
- active Product;
- Product name, SKU, quantity, and cost snapshot;
- non-zero signed quantity difference;
- valid IN or OUT direction;
- reason-direction compatibility;
- count date not in the future;
- reference and remarks limits;
- requester identity;
- server timestamps;
- linked immutable create operation.

## Approval and posting

A valid post must atomically write:

```text
products/{productId}
stockAdjustmentRequests/{adjustmentId}
stockMovements/{postOperationId}
stockAdjustmentOperations/{postOperationId}
```

The rules verify matching:

- adjustment ID;
- Product ID;
- quantity difference;
- previous and new quantity;
- movement quantity;
- movement direction;
- unit cost;
- total value;
- reviewer identity;
- server timestamps;
- movement ID and operation ID.

## Role policy

| Action                   | Roles                                       |
| ------------------------ | ------------------------------------------- |
| Create request           | SUPERADMIN, ADMIN, INVENTORY_STAFF          |
| Approve and post         | SUPERADMIN, ADMIN                           |
| Reject or cancel         | SUPERADMIN, ADMIN                           |
| Read request history     | SUPERADMIN, ADMIN, INVENTORY_STAFF, AUDITOR |
| Get linked operations    | SUPERADMIN, ADMIN, INVENTORY_STAFF, AUDITOR |
| List internal operations | Denied                                      |
| Cashier access           | Denied                                      |

Admin cannot approve their own request. Superadmin may self-approve.

## Immutability

```text
stockMovements
stockAdjustmentOperations
```

cannot be updated or deleted.

## Regression protection

The Phase 5 Stock In, Stock Out, procurement, Product, and final deny rules remain in the Rules file.

## Rules evaluation design

The atomic posting checks use `getAfter()` so the Rules validate the state of all linked documents after the transaction but before Firestore commits it.
