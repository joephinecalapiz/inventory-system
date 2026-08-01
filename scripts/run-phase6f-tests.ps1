$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6F - Lint" -ForegroundColor Cyan
npm run lint

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6F lint failed."
}

Write-Host ""
Write-Host "Phase 6F - Production build" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6F production build failed."
}

Write-Host ""
Write-Host "Phase 6F - Navigation integration tests" -ForegroundColor Cyan
node --test tests/static/phase6f.navigation-integration.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6F navigation integration tests failed."
}

Write-Host ""
Write-Host "Phase 6F automated testing completed." -ForegroundColor Green
