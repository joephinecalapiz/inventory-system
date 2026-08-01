# Phase 6H - Manual Test Checklist

Use a fresh Firebase Emulator data set where practical.

Record every result in `PHASE_6H_RESULTS_TEMPLATE.md`.

## A. Access and navigation

- [ ] Superadmin sees Stock Adjustments, Adjustment Review, and Adjustment History.
- [ ] Admin sees Stock Adjustments, Adjustment Review, and Adjustment History.
- [ ] Inventory Staff sees Stock Adjustments and Adjustment History.
- [ ] Inventory Staff does not see Adjustment Review.
- [ ] Auditor sees Stock Adjustments and Adjustment History.
- [ ] Auditor sees the request page in read-only mode.
- [ ] Auditor does not see Adjustment Review.
- [ ] Cashier does not see any Stock Adjustment menu.
- [ ] Cashier cannot open Stock Adjustment routes directly.
- [ ] Only one Stock Adjustment Sidebar item is highlighted at a time.
- [ ] Sidebar still scrolls independently from the main page.

## B. Request creation

- [ ] Inventory Staff can select an active Product.
- [ ] Current system quantity is displayed correctly.
- [ ] Actual count lower than system stock creates an OUT difference.
- [ ] Actual count higher than system stock creates an IN difference.
- [ ] Actual count equal to system stock is rejected.
- [ ] Zero actual count is accepted when system stock is greater than zero.
- [ ] Future count date is rejected.
- [ ] `UNRECORDED_STOCK_FOUND` is accepted only for IN.
- [ ] `LOSS_OR_SHORTAGE` is accepted only for OUT.
- [ ] `DAMAGED_FOUND_DURING_COUNT` is accepted only for OUT.
- [ ] Reference length validation works.
- [ ] Remarks length validation works.
- [ ] Confirmation modal appears before submission.
- [ ] Submission creates a SUBMITTED request.
- [ ] Submission does not change Product quantity.
- [ ] Submission does not create a permanent Stock Movement.
- [ ] Retrying the same completed request operation does not create a duplicate.

## C. Review and posting

- [ ] Admin can view requests submitted by Inventory Staff.
- [ ] Admin cannot approve their own request.
- [ ] Superadmin can approve their own request.
- [ ] Inventory Staff cannot approve, reject, or cancel.
- [ ] Auditor cannot approve, reject, or cancel.
- [ ] Valid approval updates Product quantity exactly once.
- [ ] Valid approval changes request status to POSTED.
- [ ] Valid approval creates one permanent Stock Movement.
- [ ] Valid approval creates one immutable post operation.
- [ ] Movement quantity equals the absolute signed difference.
- [ ] Movement direction matches IN or OUT.
- [ ] Previous and new quantities match the Product change.
- [ ] Unit cost and total value match.
- [ ] Reposting the same completed operation does not change stock twice.
- [ ] Product-only quantity manipulation is denied.
- [ ] Movement-only posting is denied.
- [ ] Operation-only posting is denied.

## D. Stale request

- [ ] Submit an adjustment request.
- [ ] Perform a valid Stock In or Stock Out before approval.
- [ ] Review page warns that Product stock changed.
- [ ] Posting without stale confirmation is rejected.
- [ ] Posting with confirmation applies the saved difference to the current quantity.
- [ ] Valid movements that happened after the count are not overwritten.

## E. Rejection and cancellation

- [ ] Admin can reject a submitted request with a reason.
- [ ] Rejection does not change Product quantity.
- [ ] Rejection does not create a Stock Movement.
- [ ] Rejection creates one immutable decision operation.
- [ ] Admin can cancel a submitted request with a reason.
- [ ] Cancellation does not change Product quantity.
- [ ] Cancellation does not create a Stock Movement.
- [ ] Cancellation creates one immutable decision operation.
- [ ] Rejected request cannot be edited or reopened.
- [ ] Cancelled request cannot be edited or reopened.
- [ ] Posted request cannot be edited or reopened.

## F. History and details

- [ ] History lists SUBMITTED records.
- [ ] History lists POSTED records.
- [ ] History lists REJECTED records.
- [ ] History lists CANCELLED records.
- [ ] Search works by Product, SKU, request ID, reference, requester, and reviewer.
- [ ] Status filter works.
- [ ] Reason filter works.
- [ ] Product filter works.
- [ ] Count date range works.
- [ ] Detail view shows system quantity and actual count.
- [ ] Detail view shows saved difference and direction.
- [ ] Posted detail shows previous and new quantities.
- [ ] Detail view shows requester and reviewer.
- [ ] Detail view shows create operation.
- [ ] Detail view shows final operation.
- [ ] Posted detail shows movement ID and movement type.
- [ ] History has no edit or delete action.

## G. Earlier module regression

- [ ] Product creation and master-data editing still work.
- [ ] Stock In still increases Product quantity once.
- [ ] Stock Out still decreases Product quantity once.
- [ ] Stock Out still blocks quantity above available stock.
- [ ] Stock Out duplicate operation protection still works.
- [ ] Purchase Order creation still works.
- [ ] Goods Receiving still updates stock correctly.
- [ ] Procurement receipt duplicate protection still works.
- [ ] Existing movement history remains readable.
- [ ] Cashier restrictions remain unchanged.
- [ ] Auditor remains read-only.
- [ ] Production build completes successfully.

## Completion rule

Phase 6 is complete only when:

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] All static regression tests pass.
- [ ] All Phase 5G Firestore tests pass.
- [ ] All Phase 6G Firestore tests pass.
- [ ] All Phase 6H Firestore tests pass.
- [ ] Every applicable manual test above is marked PASS.
- [ ] No unresolved critical or high-priority defect remains.
