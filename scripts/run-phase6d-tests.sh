#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6D - Lint"
npm run lint

echo
echo "Phase 6D - Production build"
npm run build

echo
echo "Phase 6D - Static workflow tests"
node --test tests/static/phase6d.stock-adjustment-approval.test.mjs

echo
echo "Phase 6D automated testing completed."
