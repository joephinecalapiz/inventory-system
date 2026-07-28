# Phase 5G — Complete Stock-Out Manual Testing Checklist

Use Firebase Emulator data only. Make a backup of `emulator-data` before starting.

Record every result in `PHASE_5G_RESULTS_TEMPLATE.md`.

## A. Installation and build gate

- [ ] Phase 5E route, Sidebar, Topbar, icon, page, and history files are installed.
- [ ] Phase 5F `firestore.rules`, `stockOutService.js`, and `stockOut.js` are installed.
- [ ] `npm run lint` finishes with zero errors.
- [ ] `npm run build` succeeds.
- [ ] A Vite chunk-size warning, when present, is recorded as a warning and not a failed build.
- [ ] Firebase CLI is updated.
- [ ] Firestore emulator starts without a Rules compilation error.
- [ ] Vite starts normally.
- [ ] Browser console contains no unhandled Stock-Out errors.

## B. Role and route matrix

### Superadmin

- [ ] Sees Stock Out in the Sidebar.
- [ ] Opens `/stock-out`.
- [ ] Can select a Product and post Stock Out.
- [ ] Can view permanent movement history.
- [ ] Can open movement details.

### Admin

- [ ] Sees Stock Out in the Sidebar.
- [ ] Opens `/stock-out`.
- [ ] Can post Stock Out.
- [ ] Can view history and movement details.

### Inventory Staff

- [ ] Sees Stock Out in the Sidebar.
- [ ] Opens `/stock-out`.
- [ ] Can post Stock Out.
- [ ] Can view history and movement details.

### Auditor

- [ ] Sees Stock Out in the Sidebar.
- [ ] Opens `/stock-out`.
- [ ] Sees the read-only notice.
- [ ] Cannot see or use the Stock-Out form.
- [ ] Can search and filter permanent movement history.
- [ ] Can open movement details.
- [ ] Cannot read `stockOutOperations` directly.

### Cashier

- [ ] Does not see Stock Out in the Sidebar.
- [ ] Entering `/stock-out` manually is blocked by `RequireRole`.
- [ ] Direct reads of `stockMovements` are denied.
- [ ] Direct reads or writes of `stockOutOperations` are denied.

### Inactive or suspended account

- [ ] Protected route access is blocked.
- [ ] Product, movement, and operation writes are denied.

## C. Product selection and page behaviour

- [ ] Only active Products are loaded.
- [ ] Products with zero stock are hidden from the selectable table.
- [ ] Search by Product name works.
- [ ] Search by SKU works.
- [ ] Search by barcode works.
- [ ] Search by category works.
- [ ] Search by unit works.
- [ ] Selecting a Product opens the release form.
- [ ] Selected Product name and SKU are correct.
- [ ] Category, unit, barcode, cost price, and available stock are correct.
- [ ] Clearing the form creates a fresh operation ID.
- [ ] A Product that becomes inactive or unavailable is removed from the active form.

## D. Field validation

- [ ] Empty Product selection is rejected.
- [ ] Empty quantity is rejected.
- [ ] Quantity `0` is rejected.
- [ ] Negative quantity is rejected.
- [ ] Decimal quantity is rejected.
- [ ] Quantity above available stock is rejected.
- [ ] Quantity equal to available stock is accepted and produces zero remaining stock.
- [ ] Future release date is rejected.
- [ ] Today’s release date is accepted.
- [ ] Reference number is automatically normalised to uppercase.
- [ ] Reference over 100 characters is rejected.
- [ ] Remarks over 500 characters are rejected.
- [ ] Destination over 150 characters is rejected.

## E. Reason and destination matrix

### Destination optional

- [ ] `MANUAL_STOCK_OUT` works without a destination.
- [ ] `DAMAGED` works without a destination.
- [ ] `EXPIRED` works without a destination.
- [ ] `LOSS` works without a destination.
- [ ] `OTHER` works without a destination.

### Destination required

- [ ] `INTERNAL_USE` is rejected without a destination.
- [ ] `TRANSFER` is rejected without a destination.
- [ ] `SAMPLE` is rejected without a destination.
- [ ] `INTERNAL_USE` succeeds with a department or user destination.
- [ ] `TRANSFER` succeeds with a branch or warehouse destination.
- [ ] `SAMPLE` succeeds with a recipient destination.

## F. Confirmation workflow

- [ ] Review button opens the confirmation dialog.
- [ ] Confirmation displays the correct Product and SKU.
- [ ] Current stock is correct.
- [ ] Quantity released is correct.
- [ ] New stock is calculated correctly.
- [ ] Reason and destination are correct.
- [ ] Reference and date are correct.
- [ ] Cost per unit matches the Product `costPrice`.
- [ ] Total cost value equals quantity multiplied by unit cost.
- [ ] Remarks are shown when provided.
- [ ] `Go Back` returns to the form without posting.
- [ ] Clicking outside the modal closes it when not posting.
- [ ] Posting state disables repeated clicks.

## G. Atomic successful Stock Out

Use a Product with opening quantity `10` and cost price `₱10.00`.

Post quantity `4`.

Expected:

```text
Previous quantity: 10
Released quantity: 4
New quantity: 6
Unit cost: ₱10.00
Total cost value: ₱40.00
```

Verify:

- [ ] Product quantity becomes exactly `6`.
- [ ] Product `stockMovementCount` increases by exactly one.
- [ ] Product `hasStockHistory` is `true`.
- [ ] Product `lastStockMovementId` matches the movement ID.
- [ ] Product `lastStockMovementType` is `OUT`.
- [ ] Product `lastStockMovementReason` matches the selected reason.
- [ ] Product `lastStockMovementQuantity` is `4`.
- [ ] Product `lastStockMovementUnitCost` is `10`.
- [ ] Product cost price remains unchanged.
- [ ] Exactly one permanent `stockMovements/{operationId}` document exists.
- [ ] Exactly one `stockOutOperations/{operationId}` document exists.
- [ ] Product, movement, and operation IDs and values match.
- [ ] Success card shows the correct result.

## H. Idempotency and duplicate submission

- [ ] Record the operation ID before posting.
- [ ] Post the Stock-Out successfully.
- [ ] Simulate a retry using the exact same operation ID and identical data.
- [ ] Service returns the stored result with `isReplay: true`.
- [ ] Product quantity does not decrease a second time.
- [ ] Product movement count does not increase a second time.
- [ ] No second movement is created.
- [ ] No second operation is created.
- [ ] Reusing the same operation ID with different quantity is rejected.
- [ ] Reusing the same operation ID with different Product is rejected.
- [ ] Double-clicking the confirmation button cannot create two releases.

## I. Firestore malicious-write regression

The automated Rules suite must confirm:

- [ ] Product-only quantity reduction is denied.
- [ ] Movement-only creation is denied.
- [ ] Operation-only creation is denied.
- [ ] Negative resulting stock is denied.
- [ ] Unknown reason is denied.
- [ ] Required destination omission is denied.
- [ ] Future release date is denied.
- [ ] Movement Product name mismatch is denied.
- [ ] Operation SKU mismatch is denied.
- [ ] Product cost-price mutation is denied.
- [ ] Stock movement count mismatch is denied.
- [ ] Unit-cost mismatch is denied.
- [ ] Total-cost mismatch is denied.
- [ ] Released-by mismatch is denied.
- [ ] Malformed operation ID is denied.
- [ ] Malformed release-date key is denied.
- [ ] Movement update is denied.
- [ ] Movement delete is denied.
- [ ] Operation update is denied.
- [ ] Operation delete is denied.
- [ ] Auditor creation is denied.
- [ ] Cashier access is denied.
- [ ] Inactive account access is denied.

## J. History, filters, and movement details

- [ ] New Stock-Out appears in history without reloading.
- [ ] OUT movement count updates.
- [ ] Unique Product count updates.
- [ ] Total released quantity updates.
- [ ] Total cost value updates.
- [ ] Search by Product works.
- [ ] Search by SKU works.
- [ ] Search by movement ID works.
- [ ] Search by operation ID works.
- [ ] Search by reason works.
- [ ] Search by destination works.
- [ ] Search by reference works.
- [ ] Search by released-by name works.
- [ ] Reason filter works.
- [ ] Date-from filter works.
- [ ] Date-to filter works.
- [ ] Clear Filters restores the full list.
- [ ] View Details reloads the record from Firestore.
- [ ] Movement and operation IDs are visible.
- [ ] Previous, released, and new quantities are correct.
- [ ] Cost values are correct.
- [ ] Release and recorded dates are correct.
- [ ] No Edit action exists.
- [ ] No Delete action exists.
- [ ] Immutable-record notice is visible.

## K. Regression checks for earlier phases

- [ ] Manual Stock In still succeeds.
- [ ] Manual Stock In creates its linked operation and movement.
- [ ] Goods Receiving still posts a valid partial receipt.
- [ ] Goods Receiving still posts a final receipt.
- [ ] Purchase Order approval still works.
- [ ] Product creation and barcode sequencing still work.
- [ ] Inventory list still loads.
- [ ] Stock In history still loads.
- [ ] Auditor can still read procurement and inventory history.
- [ ] Cashier can still read Products required for POS.
- [ ] Cashier still cannot read procurement or manual Stock-Out records.

## L. Final inventory invariants

For every Product tested:

```text
Current Product quantity
= Opening quantity
+ sum of permanent IN movements
- sum of permanent OUT movements
```

- [ ] Calculated movement balance equals the Product quantity.
- [ ] Every OUT movement has `previousQuantity - quantity = newQuantity`.
- [ ] Every OUT movement has `totalCost = quantity × unitCost`, allowing only normal two-decimal rounding.
- [ ] Every manual OUT movement has one matching operation document.
- [ ] Every Product `lastStockMovementId` points to its latest movement.
- [ ] Product `stockMovementCount` equals its number of permanent movements.

## Completion rule

Phase 5 is complete only when:

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] All static tests pass.
- [ ] All Firestore Rules tests pass.
- [ ] Every critical manual workflow passes.
- [ ] No quantity mismatch remains.
- [ ] No unauthorised role can bypass the intended workflow.
- [ ] The successful emulator data is exported.
