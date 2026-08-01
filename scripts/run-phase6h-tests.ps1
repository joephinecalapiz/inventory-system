$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6H - Lint" -ForegroundColor Cyan
npm run lint

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H lint failed."
}

Write-Host ""
Write-Host "Phase 6H - Production build" -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H production build failed."
}

Write-Host ""
Write-Host "Phase 6H - Current-state static regression" -ForegroundColor Cyan
node --test tests/static/phase6h.complete-regression.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H current-state static regression failed."
}

Write-Host ""
Write-Host "Phase 6H - Firestore regression" -ForegroundColor Cyan
firebase emulators:exec `
  --only firestore `
  --project demo-inventory-phase6h `
  "node scripts/run-phase6h-firestore-tests.mjs"

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H Firestore regression failed."
}

Write-Host ""
Write-Host "Phase 6H automated testing completed." -ForegroundColor Green
Write-Host "Complete the Phase 6H manual checklist before closing Phase 6." -ForegroundColor Yellow
