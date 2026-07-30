$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 5F — Static hardening checks" -ForegroundColor Cyan
node --test tests/static/phase5f.hardening.test.mjs

Write-Host ""
Write-Host "Checking @firebase/rules-unit-testing..." -ForegroundColor Cyan
npm ls @firebase/rules-unit-testing --depth=0 *> $null

if ($LASTEXITCODE -ne 0) {
  Write-Host "Installing @firebase/rules-unit-testing..." -ForegroundColor Yellow
  npm install --save-dev @firebase/rules-unit-testing
}

Write-Host ""
Write-Host "Phase 5F — Firestore Rules tests" -ForegroundColor Cyan
firebase emulators:exec `
  --only firestore `
  --project demo-inventory-phase5f `
  "node --test tests/firestore/phase5f.stockout.rules.test.mjs"

Write-Host ""
Write-Host "Phase 5F tests completed." -ForegroundColor Green
