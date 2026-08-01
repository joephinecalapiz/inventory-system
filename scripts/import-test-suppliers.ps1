$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Importing test suppliers into the local Firestore Emulator..." -ForegroundColor Cyan

$env:FIREBASE_PROJECT_ID = "inventory-system-460a5"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"

node .\scripts\import-test-suppliers.mjs

if ($LASTEXITCODE -ne 0) {
  throw "Test supplier import failed."
}

Write-Host ""
Write-Host "Test supplier import completed." -ForegroundColor Green
