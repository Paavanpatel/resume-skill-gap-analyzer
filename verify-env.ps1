# ============================================================
# Resume Skill Gap Analyzer - Environment Verification Script
# Windows PowerShell Version
#
# FIRST TIME SETUP (run PowerShell as Administrator once):
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# Then run from the project folder:
#   .\verify-env.ps1
# ============================================================

$pass = 0
$fail = 0
$warn = 0

function Write-Pass($msg)  { Write-Host "  $msg" -ForegroundColor Green  }
function Write-Fail($msg)  { Write-Host "  $msg" -ForegroundColor Red    }
function Write-Warn($msg)  { Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Title($msg) { Write-Host "" ; Write-Host $msg -ForegroundColor Cyan ; Write-Host "  ----------------" }

# ─── Generic tool checker ────────────────────────────────────
function Check-Tool {
    param(
        [string]$Name,
        [string]$Command,
        [string[]]$Args,
        [bool]$Optional = $false
    )

    $label = $Name.PadRight(24)

    try {
        $output = & $Command @Args 2>&1 | Select-Object -First 1
        $output = "$output".Trim()
        Write-Pass "PASS  $label $output"
        $script:pass++
    }
    catch {
        if ($Optional) {
            Write-Warn "WARN  $label not found (optional)"
            $script:warn++
        }
        else {
            Write-Fail "FAIL  $label not found"
            $script:fail++
        }
    }
}

# ─── Port checker ────────────────────────────────────────────
function Check-Port {
    param([int]$Port)

    $label = "Port $Port".PadRight(24)
    $inUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

    if ($inUse) {
        Write-Warn "WARN  $label in use - may conflict"
        $script:warn++
    }
    else {
        Write-Pass "PASS  $label available"
        $script:pass++
    }
}

# ════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Resume Skill Gap Analyzer - Environment Check       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# ─── Required tools ──────────────────────────────────────────
Write-Title "Required Tools"

Check-Tool -Name "Git"            -Command "git"    -Args @("--version")
Check-Tool -Name "Node.js"        -Command "node"   -Args @("--version")
Check-Tool -Name "npm"            -Command "npm"    -Args @("--version")
Check-Tool -Name "Python"         -Command "python" -Args @("--version")
Check-Tool -Name "pip"            -Command "pip"    -Args @("--version")
Check-Tool -Name "Docker"         -Command "docker" -Args @("--version")
Check-Tool -Name "Docker Compose" -Command "docker" -Args @("compose", "version", "--short")

# ─── Optional tools ──────────────────────────────────────────
Write-Title "Optional Tools"

Check-Tool -Name "psql (pg client)" -Command "psql"  -Args @("--version") -Optional $true
Check-Tool -Name "nvm"              -Command "nvm"   -Args @("--version")  -Optional $true

# ─── Python version gate (3.11+) ─────────────────────────────
Write-Title "Version Gates"

try {
    $pyOut = & python --version 2>&1
    if ("$pyOut" -match "Python (\d+)\.(\d+)") {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        $label = "Python >= 3.11".PadRight(24)
        if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 11)) {
            Write-Pass "PASS  $label $pyOut"
            $pass++
        }
        else {
            Write-Warn "WARN  $label found $pyOut but 3.11+ is recommended"
            $warn++
        }
    }
}
catch {
    Write-Fail "FAIL  Python version check failed"
    $fail++
}

try {
    $nodeOut = & node --version 2>&1
    if ("$nodeOut" -match "v(\d+)") {
        $major = [int]$Matches[1]
        $label = "Node.js >= 18 LTS".PadRight(24)
        if ($major -ge 18) {
            Write-Pass "PASS  $label $nodeOut"
            $pass++
        }
        else {
            Write-Warn "WARN  $label found $nodeOut but v20 LTS is required"
            $warn++
        }
    }
}
catch {
    Write-Fail "FAIL  Node.js version check failed"
    $fail++
}

# ─── Port availability ───────────────────────────────────────
Write-Title "Port Availability"

Check-Port 3000
Check-Port 8000
Check-Port 5432

# ─── Docker daemon running? ──────────────────────────────────
Write-Title "Docker Daemon"

try {
    $dockerInfo = & docker info 2>&1
    $label = "Docker running".PadRight(24)
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "PASS  $label Docker Desktop is active"
        $pass++
    }
    else {
        Write-Fail "FAIL  $label daemon not running - start Docker Desktop"
        $fail++
    }
}
catch {
    Write-Fail "FAIL  Cannot reach Docker daemon"
    $fail++
}

# ─── Summary ─────────────────────────────────────────────────
Write-Host ""
Write-Host "------------------------------------------------------"
Write-Host ("  Passed  : " + $pass) -ForegroundColor Green
Write-Host ("  Failed  : " + $fail) -ForegroundColor Red
Write-Host ("  Warnings: " + $warn) -ForegroundColor Yellow
Write-Host "------------------------------------------------------"

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "  Some required tools are missing." -ForegroundColor Red
    Write-Host "  See PHASE-0-SETUP.md for installation instructions." -ForegroundColor Red
    exit 1
}
else {
    Write-Host ""
    Write-Host "  All checks passed. Ready for Phase 1!" -ForegroundColor Green
    exit 0
}
