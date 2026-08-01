import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  assert.equal(
    fs.existsSync(path),
    true,
    `Missing required project file: ${path}`,
  );

  return fs.readFileSync(
    path,
    "utf8",
  );
}

const appSource = read(
  "src/App.jsx",
);

const sidebarSource = read(
  "src/components/layout/Sidebar.jsx",
);

const topbarSource = read(
  "src/components/layout/Topbar.jsx",
);

const constantsSource = read(
  "src/constants/stockAdjustment.js",
);

const adjustmentServiceSource = read(
  "src/services/stockAdjustmentService.js",
);

const requestPageSource = read(
  "src/pages/StockAdjustments.jsx",
);

const reviewPageSource = read(
  "src/pages/StockAdjustmentReview.jsx",
);

const historyPageSource = read(
  "src/pages/StockAdjustmentHistory.jsx",
);

const stockOutServiceSource = read(
  "src/services/stockOutService.js",
);

const rulesSource = read(
  "firestore.rules",
);

test(
  "Stock Adjustment constants remain installed",
  () => {
    assert.match(
      constantsSource,
      /calculateStockAdjustmentDifference/,
    );

    assert.match(
      constantsSource,
      /calculatePostedAdjustmentBalance/,
    );

    assert.match(
      constantsSource,
      /isAdjustmentReasonAllowedForDirection/,
    );

    assert.match(
      constantsSource,
      /canApproveOwnStockAdjustment/,
    );
  },
);

test(
  "complete Stock Adjustment service workflow remains installed",
  () => {
    assert.match(
      adjustmentServiceSource,
      /export async function createStockAdjustmentRequest/,
    );

    assert.match(
      adjustmentServiceSource,
      /export async function approveAndPostStockAdjustment/,
    );

    assert.match(
      adjustmentServiceSource,
      /export async function rejectStockAdjustmentRequest/,
    );

    assert.match(
      adjustmentServiceSource,
      /export async function cancelStockAdjustmentRequest/,
    );

    assert.match(
      adjustmentServiceSource,
      /export async function getStockAdjustmentHistoryDetails/,
    );
  },
);

test(
  "request, review, and history pages remain installed",
  () => {
    assert.match(
      requestPageSource,
      /function StockAdjustments/,
    );

    assert.match(
      reviewPageSource,
      /function StockAdjustmentReview/,
    );

    assert.match(
      historyPageSource,
      /function StockAdjustmentHistory/,
    );
  },
);

test(
  "request creation remains request-only",
  () => {
    assert.match(
      requestPageSource,
      /This is a request only/,
    );

    assert.match(
      requestPageSource,
      /Product stock will not change/,
    );
  },
);

test(
  "review workflow contains approval, rejection, cancellation, and stale confirmation",
  () => {
    assert.match(
      reviewPageSource,
      /Approve & Post/,
    );

    assert.match(
      reviewPageSource,
      /Reject/,
    );

    assert.match(
      reviewPageSource,
      /Cancel/,
    );

    assert.match(
      reviewPageSource,
      /confirmStaleRequest/,
    );
  },
);

test(
  "history remains read-only with immutable audit links",
  () => {
    assert.match(
      historyPageSource,
      /Immutable Audit Links/,
    );

    assert.match(
      historyPageSource,
      /Create Operation/,
    );

    assert.match(
      historyPageSource,
      /Final Operation/,
    );

    assert.match(
      historyPageSource,
      /Movement ID/,
    );

    assert.doesNotMatch(
      historyPageSource,
      /\bupdateDoc\s*\(/,
    );

    assert.doesNotMatch(
      historyPageSource,
      /\bdeleteDoc\s*\(/,
    );
  },
);

test(
  "all Stock Adjustment routes remain installed",
  () => {
    assert.match(
      appSource,
      /path="\/stock-adjustments"/,
    );

    assert.match(
      appSource,
      /path="\/stock-adjustments\/review"/,
    );

    assert.match(
      appSource,
      /path="\/stock-adjustments\/history"/,
    );
  },
);

test(
  "Sidebar and Topbar remain synchronized",
  () => {
    assert.match(
      sidebarSource,
      /label: "Stock Adjustments"/,
    );

    assert.match(
      sidebarSource,
      /label: "Adjustment Review"/,
    );

    assert.match(
      sidebarSource,
      /label: "Adjustment History"/,
    );

    assert.match(
      sidebarSource,
      /end=\{item\.end \?\? false\}/,
    );

    assert.match(
      topbarSource,
      /"\/stock-adjustments": "Stock Adjustments"/,
    );

    assert.match(
      topbarSource,
      /"\/stock-adjustments\/review": "Stock Adjustment Review"/,
    );

    assert.match(
      topbarSource,
      /"\/stock-adjustments\/history": "Stock Adjustment History"/,
    );
  },
);

test(
  "Stock-Out idempotency is checked before Product stock",
  () => {
    const operationRead =
      /transaction\.get\(\s*operationReference\s*,?\s*\)/.exec(
        stockOutServiceSource,
      );

    const productRead =
      /transaction\.get\(\s*productReference\s*,?\s*\)/.exec(
        stockOutServiceSource,
      );

    assert.ok(
      operationRead,
      "Missing Stock-Out operation read.",
    );

    assert.ok(
      productRead,
      "Missing Stock-Out Product read.",
    );

    assert.ok(
      operationRead.index <
        productRead.index,
      "Stock-Out must check its operation before reading Product stock.",
    );

    assert.match(
      stockOutServiceSource,
      /isSameStockOutRequest/,
    );

    assert.match(
      stockOutServiceSource,
      /isReplay:\s*true/,
    );
  },
);

test(
  "Stock Adjustment Rules and linked posting remain installed",
  () => {
    assert.match(
      rulesSource,
      /match \/stockAdjustmentRequests\/\{adjustmentId\}/,
    );

    assert.match(
      rulesSource,
      /match \/stockAdjustmentOperations\/\{operationId\}/,
    );

    assert.match(
      rulesSource,
      /isValidStockAdjustmentProductUpdate/,
    );

    assert.match(
      rulesSource,
      /isValidStockAdjustmentMovement/,
    );

    assert.match(
      rulesSource,
      /stockAdjustmentPostLinkedDocumentsMatch/,
    );
  },
);

test(
  "Rules route Stock Adjustment writes before unrelated validators",
  () => {
    assert.match(
      rulesSource,
      /lastStockMovementReason[\s\S]*== "STOCK_ADJUSTMENT"[\s\S]*isValidStockAdjustmentProductUpdate/,
    );

    assert.match(
      rulesSource,
      /reason",[\s\S]*== "STOCK_ADJUSTMENT"[\s\S]*isValidStockAdjustmentMovement/,
    );

    assert.match(
      rulesSource,
      /status[\s\S]*== "POSTED"[\s\S]*isValidPostedStockAdjustmentRequest/,
    );

    assert.match(
      rulesSource,
      /operationType[\s\S]*== "POST_ADJUSTMENT"[\s\S]*isValidStockAdjustmentPostOperation/,
    );
  },
);

test(
  "earlier inventory Rules and final deny remain installed",
  () => {
    assert.match(
      rulesSource,
      /match \/stockInOperations/,
    );

    assert.match(
      rulesSource,
      /match \/stockOutOperations/,
    );

    assert.match(
      rulesSource,
      /match \/purchaseOrders/,
    );

    assert.match(
      rulesSource,
      /match \/goodsReceipts/,
    );

    assert.match(
      rulesSource,
      /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/,
    );

    assert.doesNotMatch(
      rulesSource,
      /allow read, write: if true/,
    );
  },
);
