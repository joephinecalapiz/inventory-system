import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);

const projectRoot = path.resolve(path.dirname(currentFile), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const pageSource = read("src/pages/StockAdjustmentHistory.jsx");

const cssSource = read("src/styles/StockAdjustmentHistory.css");

const serviceSource = read("src/services/stockAdjustmentService.js");

const appSource = read("src/App.jsx");

const sidebarSource = read("src/components/layout/Sidebar.jsx");

const topbarSource = read("src/components/layout/Topbar.jsx");

test("creates the Stock Adjustment history page", () => {
  assert.match(pageSource, /function StockAdjustmentHistory/);

  assert.match(pageSource, /export default StockAdjustmentHistory/);
});

test("history includes search, status, reason, Product, and date filters", () => {
  assert.match(pageSource, /searchTerm/);

  assert.match(pageSource, /statusFilter/);

  assert.match(pageSource, /reasonFilter/);

  assert.match(pageSource, /productFilter/);

  assert.match(pageSource, /dateFrom/);

  assert.match(pageSource, /dateTo/);
});

test("history displays before-and-after quantities and audit users", () => {
  assert.match(pageSource, /System at Request/);

  assert.match(pageSource, /Posted Previous/);

  assert.match(pageSource, /Posted New/);

  assert.match(pageSource, /Requested By/);

  assert.match(pageSource, /Reviewed By/);
});

test("history details load immutable operations and movement", () => {
  assert.match(
    serviceSource,
    /export async function getStockAdjustmentHistoryDetails/,
  );

  assert.match(serviceSource, /createOperation/);

  assert.match(serviceSource, /finalOperation/);

  assert.match(serviceSource, /movement/);
});

test("rejection and cancellation save their final operation IDs", () => {
  assert.match(serviceSource, /rejectedOperationId:\s*preparedOperationId/);

  assert.match(serviceSource, /cancelledOperationId:\s*preparedOperationId/);
});

test("history page contains no edit or delete workflow", () => {
  assert.doesNotMatch(pageSource, /Edit Adjustment/);

  assert.doesNotMatch(pageSource, /Delete Adjustment/);

  assert.doesNotMatch(pageSource, /\bupdateDoc\s*\(/);

  assert.doesNotMatch(pageSource, /\bdeleteDoc\s*\(/);

  assert.match(pageSource, /Immutable Audit Links/);
});

test("history uses border-based styling without shadows", () => {
  assert.match(cssSource, /border:/);

  assert.doesNotMatch(cssSource, /box-shadow\s*:/);
});

test("adds the catch-up history route for allowed history roles", () => {
  const start = appSource.indexOf('path="/stock-adjustments/history"');

  const end = appSource.indexOf('path="/suppliers"');

  const routeSource = appSource.slice(start, end);

  assert.ok(start >= 0);

  assert.match(routeSource, /USER_ROLES\.SUPERADMIN/);

  assert.match(routeSource, /USER_ROLES\.ADMIN/);

  assert.match(routeSource, /USER_ROLES\.INVENTORY_STAFF/);

  assert.match(routeSource, /USER_ROLES\.AUDITOR/);

  assert.doesNotMatch(routeSource, /USER_ROLES\.CASHIER/);
});

test("adds the history Sidebar item and Topbar title", () => {
  assert.match(sidebarSource, /label: "Adjustment History"/);

  assert.match(sidebarSource, /path: "\/stock-adjustments\/history"/);

  assert.match(
    topbarSource,
    /"\/stock-adjustments\/history": "Stock Adjustment History"/,
  );
});

test("keeps request and review routes from Phase 6F", () => {
  assert.match(appSource, /path="\/stock-adjustments"/);

  assert.match(appSource, /path="\/stock-adjustments\/review"/);
});
