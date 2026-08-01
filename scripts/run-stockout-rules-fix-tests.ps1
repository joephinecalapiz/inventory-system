$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Stock-Out Rules budget fix - Static test" -ForegroundColor Cyan
node --test tests/static/stockout.rules-budget-fix.test.mjs
if ($LASTEXITCODE -ne 0) { throw "Stock-Out Rules static test failed." }

Write-Host ""
Write-Host "Stock-Out and Phase 6 Firestore regression" -ForegroundColor Cyan
firebase emulators:exec `
  --only firestore `
  --project demo-inventory-stockout-fix `
  "node scripts/run-phase6h-firestore-tests.mjs"
if ($LASTEXITCODE -ne 0) { throw "Firestore regression failed." }

Write-Host ""
Write-Host "Stock-Out Rules fix testing completed." -ForegroundColor Green
