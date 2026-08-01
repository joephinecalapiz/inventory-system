#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6G - Lint"
npm run lint

echo
echo "Phase 6G - Production build"
npm run build

echo
echo "Phase 6G - Static Rules tests"
node --test tests/static/phase6g.rules-source.test.mjs

echo
echo "Phase 6G - Firestore Rules tests"
firebase emulators:exec \
  --only firestore \
  --project demo-inventory-phase6g \
  "node --test tests/firestore/phase6g.stock-adjustment.rules.test.mjs"

echo
echo "Phase 6G automated testing completed."
