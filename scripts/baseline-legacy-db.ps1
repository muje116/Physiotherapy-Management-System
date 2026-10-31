param(
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$migrations = @(
  '20260630094251_add_missing_relations',
  '20260827120000_add_patient_assessment_details',
  '20260910120000_add_report_exports',
  '20260911120000_add_patient_feedback',
  '20260919120000_add_inventory_and_employee_details',
  '20260919150000_add_payment_requests',
  '20260929120000_production_hardening',
  '20261026120000_add_clinical_safety_and_observations',
  '20261026140000_add_appointment_check_in_queue'
)

if (-not $Apply) {
  Write-Host 'This records the existing legacy database as current against the checked-in migrations.' -ForegroundColor Yellow
  Write-Host 'It does not create, alter, or delete application data.' -ForegroundColor Yellow
  Write-Host 'Run again with -Apply only after confirming the database has been synchronized additively.' -ForegroundColor Yellow
  exit 0
}

Push-Location (Join-Path $root 'packages\db')
try {
  foreach ($migration in $migrations) {
    Write-Host "Marking $migration as applied..." -ForegroundColor Cyan
    $output = @(pnpm exec prisma migrate resolve --applied $migration 2>&1)
    $output | ForEach-Object { Write-Host $_ }
    $commandOutput = $output -join "`n"
    if ($LASTEXITCODE -ne 0 -and $commandOutput -notmatch 'already recorded as applied') {
      throw "Could not mark migration as applied: $migration"
    }
  }
} finally {
  Pop-Location
}

Write-Host 'Legacy database baseline recorded.' -ForegroundColor Green
