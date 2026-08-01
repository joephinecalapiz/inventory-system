$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6G - Lint" -ForegroundColor Cyan
npm run lint

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6G lint failed."
}

Write-Host ""
Write-Host "Phase 6G - Production build" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6G production build failed."
}

Write-Host ""
Write-Host "Phase 6G - Static Rules tests" -ForegroundColor Cyan
node --test tests/static/phase6g.rules-source.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6G static Rules tests failed."
}

Write-Host ""
Write-Host "Phase 6G - Firestore Rules tests" -ForegroundColor Cyan
firebase emulators:exec `
  --only firestore `
  --project demo-inventory-phase6g `
  "node --test tests/firestore/phase6g.stock-adjustment.rules.test.mjs"

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6G Firestore Rules tests failed."
}

Write-Host ""
Write-Host "Phase 6G automated testing completed." -ForegroundColor Green
