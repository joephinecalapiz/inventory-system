#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6C — Lint"
npm run lint

echo
echo "Phase 6C — Production build"
npm run build

echo
echo "Phase 6C — Static page tests"
node --test tests/static/phase6c.stock-adjustment-page.test.mjs

echo
echo "Phase 6C automated testing completed."
