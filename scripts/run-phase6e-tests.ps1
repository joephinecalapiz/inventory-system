$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6E - Lint" -ForegroundColor Cyan
npm run lint

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6E lint failed."
}

Write-Host ""
Write-Host "Phase 6E - Production build" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6E production build failed."
}

Write-Host ""
Write-Host "Phase 6E - Static history tests" -ForegroundColor Cyan
node --test tests/static/phase6e.stock-adjustment-history.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6E static history tests failed."
}

Write-Host ""
Write-Host "Phase 6E automated testing completed." -ForegroundColor Green
