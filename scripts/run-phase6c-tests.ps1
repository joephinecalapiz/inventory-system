$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6C - Lint" -ForegroundColor Cyan
npm run lint

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6C lint failed."
}

Write-Host ""
Write-Host "Phase 6C - Production build" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6C production build failed."
}

Write-Host ""
Write-Host "Phase 6C - Static page tests" -ForegroundColor Cyan
node --test tests/static/phase6c.stock-adjustment-page.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6C static page tests failed."
}

Write-Host ""
Write-Host "Phase 6C automated testing completed." -ForegroundColor Green
