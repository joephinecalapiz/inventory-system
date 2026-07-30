#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 5G — Lint"
npm run lint

echo
echo "Phase 5G — Production build"
npm run build

echo
echo "Phase 5G — Static source and integration tests"
node --test tests/static/phase5g.source-regression.test.mjs

if ! npm ls @firebase/rules-unit-testing --depth=0 >/dev/null 2>&1; then
  echo
  echo "Installing @firebase/rules-unit-testing..."
  npm install --save-dev @firebase/rules-unit-testing
fi

echo
echo "Phase 5G — Firestore Rules tests"
firebase emulators:exec \
  --only firestore \
  --project demo-inventory-phase5g \
  "node --test tests/firestore/phase5g.stockout.rules.test.mjs"

echo
echo "Phase 5G automated testing completed."
echo "Complete PHASE_5G_MANUAL_TEST_CHECKLIST.md next."
