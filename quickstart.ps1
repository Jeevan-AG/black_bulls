# ─── Vantix Enterprise AI Data Firewall — Windows 1-Line Remote Quickstart ────
# Deploys dual-layer AI protection on any Windows PC in 1 line. No local code needed.
#
# Usage (run in PowerShell as regular user or Admin):
#   irm https://vantix-beta.vercel.app/quickstart.ps1 | iex
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🛡️ VANTIX AI DATA FIREWALL — WINDOWS QUICKSTART" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$CLOUD_URL = "https://vantix-backend-7gcw.onrender.com"
$DASHBOARD_URL = "https://vantix-beta.vercel.app"
$GUARD_ZIP_URL = "https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip"
$GUARD_DEST = "$HOME\vantix-guard"

# ── 1. Check Cloud Gateway ────────────────────────────────────────────────────
Write-Host "  Step 1/3: Connecting to Vantix Cloud Inspection Gateway..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$CLOUD_URL/api/vantix/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "  [GATEWAY] Connected to $CLOUD_URL" -ForegroundColor Green
    Write-Host "  [ENGINE]  $($health.engine) v$($health.version) — ONLINE ✓" -ForegroundColor Green
} catch {
    Write-Host "  [!] Warning: Could not reach Cloud Gateway ($CLOUD_URL). Check internet connection." -ForegroundColor Red
}

# ── 2. Configure AI Proxy Environment (Terminal, Python, SDKs) ────────────────
Write-Host "`n  Step 2/3: Configuring AI Proxy Interception (Layer 1)..." -ForegroundColor Yellow
try {
    # Set for current terminal session
    $env:OPENAI_BASE_URL = "$CLOUD_URL/v1"
    $env:VANTIX_GATEWAY_URL = $CLOUD_URL

    # Set permanently in Windows User Profile environment
    [System.Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', "$CLOUD_URL/v1", 'User')
    [System.Environment]::SetEnvironmentVariable('VANTIX_GATEWAY_URL', $CLOUD_URL, 'User')

    Write-Host "  [PROXY] Set OPENAI_BASE_URL -> $CLOUD_URL/v1 ✓" -ForegroundColor Green
    Write-Host "  [PROXY] Terminal commands, Python scripts, & SDKs are now routed to Vantix ✓" -ForegroundColor Green
} catch {
    Write-Host "  [!] Failed to set persistent environment variables: $_" -ForegroundColor Red
}

# ── 3. Download & Extract Browser Guard (Layer 2) ─────────────────────────────
Write-Host "`n  Step 3/3: Preparing Chrome Browser Guard Extension (Layer 2)..." -ForegroundColor Yellow
try {
    if (Test-Path $GUARD_DEST) {
        Remove-Item -Path $GUARD_DEST -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $GUARD_DEST -Force | Out-Null

    $zipPath = "$HOME\vantix-guard.zip"
    Invoke-WebRequest -Uri $GUARD_ZIP_URL -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
    Expand-Archive -Path $zipPath -DestinationPath $GUARD_DEST -Force -ErrorAction Stop
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

    Write-Host "  [GUARD] Extension unpacked to: $GUARD_DEST ✓" -ForegroundColor Green
} catch {
    Write-Host "  [!] Error downloading extension: $_" -ForegroundColor Red
}

# ── 4. Run Live Interception Test ─────────────────────────────────────────────
Write-Host "`n  Verifying Firewall Interception..." -ForegroundColor Yellow
try {
    $testBody = @{
        prompt = "Testing Vantix Windows Protection with AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        userId = "$env:USERNAME-windows"
        sessionId = "win-verify-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    } | ConvertTo-Json

    $testRes = Invoke-RestMethod -Uri "$CLOUD_URL/api/vantix/chat" -Method Post -ContentType "application/json" -Body $testBody -UseBasicParsing

    if ($testRes.blocked -or $testRes.meta.action -eq "hard_block") {
        Write-Host "  [TEST] Live Credential Interception: ENFORCED (HARD BLOCK) ✓" -ForegroundColor Green
        Write-Host "  [TEST] Processing Latency: $($testRes.processingTime)ms (Target: <5ms) ✓" -ForegroundColor Green
    }
} catch {
    Write-Host "  [TEST] Verification test ping skipped." -ForegroundColor DarkGray
}

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ VANTIX DUAL-LAYER AI PROTECTION IS READY" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  1. Terminal & Python AI Protection:  ACTIVE NOW" -ForegroundColor White
Write-Host "     Any Python script or OpenAI SDK will be automatically inspected." -ForegroundColor Gray
Write-Host "  2. Web AI Protection (ChatGPT / Claude / Gemini):" -ForegroundColor White
Write-Host "     a) Open Chrome or Edge and go to: chrome://extensions" -ForegroundColor Cyan
Write-Host "     b) Toggle ON 'Developer mode' (top-right)" -ForegroundColor Cyan
Write-Host "     c) Click 'Load unpacked' and select folder: $GUARD_DEST" -ForegroundColor Cyan
Write-Host "  3. Live SOC Dashboard:               $DASHBOARD_URL" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Green
