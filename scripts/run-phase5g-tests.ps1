$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 5G — Lint" -ForegroundColor Cyan
npm run lint


if ($LASTEXITCODE -ne 0) {
  throw "Phase 5G lint failed."
}

Write-Host ""
Write-Host "Phase 5G — Production build" -ForegroundColor Cyan
npm run build


if ($LASTEXITCODE -ne 0) {
  throw "Phase 5G production build failed."
}

Write-Host ""
Write-Host "Phase 5G — Static source and integration tests" -ForegroundColor Cyan
node --test tests/static/phase5g.source-regression.test.mjs


if ($LASTEXITCODE -ne 0) {
  throw "Phase 5G static tests failed."
}

Write-Host ""
Write-Host "Phase 5G — Firestore Rules tests" -ForegroundColor Cyan
firebase emulators:exec `
  --only firestore `
  --project demo-inventory-phase5g `
  "node --test tests/firestore/phase5g.stockout.rules.test.mjs"


if ($LASTEXITCODE -ne 0) {
  throw "Phase 5G Firestore Rules tests failed."
}
