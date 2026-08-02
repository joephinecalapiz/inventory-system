import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDashboardStockAlertWidgets,
  buildLowStockAlerts,
  buildOutOfStockAlerts,
} from "../../src/utils/dashboard/stockAlertAggregation.js";

test("low-stock alerts include suggested order quantity", () => {
  const alerts = buildLowStockAlerts([
    {
      id: "P1",
      name: "Valve",
      quantity: 3,
      reorderLevel: 5,
      stockStatus: "LOW_STOCK",
      status: "ACTIVE",
    },
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].suggestedOrderQuantity, 7);
});

test("out-of-stock alerts exclude inactive products", () => {
  const alerts = buildOutOfStockAlerts([
    {
      id: "P1",
      name: "Inactive Item",
      quantity: 0,
      reorderLevel: 5,
      stockStatus: "OUT_OF_STOCK",
      status: "INACTIVE",
    },
    {
      id: "P2",
      name: "Active Item",
      quantity: 0,
      reorderLevel: 5,
      stockStatus: "OUT_OF_STOCK",
      status: "ACTIVE",
    },
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, "P2");
});

test("dashboard stock-alert widgets return counts and previews", () => {
  const result = buildDashboardStockAlertWidgets(
    [
      {
        id: "P1",
        name: "Low Item",
        quantity: 2,
        reorderLevel: 4,
        stockStatus: "LOW_STOCK",
      },
      {
        id: "P2",
        name: "Out Item",
        quantity: 0,
        reorderLevel: 3,
        stockStatus: "OUT_OF_STOCK",
      },
    ],
    {
      lowStockLimit: 1,
      outOfStockLimit: 1,
    },
  );

  assert.equal(result.counts.lowStock, 1);
  assert.equal(result.counts.outOfStock, 1);
  assert.equal(result.counts.totalAlerts, 2);
  assert.equal(result.lowStockPreview.length, 1);
  assert.equal(result.outOfStockPreview.length, 1);
  assert.equal(result.hasAlerts, true);
});
