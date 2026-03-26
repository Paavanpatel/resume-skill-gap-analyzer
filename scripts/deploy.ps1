# ==============================================================
# Resume Skill Gap Analyzer - Production Deployment Script
# Validates environment, builds images, and starts services.
#
# Usage:
#   .\scripts\deploy.ps1              # Full deploy
#   .\scripts\deploy.ps1 -SkipBuild   # Restart without rebuilding
#   .\scripts\deploy.ps1 -Validate    # Only validate, don't deploy
# ==============================================================

param(
    [switch]$SkipBuild,
    [switch]$Validate
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  RSGA Production Deployment"
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Validate prerequisites ───────────────────────────
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Docker
$dockerVersion = docker --version 2>$null
if (-not $dockerVersion) {
    Write-Host "FAIL: Docker is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  PASS: $dockerVersion" -ForegroundColor Green

# Docker Compose
$composeVersion = docker compose version 2>$null
if (-not $composeVersion) {
    Write-Host "FAIL: Docker Compose is not available." -ForegroundColor Red
    exit 1
}
Write-Host "  PASS: $composeVersion" -ForegroundColor Green

# ── Step 2: Validate environment file ─────────────────────────
Write-Host ""
Write-Host "[2/6] Validating production environment..." -ForegroundColor Yellow

$envFile = Join-Path $ROOT ".env.production"
if (-not (Test-Path $envFile)) {
    Write-Host "FAIL: .env.production not found." -ForegroundColor Red
    Write-Host "  Copy .env.production.example to .env.production and fill in values." -ForegroundColor Gray
    exit 1
}
Write-Host "  PASS: .env.production exists" -ForegroundColor Green

# Check for placeholder values that must be changed
$envContent = Get-Content $envFile -Raw
$placeholders = @(
    "GENERATE_A_64_CHAR_RANDOM_STRING_HERE",
    "GENERATE_A_STRONG_PASSWORD_HERE",
    "GENERATE_ANOTHER_64_CHAR_RANDOM_STRING",
    "YOUR_REAL_KEY_HERE",
    "yourdomain.com"
)

$hasPlaceholders = $false
foreach ($placeholder in $placeholders) {
    if ($envContent -match [regex]::Escape($placeholder)) {
        Write-Host "  FAIL: Found placeholder '$placeholder' in .env.production" -ForegroundColor Red
        $hasPlaceholders = $true
    }
}

if ($hasPlaceholders) {
    Write-Host ""
    Write-Host "  Replace all placeholder values before deploying." -ForegroundColor Red
    exit 1
}
Write-Host "  PASS: No placeholder values detected" -ForegroundColor Green

# Check critical env vars are non-empty
$criticalVars = @("POSTGRES_PASSWORD", "REDIS_PASSWORD", "SECRET_KEY", "JWT_SECRET_KEY", "OPENAI_API_KEY")
foreach ($var in $criticalVars) {
    $match = Select-String -Path $envFile -Pattern "^$var=(.+)$"
    if (-not $match -or $match.Matches[0].Groups[1].Value.Trim() -eq "") {
        Write-Host "  FAIL: $var is missing or empty in .env.production" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  PASS: All critical environment variables are set" -ForegroundColor Green

# ── Step 3: Validate TLS certificates ────────────────────────
Write-Host ""
Write-Host "[3/6] Checking TLS certificates..." -ForegroundColor Yellow

$sslDir = Join-Path $ROOT "infrastructure\nginx\ssl"
$certFile = Join-Path $sslDir "fullchain.pem"
$keyFile = Join-Path $sslDir "privkey.pem"

if (-not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
    Write-Host "  WARN: TLS certificates not found in infrastructure/nginx/ssl/" -ForegroundColor DarkYellow
    Write-Host "  Expected: fullchain.pem and privkey.pem" -ForegroundColor Gray
    Write-Host "  HTTPS will not work without valid certificates." -ForegroundColor Gray
    Write-Host "  For testing, generate self-signed certs:" -ForegroundColor Gray
    Write-Host "    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \" -ForegroundColor Gray
    Write-Host "      -keyout infrastructure/nginx/ssl/privkey.pem \" -ForegroundColor Gray
    Write-Host "      -out infrastructure/nginx/ssl/fullchain.pem" -ForegroundColor Gray
} else {
    Write-Host "  PASS: TLS certificates found" -ForegroundColor Green
}

if ($Validate) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  Validation complete. Use without -Validate to deploy."
    Write-Host "================================================" -ForegroundColor Green
    exit 0
}

# ── Step 4: Build images ─────────────────────────────────────
Write-Host ""
Write-Host "[4/6] Building production images..." -ForegroundColor Yellow

Set-Location $ROOT

if (-not $SkipBuild) {
    docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: Docker build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  PASS: Images built successfully" -ForegroundColor Green
} else {
    Write-Host "  SKIP: Using existing images (-SkipBuild)" -ForegroundColor DarkYellow
}

# ── Step 5: Start services ───────────────────────────────────
Write-Host ""
Write-Host "[5/6] Starting production services..." -ForegroundColor Yellow

docker compose -f docker-compose.prod.yml --env-file .env.production up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: Failed to start services." -ForegroundColor Red
    exit 1
}

# Wait for health checks
Write-Host "  Waiting for services to become healthy (up to 60s)..." -ForegroundColor Gray
$maxWait = 60
$elapsed = 0

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 5
    $elapsed += 5

    $healthy = docker compose -f docker-compose.prod.yml --env-file .env.production ps --format json 2>$null |
        ConvertFrom-Json |
        Where-Object { $_.Health -eq "healthy" -or $_.State -eq "running" }

    $total = docker compose -f docker-compose.prod.yml --env-file .env.production ps --format json 2>$null |
        ConvertFrom-Json

    if ($healthy.Count -ge $total.Count -and $total.Count -gt 0) {
        break
    }

    Write-Host "  ... $elapsed`s elapsed ($($healthy.Count)/$($total.Count) ready)" -ForegroundColor Gray
}

# ── Step 6: Verify deployment ─────────────────────────────────
Write-Host ""
Write-Host "[6/6] Verifying deployment..." -ForegroundColor Yellow

docker compose -f docker-compose.prod.yml --env-file .env.production ps

Write-Host ""

# Check backend health
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/health" -TimeoutSec 5 -ErrorAction Stop
    if ($health.status -eq "healthy") {
        Write-Host "  PASS: Backend health check passed" -ForegroundColor Green
    } else {
        Write-Host "  WARN: Backend returned unexpected status: $($health.status)" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "  WARN: Could not reach backend health endpoint (may still be starting)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Deployment complete!"
Write-Host ""
Write-Host "  Services: docker compose -f docker-compose.prod.yml --env-file .env.production ps"
Write-Host "  Logs:     docker compose -f docker-compose.prod.yml logs -f"
Write-Host "  Stop:     docker compose -f docker-compose.prod.yml down"
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
