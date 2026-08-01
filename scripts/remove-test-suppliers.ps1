$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Removing locally seeded test suppliers..." -ForegroundColor Cyan

$env:FIREBASE_PROJECT_ID = "inventory-system-460a5"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"

node .\scripts\remove-test-suppliers.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Test supplier cleanup failed."
}

Write-Host ""
Write-Host "Test supplier cleanup completed." -ForegroundColor Green
