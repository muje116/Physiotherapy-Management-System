param(
  [switch]$SkipContainers,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$env:DATABASE_URL = "postgresql://test:test@localhost:5433/physiocore_test"
$env:REDIS_URL = "redis://localhost:6380"
$env:JWT_ACCESS_SECRET = "test-access-secret"
$env:JWT_REFRESH_SECRET = "test-refresh-secret"
$env:FRONTEND_URL = "http://localhost:3000"
$env:NODE_ENV = "test"
$env:LOG_LEVEL = "silent"

if (-not $SkipContainers) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is required for containerized integration tests. Install/start Docker, or use -SkipContainers for the mocked HTTP integration suite."
  }

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
    pnpm exec prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "Migration failed" }
  } finally {
    Pop-Location
  }

  if (-not $SkipSeed) {
    Write-Host "=== Seeding test database ===" -ForegroundColor Cyan
    Push-Location "$ROOT\packages\db"
    try {
      pnpm exec prisma db seed
      if ($LASTEXITCODE -ne 0) { throw "Seed failed" }
    } finally {
      Pop-Location
    }
  }
}

Write-Host "=== Running integration tests ===" -ForegroundColor Cyan
Push-Location "$ROOT\apps\api"
try {
  pnpm exec vitest run --config vitest.config.integration.ts
  if ($LASTEXITCODE -ne 0) { throw "Integration tests failed" }
} finally {
  Pop-Location
}

if (-not $SkipContainers) {
  Write-Host "=== Tearing down test containers ===" -ForegroundColor Cyan
  docker compose -f "$ROOT\docker\docker-compose.test.yml" down -v
}

Write-Host "=== Integration tests complete ===" -ForegroundColor Green
