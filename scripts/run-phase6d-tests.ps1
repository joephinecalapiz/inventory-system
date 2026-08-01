$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6D - Lint" -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) {
  throw "Phase 6D lint failed."
}

Write-Host ""
Write-Host "Phase 6D - Production build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "Phase 6D production build failed."
}

Write-Host ""
Write-Host "Phase 6D - Static workflow tests" -ForegroundColor Cyan
node --test tests/static/phase6d.stock-adjustment-approval.test.mjs
if ($LASTEXITCODE -ne 0) {
  throw "Phase 6D static workflow tests failed."
}

Write-Host ""
Write-Host "Phase 6D automated testing completed." -ForegroundColor Green
