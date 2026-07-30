import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath,
} from "node:url";

const currentFile = fileURLToPath(
  import.meta.url,
);

const projectRoot = path.resolve(
  path.dirname(currentFile),
  "../..",
);

const pageSource = fs.readFileSync(
  path.join(
    projectRoot,
    "src/pages/StockAdjustments.jsx",
  ),
  "utf8",
);

const cssSource = fs.readFileSync(
  path.join(
    projectRoot,
    "src/styles/StockAdjustments.css",
  ),
  "utf8",
);

test("creates the Stock Adjustments page", () => {
  assert.match(
    pageSource,
    /function StockAdjustments/,
  );

  assert.match(
    pageSource,
    /export default StockAdjustments/,
  );
});

test("loads active Products through the existing Product service", () => {
  assert.match(
    pageSource,
    /subscribeToActiveProducts/,
  );

  assert.match(
    pageSource,
    /setProducts\(activeProducts\)/,
  );
});

test("uses the Phase 6B request service", () => {
  assert.match(
    pageSource,
    /createStockAdjustmentRequest/,
  );

  assert.match(
    pageSource,
    /await createStockAdjustmentRequest\(\s*form/,
  );
});

test("calculates difference, direction, and estimated value", () => {
  assert.match(
    pageSource,
    /calculateStockAdjustmentDifference/,
  );

  assert.match(
    pageSource,
    /getStockAdjustmentDirection/,
  );

  assert.match(
    pageSource,
    /calculateStockAdjustmentValue/,
  );
});

test("includes a confirmation modal before submission", () => {
  assert.match(
    pageSource,
    /isConfirmationOpen/,
  );

  assert.match(
    pageSource,
    /Submit Adjustment Request\?/,
  );

  assert.match(
    pageSource,
    /handleSubmitRequest/,
  );
});

test("explains that request creation does not change stock", () => {
  assert.match(
    pageSource,
    /Product stock will not change/,
  );

  assert.match(
    pageSource,
    /This is a request only/,
  );
});

test("supports role-based request creation and Auditor read-only access", () => {
  assert.match(
    pageSource,
    /canRoleCreateStockAdjustment/,
  );

  assert.match(
    pageSource,
    /USER_ROLES\.AUDITOR/,
  );

  assert.match(
    pageSource,
    /Read-only access/,
  );
});

test("filters Product search results", () => {
  assert.match(
    pageSource,
    /filteredProducts/,
  );

  assert.match(
    pageSource,
    /normalizedSearch/,
  );

  assert.match(
    pageSource,
    /Search Products/,
  );
});

test("allows zero physical counts", () => {
  assert.match(
    pageSource,
    /min="0"/,
  );

  assert.match(
    pageSource,
    /Actual Counted Quantity/,
  );
});

test("uses a border-based style without box shadows", () => {
  assert.match(
    cssSource,
    /border:/,
  );

  assert.doesNotMatch(
    cssSource,
    /box-shadow\s*:/,
  );
});

test("provides responsive page and modal styling", () => {
  assert.match(
    cssSource,
    /@media \(max-width: 760px\)/,
  );

  assert.match(
    cssSource,
    /\.stock-adjustment-modal-backdrop/,
  );

  assert.match(
    cssSource,
    /max-height: calc\(100dvh - 40px\)/,
  );
});

test("does not add routes or Sidebar integration in Phase 6C", () => {
  assert.doesNotMatch(
    pageSource,
    /NavLink/,
  );

  assert.doesNotMatch(
    pageSource,
    /<Route/,
  );
});
