import test from "node:test";
import assert from "node:assert/strict";

import {
  readFileSync,
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
    `Missing ${routePath} route`,
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

function navigationBlock(source, routePath) {
  const marker = `path: "${routePath}"`;
  const start = source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `Missing ${routePath} navigation item`,
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
  "Stock-Out route uses the intended role matrix",
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
      assert.match(block, new RegExp(role));
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
  "Stock-Out sidebar visibility matches the route",
  () => {
    const sidebar = read(
      "src/components/layout/Sidebar.jsx",
    );

    const block = navigationBlock(
      sidebar,
      "/stock-out",
    );

    for (const role of [
      "USER_ROLES.SUPERADMIN",
      "USER_ROLES.ADMIN",
      "USER_ROLES.INVENTORY_STAFF",
      "USER_ROLES.AUDITOR",
    ]) {
      assert.match(block, new RegExp(role));
    }

    assert.doesNotMatch(
      block,
      /USER_ROLES\.CASHIER/,
    );

    assert.match(
      sidebar,
      /import StockOutIcon from "\.\/StockOutIcon";/,
    );
  },
);

test(
  "Topbar includes the Stock-Out title",
  () => {
    const topbar = read(
      "src/components/layout/Topbar.jsx",
    );

    assert.match(
      topbar,
      /"\/stock-out": "Stock Out"/,
    );
  },
);

test(
  "Stock-Out icon is present and exported",
  () => {
    const icon = read(
      "src/components/layout/StockOutIcon.jsx",
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
