# Phase 5G — Suggested Test Data

Use emulator-only accounts and Products.

## Role accounts

| Test key | Role | Status |
|---|---|---|
| phase5g-superadmin | SUPERADMIN | ACTIVE |
| phase5g-admin | ADMIN | ACTIVE |
| phase5g-inventory | INVENTORY_STAFF | ACTIVE |
| phase5g-auditor | AUDITOR | ACTIVE |
| phase5g-cashier | CASHIER | ACTIVE |
| phase5g-inactive | ADMIN | INACTIVE |

## Primary Product

```text
Name: Water Meter
SKU: WAME
Status: ACTIVE
Quantity: 10
Cost price: ₱10.00
Selling price: ₱15.00
Category: WATER METERS
Unit: PCS
Barcode: 100000000001
```

## Main successful Stock-Out

```text
Quantity released: 4
Reason: MANUAL_STOCK_OUT
Destination: blank
Reference: REQ-PHASE5G-001
Remarks: Phase 5G successful workflow test
```

Expected:

```text
Previous quantity: 10
New quantity: 6
Total cost value: ₱40.00
```

## Destination tests

```text
INTERNAL_USE → Maintenance Department
TRANSFER → Cagayan Branch Warehouse
SAMPLE → Engineering Evaluation Team
```

## Boundary tests

```text
Valid full release: 10
Invalid above-stock release: 11
Invalid zero: 0
Invalid decimal: 1.5
Invalid future date: tomorrow
Invalid destination: 151 characters
Invalid reference: 101 characters
Invalid remarks: 501 characters
```
