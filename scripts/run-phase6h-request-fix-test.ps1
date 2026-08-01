$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6H - Stock Adjustment request fix test" -ForegroundColor Cyan
node --test tests/static/phase6h.stock-adjustment-request-budget.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H Stock Adjustment request fix test failed."
}

Write-Host ""
Write-Host "Phase 6H Stock Adjustment request fix passed." -ForegroundColor Green
