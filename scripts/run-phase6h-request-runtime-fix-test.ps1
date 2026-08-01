$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6H - Stock Adjustment request runtime fix" -ForegroundColor Cyan
node --test tests/static/phase6h.request-runtime-fix.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H request runtime fix test failed."
}

Write-Host ""
Write-Host "Phase 6H request runtime fix passed." -ForegroundColor Green
