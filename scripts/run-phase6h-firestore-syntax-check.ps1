$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Phase 6H - Firestore syntax check" -ForegroundColor Cyan

$rules = Get-Content .\firestore.rules -Raw

$stockOutMatchCount = (
  [regex]::Matches(
    $rules,
    'match /stockOutOperations/\{operationId\}'
  )
).Count

if ($stockOutMatchCount -ne 1) {
  throw "Expected exactly one stockOutOperations match block. Found: $stockOutMatchCount"
}

if ($rules -match "`n \{`r?`n  allow get:") {
  throw "An orphan Stock-Out Rules block still exists."
}

Write-Host "Static Firestore syntax checks passed." -ForegroundColor Green
Write-Host "Now run .\scripts\run-phase6h-tests.ps1" -ForegroundColor Yellow
