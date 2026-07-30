#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6B — Lint"
npm run lint

echo
echo "Phase 6B — Production build"
npm run build

echo
echo "Phase 6B — Static service tests"
node --test tests/static/phase6b.stock-adjustment-service.test.mjs

echo
echo "Phase 6B automated testing completed."
