import {
  existsSync,
} from "node:fs";

import {
  spawnSync,
} from "node:child_process";

const testFiles = [
  "tests/firestore/phase5g.stockout.rules.test.mjs",
  "tests/firestore/phase6g.stock-adjustment.rules.test.mjs",
  "tests/firestore/phase6h.regression.rules.test.mjs",
];

for (const testFile of testFiles) {
  if (!existsSync(testFile)) {
    console.error(
      `Missing required Firestore regression test: ${testFile}`,
    );

    process.exit(1);
  }

  console.log("");
  console.log(
    `Running ${testFile}`,
  );

  const result = spawnSync(
    process.execPath,
    [
      "--test",
      testFile,
    ],
    {
      stdio:
        "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(
      result.status ?? 1,
    );
  }
}

console.log("");
console.log(
  "All Stock Out and Stock Adjustment Firestore regression tests passed.",
);
