#!/usr/bin/env bash
set -euo pipefail

echo
echo "Phase 6F - Lint"
npm run lint

echo
echo "Phase 6F - Production build"
npm run build

echo
echo "Phase 6F - Navigation integration tests"
node --test tests/static/phase6f.navigation-integration.test.mjs

echo
echo "Phase 6F automated testing completed."
