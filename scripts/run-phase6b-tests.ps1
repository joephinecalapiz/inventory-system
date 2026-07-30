$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6B - Lint" -ForegroundColor Cyan
npm run lint

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6B lint failed."
}

Write-Host ""
Write-Host "Phase 6B - Production build" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6B production build failed."
}

Write-Host ""
Write-Host "Phase 6B - Static service tests" -ForegroundColor Cyan
node --test tests/static/phase6b.stock-adjustment-service.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6B static service tests failed."
}

Write-Host ""
Write-Host "Phase 6B automated testing completed." -ForegroundColor Green
