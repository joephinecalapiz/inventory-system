# Phase 4I-3 — Manual Role, Workflow, and Regression Checklist

Use a fresh Firebase Emulator export or make a backup before beginning.

Record every result in `PHASE_4I3_RESULTS_TEMPLATE.md`.

## A. Installation gate

- [ ] All Phase 4I-2 files were replaced together.
- [ ] `npm run lint` returns zero errors and zero warnings.
- [ ] `npm run build` succeeds.
- [ ] Firebase CLI is current.
- [ ] Firestore emulator starts without a rules compilation error.
- [ ] Vite starts normally.
- [ ] Browser console has no application `permission-denied`, `ReferenceError`, or unhandled promise errors.

## B. Role and route matrix

### Superadmin

- [ ] Dashboard is visible.
- [ ] Product Management is visible.
- [ ] Stock In is visible.
- [ ] Suppliers is visible.
- [ ] Purchase Orders is visible.
- [ ] Goods Receiving is visible.
- [ ] Goods Receipt History is visible.
- [ ] User Management is visible.
- [ ] Can create, submit, approve, cancel, receive, view, and print procurement records.

### Admin

- [ ] Same procurement access as Superadmin.
- [ ] Can approve submitted Purchase Orders.
- [ ] Can cancel Draft, Submitted, and Approved POs before receiving.
- [ ] Cannot change their own role or status through User Management.

### Inventory Staff

- [ ] Can view and manage Product operational data.
- [ ] Can create manual Stock-In receipts.
- [ ] Can create and edit Draft Purchase Orders.
- [ ] Can submit Draft Purchase Orders.
- [ ] Cannot approve Purchase Orders.
- [ ] Cannot cancel Purchase Orders.
- [ ] Can post Goods Receipts.
- [ ] Can view and print Goods Receipt History.
- [ ] Cannot access User Management.

### Auditor

- [ ] Can view Inventory.
- [ ] Can view Stock-In history.
- [ ] Can view Suppliers.
- [ ] Can view Purchase Orders.
- [ ] Can view Goods Receiving availability.
- [ ] Can view and print Goods Receipt History.
- [ ] Cannot create, edit, submit, approve, cancel, or receive.
- [ ] Direct Firestore writes return `permission-denied`.

### Cashier

- [ ] Can access the Cashier route.
- [ ] Can read Products required by POS.
- [ ] Suppliers is hidden.
- [ ] Purchase Orders is hidden.
- [ ] Goods Receiving is hidden.
- [ ] Goods Receipt History is hidden.
- [ ] Direct procurement URLs are unauthorized.
- [ ] Direct procurement Firestore reads return `permission-denied`.

### Inactive or suspended user

- [ ] Protected pages are unavailable.
- [ ] Protected Firestore reads and writes are denied.

## C. Product and barcode regression

- [ ] Create a new active category with a unique two-digit barcode prefix.
- [ ] Create a new active unit.
- [ ] Create a Product using that category and unit.
- [ ] Product has `barcodeSequence`.
- [ ] Product barcode uses the category prefix.
- [ ] `barcodeCounters/{prefix}.lastSequence` increased by exactly one.
- [ ] A second Product receives the next sequence.
- [ ] SKU cannot be changed after creation.
- [ ] Barcode cannot be changed after creation.
- [ ] Category cannot be changed after creation.
- [ ] Product quantity cannot be edited from Product Management.
- [ ] A Product with stock or movement history cannot be deleted.
- [ ] A zero-stock Product with no source identity or movement history may be deleted by Admin/Superadmin only.

## D. Manual Stock-In and idempotency

- [ ] Open a fresh Stock-In form.
- [ ] Confirm it has a new operation ID internally.
- [ ] Submit quantity `5` with a valid source, date, reason, and unit cost.
- [ ] Product quantity increases by exactly `5`.
- [ ] Product `stockMovementCount` increases by exactly one.
- [ ] Product `lastStockMovement*` fields match the receipt.
- [ ] `stockMovements/{operationId}` exists.
- [ ] `stockInOperations/{operationId}` exists.
- [ ] Movement and operation IDs match.
- [ ] Refresh or repeat the exact same operation.
- [ ] Product quantity does not increase a second time.
- [ ] Reusing the operation ID for different data is rejected.
- [ ] Future received date is rejected.
- [ ] Zero, negative, and decimal quantities are rejected.
- [ ] Negative unit cost is rejected.
- [ ] Stock Movement update and delete are denied.

## E. Stock-Out regression

- [ ] Perform a valid Stock-Out.
- [ ] Product quantity decreases by the requested quantity.
- [ ] Negative resulting stock is blocked.
- [ ] Product `stockMovementCount` increases by one.
- [ ] Product `lastStockMovementType` becomes `OUT`.
- [ ] Product `lastStockMovementReason` is `MANUAL_STOCK_OUT`.
- [ ] Product `lastStockMovementUnitCost` is zero.
- [ ] One immutable OUT movement is created.

## F. Supplier workflow

- [ ] Admin creates a Supplier.
- [ ] Supplier code counter increases by exactly one.
- [ ] Inventory Staff and Auditor can read the Supplier.
- [ ] Inventory Staff cannot create or delete a Supplier.
- [ ] Supplier code remains permanent.
- [ ] Supplier can be deactivated by Admin/Superadmin.
- [ ] Inactive Supplier cannot be used for a new PO.
- [ ] Supplier record cannot be deleted.

## G. Purchase Order workflow

### Draft creation

- [ ] Create a new PO with one or more active Products.
- [ ] `poSequence` matches the last six digits of `poNumber`.
- [ ] `purchaseOrderCounters/{year}.lastSequence` matches `poSequence`.
- [ ] PO starts as `DRAFT`.
- [ ] PO item documents start as `DRAFT`.
- [ ] Duplicate Product rows are rejected.
- [ ] Future PO date is rejected.
- [ ] Expected delivery before order date is rejected.
- [ ] Discount greater than subtotal is rejected.
- [ ] PO number cannot change during draft editing.

### Submission

- [ ] Inventory Staff submits the Draft.
- [ ] Header becomes `SUBMITTED`.
- [ ] Every item becomes `SUBMITTED`.
- [ ] Supplier `purchaseOrderCount` increases by one.
- [ ] Supplier last-PO fields match the submitted PO.
- [ ] Draft editing is no longer available.

### Approval

- [ ] Inventory Staff approval is denied.
- [ ] Admin approves the PO.
- [ ] Header becomes `APPROVED`.
- [ ] Every item becomes `APPROVED`.

### Cancellation

- [ ] Admin can cancel a Draft PO with a reason.
- [ ] Admin can cancel a Submitted PO with a reason.
- [ ] Admin can cancel an Approved PO before receiving.
- [ ] Inventory Staff cannot cancel.
- [ ] Cancelled PO and items become `CANCELLED`.
- [ ] Cancelled records cannot return to another status.
- [ ] Cancellation is blocked after receiving begins.

## H. Goods Receiving workflow

### Partial receipt

- [ ] Load an Approved PO.
- [ ] Receive less than the remaining quantity.
- [ ] Confirmation modal shows correct quantities and values.
- [ ] Post the receipt.
- [ ] GRN has `goodsReceiptSequence`.
- [ ] GRN number sequence matches `goodsReceiptSequence`.
- [ ] `goodsReceiptCounters/{year}` matches the GRN sequence.
- [ ] PO status becomes `PARTIALLY_RECEIVED`.
- [ ] PO total received quantity increases correctly.
- [ ] Selected PO item received and remaining quantities are correct.
- [ ] Unselected PO items retain quantities but synchronize status.
- [ ] Product stock increases once.
- [ ] Product cost price updates only when actual unit cost is positive.
- [ ] One PURCHASE_RECEIPT stock movement is created per received Product.
- [ ] Receipt item `stockMovementId` points to the matching movement.
- [ ] Goods Receipt and receipt items are immutable.

### Final receipt

- [ ] Open the same partially received PO.
- [ ] Receive every remaining quantity.
- [ ] PO becomes `RECEIVED`.
- [ ] Every PO item becomes `RECEIVED`.
- [ ] PO disappears from the Goods Receiving list.
- [ ] Total received equals total ordered.
- [ ] Product stock reflects both partial and final receipts.

### Duplicate and limits

- [ ] Reusing the same Supplier reference is rejected.
- [ ] The rejected duplicate creates no stock, PO, GRN, counter, or movement changes.
- [ ] More than 30 selected Product lines in one GRN is rejected.
- [ ] Quantity greater than remaining is rejected.
- [ ] Future receiving date is rejected.
- [ ] Receiving before the PO date is rejected.
- [ ] Inactive Product receiving is rejected.

## I. Receipt history and printing

- [ ] New GRNs appear in history in real time.
- [ ] Search by GRN works.
- [ ] Search by PO works.
- [ ] Search by Supplier works.
- [ ] Search by Supplier reference works.
- [ ] Receipt detail totals match receipt items.
- [ ] Print preview contains the Goods Receipt Note.
- [ ] Sidebar and application page are hidden in print preview.
- [ ] Save as PDF produces a readable A4 document.
- [ ] Browser headers and footers can be disabled.
- [ ] Closing print returns to the history page.

## J. Malicious direct-write regression

Use the automated rules suite for these checks.

- [ ] Direct Product quantity-only update is denied.
- [ ] Direct SKU or barcode change is denied.
- [ ] Fake Stock Movement create is denied.
- [ ] Stock Movement update is denied.
- [ ] Stock Movement delete is denied.
- [ ] Goods Receipt update is denied.
- [ ] Goods Receipt item delete is denied.
- [ ] Inventory Staff approval is denied.
- [ ] Auditor writes are denied.
- [ ] Cashier procurement reads are denied.
- [ ] Unauthenticated access is denied.
- [ ] Inactive account access is denied.

## K. Final data invariants

For every Product involved in the test:

```text
Current Product quantity
= Opening quantity
+ all valid IN movements
- all valid OUT movements
```

For every Purchase Order item:

```text
orderedQuantity
= receivedQuantity
+ remainingQuantity
```

For every Purchase Order:

```text
totalReceivedQuantity
= sum of PO item receivedQuantity
```

For every Goods Receipt:

```text
totalReceivedQuantity
= sum of receipt item quantityReceived
```

```text
totalValue
= sum of receipt item lineTotal
```

For every stock-changing transaction:

```text
Product stockMovementCount
= number of permanent movements for that Product
```

## Completion rule

Phase 4 is complete only when:

- [ ] Automated source tests pass.
- [ ] Automated Firestore Rules tests pass.
- [ ] Every critical manual test passes.
- [ ] No unresolved data mismatch exists.
- [ ] No unauthorized role can bypass the intended workflow.
- [ ] Emulator export is saved after the successful test run.
