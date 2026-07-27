#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 4I-3 — Static installation tests"
node --test tests/static/phase4i3.source.test.mjs

if ! npm ls @firebase/rules-unit-testing --depth=0 >/dev/null 2>&1; then
  echo
  echo "Installing @firebase/rules-unit-testing..."
  npm install --save-dev @firebase/rules-unit-testing
fi

echo
echo "Phase 4I-3 — Firestore Rules tests"
firebase emulators:exec \
  --only firestore \
  --project demo-inventory-phase4i3 \
  "node --test tests/firestore/phase4i3.rules.test.mjs"

echo
echo "Phase 4I-3 automated tests completed."
echo "Complete PHASE_4I3_MANUAL_TEST_CHECKLIST.md next."
