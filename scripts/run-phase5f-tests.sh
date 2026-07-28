#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 5F — Static hardening checks"
node --test tests/static/phase5f.hardening.test.mjs

if ! npm ls @firebase/rules-unit-testing --depth=0 >/dev/null 2>&1; then
  echo
  echo "Installing @firebase/rules-unit-testing..."
  npm install --save-dev @firebase/rules-unit-testing
fi

echo
echo "Phase 5F — Firestore Rules tests"
firebase emulators:exec \
  --only firestore \
  --project demo-inventory-phase5f \
  "node --test tests/firestore/phase5f.stockout.rules.test.mjs"

echo
echo "Phase 5F tests completed."
