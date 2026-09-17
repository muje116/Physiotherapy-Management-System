param(
  [switch]$SkipContainers,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

if (-not $SkipContainers) {
  Write-Host "=== Starting test containers ===" -ForegroundColor Cyan
  docker compose -f "$ROOT\docker\docker-compose.test.yml" up -d --wait

  Write-Host "=== Waiting for PostgreSQL ===" -ForegroundColor Cyan
  $maxRetries = 30
  $retry = 0
  do {
    $result = docker compose -f "$ROOT\docker\docker-compose.test.yml" exec -T postgres_test pg_isready -U test 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    $retry++
    Start-Sleep -Seconds 2
  } while ($retry -lt $maxRetries)

  if ($retry -eq $maxRetries) {
    Write-Host "ERROR: PostgreSQL did not become ready" -ForegroundColor Red
    exit 1
  }
  Write-Host "PostgreSQL is ready" -ForegroundColor Green

  Write-Host "=== Running Prisma migrations on test DB ===" -ForegroundColor Cyan
  Push-Location "$ROOT\packages\db"
  try {
    dotenv -e "$ROOT\.env.test" -- npx prisma migrate deploy
    if (-not $?) { throw "Migration failed" }
  } finally {
    Pop-Location
  }

  if (-not $SkipSeed) {
    Write-Host "=== Seeding test database ===" -ForegroundColor Cyan
    Push-Location "$ROOT\packages\db"
    try {
      dotenv -e "$ROOT\.env.test" -- npx prisma db seed
      if (-not $?) { throw "Seed failed" }
    } finally {
      Pop-Location
    }
  }
}

Write-Host "=== Running integration tests ===" -ForegroundColor Cyan
Push-Location "$ROOT\apps\api"
try {
  npx vitest run --config vitest.config.integration.ts
  if (-not $?) { throw "Integration tests failed" }
} finally {
  Pop-Location
}

if (-not $SkipContainers) {
  Write-Host "=== Tearing down test containers ===" -ForegroundColor Cyan
  docker compose -f "$ROOT\docker\docker-compose.test.yml" down -v
}

Write-Host "=== Integration tests complete ===" -ForegroundColor Green
