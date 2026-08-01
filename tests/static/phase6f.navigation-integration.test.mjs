import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath,
} from "node:url";

const currentFile =
  fileURLToPath(import.meta.url);

const projectRoot = path.resolve(
  path.dirname(currentFile),
  "../..",
);

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      projectRoot,
      relativePath,
    ),
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

test("adds all three Stock Adjustment routes", () => {
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
});

test("request route allows operational and audit roles but not Cashier", () => {
  const start = appSource.indexOf(
    'path="/stock-adjustments"',
  );

  const end = appSource.indexOf(
    'path="/stock-adjustments/review"',
  );

  const routeSource =
    appSource.slice(start, end);

  assert.match(
    routeSource,
    /USER_ROLES\.SUPERADMIN/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.ADMIN/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.INVENTORY_STAFF/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.AUDITOR/,
  );

  assert.doesNotMatch(
    routeSource,
    /USER_ROLES\.CASHIER/,
  );
});

test("review route is limited to Superadmin and Admin", () => {
  const start = appSource.indexOf(
    'path="/stock-adjustments/review"',
  );

  const end = appSource.indexOf(
    'path="/stock-adjustments/history"',
  );

  const routeSource =
    appSource.slice(start, end);

  assert.match(
    routeSource,
    /USER_ROLES\.SUPERADMIN/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.ADMIN/,
  );

  assert.doesNotMatch(
    routeSource,
    /USER_ROLES\.INVENTORY_STAFF/,
  );

  assert.doesNotMatch(
    routeSource,
    /USER_ROLES\.AUDITOR/,
  );

  assert.doesNotMatch(
    routeSource,
    /USER_ROLES\.CASHIER/,
  );
});

test("history route allows operational and audit roles but not Cashier", () => {
  const start = appSource.indexOf(
    'path="/stock-adjustments/history"',
  );

  const end = appSource.indexOf(
    'path="/suppliers"',
  );

  const routeSource =
    appSource.slice(start, end);

  assert.match(
    routeSource,
    /USER_ROLES\.SUPERADMIN/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.ADMIN/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.INVENTORY_STAFF/,
  );

  assert.match(
    routeSource,
    /USER_ROLES\.AUDITOR/,
  );

  assert.doesNotMatch(
    routeSource,
    /USER_ROLES\.CASHIER/,
  );
});

test("Sidebar contains request, review, and history items", () => {
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
});

test("parent Stock Adjustments link uses exact matching", () => {
  assert.match(
    sidebarSource,
    /end: true/,
  );

  assert.match(
    sidebarSource,
    /end=\{item\.end \?\? false\}/,
  );
});

test("Topbar includes all Stock Adjustment titles", () => {
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
});

test("keeps existing Stock Out navigation", () => {
  assert.match(
    appSource,
    /path="\/stock-out"/,
  );

  assert.match(
    sidebarSource,
    /label: "Stock Out"/,
  );

  assert.match(
    topbarSource,
    /"\/stock-out": "Stock Out"/,
  );
});
