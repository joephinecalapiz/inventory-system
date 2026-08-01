$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6H - Manual runtime fix static tests" -ForegroundColor Cyan

node --test tests/static/phase6h.manual-runtime-fix.test.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Phase 6H manual runtime fix tests failed."
}

Write-Host ""
Write-Host "Phase 6H manual runtime fix static tests passed." -ForegroundColor Green
