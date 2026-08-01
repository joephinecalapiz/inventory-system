#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6H - Lint"
npm run lint

echo
echo "Phase 6H - Production build"
npm run build

echo
echo "Phase 6H - Current-state static regression"
node --test tests/static/phase6h.complete-regression.test.mjs

echo
echo "Phase 6H - Firestore regression"
firebase emulators:exec \
  --only firestore \
  --project demo-inventory-phase6h \
  "node scripts/run-phase6h-firestore-tests.mjs"

echo
echo "Phase 6H automated testing completed."
echo "Complete the Phase 6H manual checklist before closing Phase 6."
