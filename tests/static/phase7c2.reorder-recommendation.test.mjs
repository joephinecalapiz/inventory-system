import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReorderRecommendations,
  canCreatePurchaseOrderFromRecommendation,
  filterAndSortReorderRecommendations,
} from "../../src/utils/reorder/reorderRecommendation.js";

test("builds a recommendation for low stock", () => {
  const result = buildReorderRecommendations({
    products: [
      {
        id: "P1",
        name: "Valve",
        sku: "VALVE-1",
        quantity: 2,
        reorderLevel: 5,
        stockStatus: "LOW_STOCK",
        status: "ACTIVE",
        preferredSupplierId: "S1",
        costPrice: 25,
      },
    ],
    suppliers: [
      {
        id: "S1",
        supplierCode: "SUP-000001",
        name: "Main Supplier",
        status: "ACTIVE",
      },
    ],
    purchaseOrders: [],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].suggestedQuantity, 8);
  assert.equal(result[0].supplierName, "Main Supplier");
  assert.equal(result[0].estimatedReorderCost, 200);
});

test("open purchase order prevents duplicate PO creation", () => {
  const result = buildReorderRecommendations({
    products: [
      {
        id: "P1",
        name: "Meter",
        sku: "METER-1",
        quantity: 0,
        reorderLevel: 5,
        stockStatus: "OUT_OF_STOCK",
        status: "ACTIVE",
        preferredSupplierId: "S1",
      },
    ],
    suppliers: [{ id: "S1", name: "Supplier" }],
    purchaseOrders: [
      {
        id: "PO1",
        poNumber: "PO-2026-000001",
        status: "APPROVED",
        itemProductIds: ["P1"],
      },
    ],
  });

  assert.equal(result[0].hasOpenPurchaseOrder, true);
  assert.equal(canCreatePurchaseOrderFromRecommendation(result[0]), false);
});

test("received and cancelled purchase orders are ignored", () => {
  const result = buildReorderRecommendations({
    products: [
      {
        id: "P1",
        name: "Meter",
        sku: "METER-1",
        quantity: 0,
        reorderLevel: 5,
        stockStatus: "OUT_OF_STOCK",
        status: "ACTIVE",
      },
    ],
    suppliers: [],
    purchaseOrders: [
      { id: "PO1", status: "RECEIVED", itemProductIds: ["P1"] },
      { id: "PO2", status: "CANCELLED", itemProductIds: ["P1"] },
    ],
  });

  assert.equal(result[0].hasOpenPurchaseOrder, false);
});

test("filters recommendations by supplier assignment", () => {
  const result = filterAndSortReorderRecommendations(
    [
      {
        productName: "Assigned",
        hasSupplier: true,
        stockStatus: "LOW_STOCK",
      },
      {
        productName: "Unassigned",
        hasSupplier: false,
        stockStatus: "LOW_STOCK",
      },
    ],
    { supplierAssignment: "UNASSIGNED" },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].productName, "Unassigned");
});
