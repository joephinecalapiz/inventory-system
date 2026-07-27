$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 4I-3 — Static installation tests" -ForegroundColor Cyan
node --test tests/static/phase4i3.source.test.mjs

Write-Host ""
Write-Host "Checking @firebase/rules-unit-testing..." -ForegroundColor Cyan
npm ls @firebase/rules-unit-testing --depth=0 *> $null

if ($LASTEXITCODE -ne 0) {
  Write-Host "Installing @firebase/rules-unit-testing..." -ForegroundColor Yellow
  npm install --save-dev @firebase/rules-unit-testing
}

Write-Host ""
Write-Host "Phase 4I-3 — Firestore Rules tests" -ForegroundColor Cyan
firebase emulators:exec `
  --only firestore `
  --project demo-inventory-phase4i3 `
  "node --test tests/firestore/phase4i3.rules.test.mjs"

Write-Host ""
Write-Host "Phase 4I-3 automated tests completed." -ForegroundColor Green
Write-Host "Complete PHASE_4I3_MANUAL_TEST_CHECKLIST.md next." -ForegroundColor Green
