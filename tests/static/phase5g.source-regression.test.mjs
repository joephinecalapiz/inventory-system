import test from "node:test";
import assert from "node:assert/strict";

import {
  readFileSync,
  statSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

function read(relativePath) {
  return readFileSync(
    resolve(process.cwd(), relativePath),
    "utf8",
  );
}

function routeBlock(source, routePath) {
  const marker = `path="${routePath}"`;
  const start = source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `Missing route ${routePath}`,
  );

  const nextRoute = source.indexOf(
    "<Route",
    start + marker.length,
  );

  return source.slice(
    start,
    nextRoute === -1
      ? source.length
      : nextRoute,
  );
}

function sidebarBlock(source, routePath) {
  const marker = `path: "${routePath}"`;
  const start = source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `Missing sidebar item ${routePath}`,
  );

  const nextItem = source.indexOf(
    "\n  {",
    start + marker.length,
  );

  return source.slice(
    start,
    nextItem === -1
      ? source.length
      : nextItem,
  );
}

test(
  "Stock-Out route uses the complete role matrix",
  () => {
    const app = read("src/App.jsx");
    const block = routeBlock(
      app,
      "/stock-out",
    );

    for (const role of [
      "USER_ROLES.SUPERADMIN",
      "USER_ROLES.ADMIN",
      "USER_ROLES.INVENTORY_STAFF",
      "USER_ROLES.AUDITOR",
    ]) {
      assert.match(
        block,
        new RegExp(role),
      );
    }

    assert.doesNotMatch(
      block,
      /USER_ROLES\.CASHIER/,
    );

    assert.match(
      block,
      /<StockOut currentUserRole=\{userProfile\.role\}/,
    );
  },
);

test(
  "Stock-Out Sidebar item matches the route role matrix",
  () => {
    const sidebar = read(
      "src/components/layout/Sidebar.jsx",
    );

    const block = sidebarBlock(
      sidebar,
      "/stock-out",
    );

    for (const role of [
      "USER_ROLES.SUPERADMIN",
      "USER_ROLES.ADMIN",
      "USER_ROLES.INVENTORY_STAFF",
      "USER_ROLES.AUDITOR",
    ]) {
      assert.match(
        block,
        new RegExp(role),
      );
    }

    assert.doesNotMatch(
      block,
      /USER_ROLES\.CASHIER/,
    );

    assert.match(
      sidebar,
      /StockOutIcon/,
    );
  },
);

test(
  "Topbar and icon integration are installed",
  () => {
    const topbar = read(
      "src/components/layout/Topbar.jsx",
    );

    const icon = read(
      "src/components/layout/StockOutIcon.jsx",
    );

    assert.match(
      topbar,
      /"\/stock-out": "Stock Out"/,
    );

    assert.match(
      icon,
      /function StockOutIcon/,
    );

    assert.match(
      icon,
      /export default StockOutIcon/,
    );
  },
);

test(
  "Stock-Out page enforces creator and Auditor read-only roles",
  () => {
    const page = read(
      "src/pages/StockOut.jsx",
    );

    assert.match(
      page,
      /USER_ROLES\.SUPERADMIN/,
    );

    assert.match(
      page,
      /USER_ROLES\.ADMIN/,
    );

    assert.match(
      page,
      /USER_ROLES\.INVENTORY_STAFF/,
    );

    assert.match(
      page,
      /USER_ROLES\.AUDITOR/,
    );

    assert.match(
      page,
      /canCreateStockOut/,
    );

    assert.match(
      page,
      /isReadOnly/,
    );
  },
);

test(
  "Stock-Out workflow includes validation, review, confirmation, and posting",
  () => {
    const page = read(
      "src/pages/StockOut.jsx",
    );

    for (const token of [
      "validateForm",
      "handleReviewStockOut",
      "handleConfirmStockOut",
      "Review & Post Stock Out",
      "Post Stock Out",
      "createStockOutReceipt",
      "expectedNewQuantity",
      "isPosting",
    ]) {
      assert.match(
        page,
        new RegExp(
          token.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      );
    }
  },
);

test(
  "Stock-Out service checks idempotency before Product stock",
  () => {
    const service = read(
      "src/services/stockOutService.js",
    );

    const operationRead =
      service.indexOf(
        "transaction.get(\n            operationReference",
      );

    const productRead =
      service.indexOf(
        "transaction.get(\n            productReference",
      );

    assert.ok(
      operationRead >= 0,
      "Missing operation read",
    );

    assert.ok(
      productRead >= 0,
      "Missing Product read",
    );

    assert.ok(
      operationRead < productRead,
      "Operation must be checked before Product stock",
    );

    assert.match(
      service,
      /isSameStockOutRequest/,
    );

    assert.match(
      service,
      /isReplay:\s*true/,
    );

    assert.match(
      service,
      /isReplay:\s*false/,
    );
  },
);

test(
  "Atomic service writes Product, movement, and operation together",
  () => {
    const service = read(
      "src/services/stockOutService.js",
    );

    assert.match(
      service,
      /runTransaction/,
    );

    assert.match(
      service,
      /transaction\.update\(\s*productReference/s,
    );

    assert.match(
      service,
      /transaction\.set\(\s*movementReference/s,
    );

    assert.match(
      service,
      /transaction\.set\(\s*operationReference/s,
    );
  },
);

test(
  "History supports real-time records, filters, and authoritative detail loading",
  () => {
    const history = read(
      "src/components/StockOutHistory.jsx",
    );

    for (const token of [
      "subscribeToStockOutReceipts",
      "getStockOutReceiptDetails",
      "reasonFilter",
      "dateFrom",
      "dateTo",
      "searchTerm",
      "View Details",
      "Immutable inventory record",
    ]) {
      assert.match(
        history,
        new RegExp(
          token.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      );
    }

    assert.doesNotMatch(
      history,
      />Edit</,
    );

    assert.doesNotMatch(
      history,
      />Delete</,
    );
  },
);

test(
  "Stock-Out Firestore hardening blocks are installed exactly once",
  () => {
    const rules = read(
      "firestore.rules",
    );

    for (const block of [
      "match /products/{productId}",
      "match /stockMovements/{movementId}",
      "match /stockInOperations/{operationId}",
      "match /stockOutOperations/{operationId}",
    ]) {
      assert.equal(
        rules.split(block).length - 1,
        1,
        `${block} must appear exactly once`,
      );
    }

    for (const token of [
      "stockOutOperationMatchesMovement",
      "stockOutMovementMatchesOperation",
      "stockOutProductMatchesMovementAndOperation",
      "dateReleased <= request.time",
      "allow update, delete: if false",
    ]) {
      assert.match(
        rules,
        new RegExp(
          token.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      );
    }
  },
);

test(
  "Rules remain within the Firebase source-size limit",
  () => {
    const bytes = statSync(
      resolve(
        process.cwd(),
        "firestore.rules",
      ),
    ).size;

    assert.ok(
      bytes < 256 * 1024,
      `firestore.rules is ${bytes} bytes`,
    );
  },
);
