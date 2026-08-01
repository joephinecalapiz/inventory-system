#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6E - Lint"
npm run lint

echo
echo "Phase 6E - Production build"
npm run build

echo
echo "Phase 6E - Static history tests"
node --test tests/static/phase6e.stock-adjustment-history.test.mjs

echo
echo "Phase 6E automated testing completed."
