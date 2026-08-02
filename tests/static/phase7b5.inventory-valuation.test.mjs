import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInventoryValuationSummary,
  calculateProductInventoryValue,
  getValuationWarningMessage,
  resolveInventoryUnitCost,
} from "../../src/utils/dashboard/inventoryValuation.js";

test("product valuation uses quantity times costPrice", () => {
  const value = calculateProductInventoryValue({
    quantity: 5,
    costPrice: 120,
  });

  assert.equal(value, 600);
});

test("unit cost fallback order is respected", () => {
  assert.equal(
    resolveInventoryUnitCost({
      averageUnitCost: 90,
      unitCost: 80,
      lastPurchaseCost: 70,
    }),
    90,
  );

  assert.equal(
    resolveInventoryUnitCost({
      unitCost: 80,
      lastPurchaseCost: 70,
    }),
    80,
  );
});

test("valuation summary excludes inactive products", () => {
  const summary = buildInventoryValuationSummary([
    {
      id: "P1",
      name: "Active Product",
      quantity: 2,
      costPrice: 100,
      status: "ACTIVE",
    },
    {
      id: "P2",
      name: "Inactive Product",
      quantity: 10,
      costPrice: 100,
      status: "INACTIVE",
    },
  ]);

  assert.equal(summary.activeProductCount, 1);
  assert.equal(summary.totalInventoryValue, 200);
});

test("valuation summary reports missing cost coverage", () => {
  const summary = buildInventoryValuationSummary([
    {
      id: "P1",
      name: "Valued Product",
      quantity: 2,
      costPrice: 100,
      status: "ACTIVE",
    },
    {
      id: "P2",
      name: "No Cost Product",
      quantity: 4,
      status: "ACTIVE",
    },
  ]);

  assert.equal(summary.valuedProductCount, 1);
  assert.equal(summary.productsWithoutCostCount, 1);
  assert.equal(summary.valuationCoveragePercent, 50);
  assert.match(getValuationWarningMessage(summary), /1 active product/);
});

test("category valuation is calculated and sorted", () => {
  const summary = buildInventoryValuationSummary([
    {
      id: "P1",
      name: "Valve",
      category: "VALVES",
      quantity: 5,
      costPrice: 100,
    },
    {
      id: "P2",
      name: "Meter",
      category: "WATER METERS",
      quantity: 2,
      costPrice: 500,
    },
  ]);

  assert.equal(summary.categoryValuation[0].category, "WATER METERS");
  assert.equal(summary.categoryValuation[0].inventoryValue, 1000);
  assert.equal(summary.categoryValuation[1].inventoryValue, 500);
});
