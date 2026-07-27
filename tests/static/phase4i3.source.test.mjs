import test from "node:test";
import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

function readProjectFile(relativePath) {
  return readFileSync(
    resolve(process.cwd(), relativePath),
    "utf8",
  );
}

function routeBlock(source, routePath) {
  const start = source.indexOf(
    `path="${routePath}"`,
  );

  assert.notEqual(
    start,
    -1,
    `Missing route ${routePath}`,
  );

  const nextRoute = source.indexOf(
    "<Route",
    start + 10,
  );

  return source.slice(
    start,
    nextRoute === -1
      ? source.length
      : nextRoute,
  );
}

function sidebarBlock(source, path) {
  const marker = `path: "${path}"`;
  const start = source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `Missing sidebar entry ${path}`,
  );

  const nextEntry = source.indexOf(
    "\n  {",
    start + marker.length,
  );

  return source.slice(
    start,
    nextEntry === -1
      ? source.length
      : nextEntry,
  );
}

test(
  "Phase 4I-2 hardening files are installed",
  () => {
    const rules =
      readProjectFile("firestore.rules");

    const stockIn =
      readProjectFile(
        "src/services/stockInService.js",
      );

    const stockInPage =
      readProjectFile("src/pages/StockIn.jsx");

    const goodsConstants =
      readProjectFile(
        "src/constants/goodsReceiving.js",
      );

    const goodsService =
      readProjectFile(
        "src/services/goodsReceivingService.js",
      );

    const poService =
      readProjectFile(
        "src/services/purchaseOrderService.js",
      );

    const productService =
      readProjectFile(
        "src/services/productService.js",
      );

    assert.match(
      rules,
      /match \/stockInOperations\/\{operationId\}/,
    );

    assert.match(
      rules,
      /hashing\.sha256/,
    );

    assert.match(
      stockIn,
      /stockInOperations/,
    );

    assert.match(
      stockIn,
      /operationId/,
    );

    assert.match(
      stockInPage,
      /createEmptyStockInForm/,
    );

    assert.match(
      goodsConstants,
      /MAX_POSTING_ITEM_COUNT:\s*30/,
    );

    assert.match(
      goodsService,
      /sha256Hex/,
    );

    assert.match(
      goodsService,
      /goodsReceiptSequence/,
    );

    assert.match(
      poService,
      /poSequence/,
    );

    assert.match(
      productService,
      /barcodeSequence/,
    );

    assert.match(
      productService,
      /lastStockMovementId/,
    );
  },
);

test(
  "hardened Firestore match blocks are unique",
  () => {
    const rules =
      readProjectFile("firestore.rules");

    const expectedSingleBlocks = [
      "match /products/{productId}",
      "match /barcodeCounters/{barcodePrefix}",
      "match /stockMovements/{movementId}",
      "match /stockInOperations/{operationId}",
      "match /purchaseOrders/{purchaseOrderId}",
      "match /purchaseOrderCounters/{counterId}",
      "match /goodsReceipts/{goodsReceiptId}",
      "match /goodsReceiptCounters/{counterId}",
      "match /goodsReceiptReferenceReservations/{reservationId}",
    ];

    for (const block of expectedSingleBlocks) {
      assert.equal(
        rules.split(block).length - 1,
        1,
        `${block} must appear exactly once`,
      );
    }
  },
);

test(
  "procurement routes exclude Cashier",
  () => {
    const app = readProjectFile("src/App.jsx");

    for (const path of [
      "/suppliers",
      "/purchase-orders",
      "/goods-receiving",
      "/goods-receipt-history",
    ]) {
      const block = routeBlock(app, path);

      assert.doesNotMatch(
        block,
        /USER_ROLES\.CASHIER/,
        `Cashier must not access ${path}`,
      );
    }
  },
);

test(
  "procurement sidebar entries exclude Cashier",
  () => {
    const sidebar =
      readProjectFile(
        "src/components/layout/Sidebar.jsx",
      );

    for (const path of [
      "/suppliers",
      "/purchase-orders",
      "/goods-receiving",
      "/goods-receipt-history",
    ]) {
      const block = sidebarBlock(
        sidebar,
        path,
      );

      assert.doesNotMatch(
        block,
        /USER_ROLES\.CASHIER/,
        `Cashier must not see ${path}`,
      );
    }
  },
);
