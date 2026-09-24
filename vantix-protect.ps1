# ─── Vantix Enterprise AI Data Firewall — Windows PowerShell Controller ────────
# Provides full proxy control, status checking, and testing on Windows.
#
# Usage:
#   .\vantix-protect.ps1 start     ← Start Vantix proxy & activate Windows proxy
#   .\vantix-protect.ps1 stop      ← Stop proxy & restore direct connection
#   .\vantix-protect.ps1 status    ← Check proxy and engine health
#   .\vantix-protect.ps1 test      ← Test leak detection (AWS credential block)
#   .\vantix-protect.ps1 send "prompt" ← Send any prompt for inspection
# ─────────────────────────────────────────────────────────────────────────────

param (
    [string]$Command = "status",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BRIDGE_DIR = Join-Path $SCRIPT_DIR "vantix-bridge"
$CLOUD_URL = "https://vantix-backend-7gcw.onrender.com"
$LOCAL_PROXY = "http://127.0.0.1:8443"

function Show-Header {
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  🛡️ VANTIX — ENTERPRISE AI DATA FIREWALL (WINDOWS)" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

switch ($Command.ToLower()) {

    "start" {
        Show-Header
        Write-Host "  Step 1/3: Starting Vantix Network Proxy Bridge..." -ForegroundColor Yellow

        $nodeExists = Get-Command node -ErrorAction SilentlyContinue
        if (-not $nodeExists) {
            Write-Host "  [!] Node.js not detected. Using Cloud Gateway directly..." -ForegroundColor Red
            Write-Host "  Setting OPENAI_BASE_URL to Cloud Gateway..." -ForegroundColor Cyan
            [System.Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', "$CLOUD_URL/v1", 'User')
            $env:OPENAI_BASE_URL = "$CLOUD_URL/v1"
            Write-Host "  ✓ Cloud Gateway active for all OpenAI SDKs / Python scripts." -ForegroundColor Green
            exit 0
        }

        # Start bridgeProxy via bridgeCli in a background job or process
        $bridgeScript = Join-Path $BRIDGE_DIR "bridgeCli.js"
        $job = Start-Process -FilePath "node" -ArgumentList "`"$bridgeScript`" start" -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 2

        Write-Host "  Step 2/3: Configuring Windows System & Terminal Proxy..." -ForegroundColor Yellow
        $env:HTTPS_PROXY = $LOCAL_PROXY
        $env:HTTP_PROXY = $LOCAL_PROXY
        $env:OPENAI_BASE_URL = "$CLOUD_URL/v1"
        [System.Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', "$CLOUD_URL/v1", 'User')

        # Set Windows WinINet System Proxy in Registry
        try {
            Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyEnable -Value 1 -ErrorAction SilentlyContinue
            Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyServer -Value "127.0.0.1:8443" -ErrorAction SilentlyContinue
            Write-Host "  [NET] Windows System Proxy: ACTIVE (127.0.0.1:8443) ✓" -ForegroundColor Green
        } catch {
            Write-Host "  [NET] Terminal environment proxy active ✓" -ForegroundColor Green
        # Step 3: Browser Guard Extension Check & Auto-Download
        Write-Host "  Step 3/3: Checking Browser Guard Extension (Chrome / Edge)..." -ForegroundColor Yellow
        $guardPath = "$HOME\vantix-guard"
        $localGuard = Join-Path $SCRIPT_DIR "vantix-browser-guard"

        if (-not (Test-Path $guardPath)) {
            if (Test-Path $localGuard) {
                Copy-Item -Path $localGuard -Destination $guardPath -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "  [GUARD] Prepared local extension at $guardPath ✓" -ForegroundColor Green
            } else {
                try {
                    Write-Host "  [GUARD] Downloading extension package from cloud..." -ForegroundColor Cyan
                    Invoke-WebRequest -Uri "https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip" -OutFile "$HOME\vantix-guard.zip" -UseBasicParsing -ErrorAction Stop
                    Expand-Archive "$HOME\vantix-guard.zip" -DestinationPath $guardPath -Force -ErrorAction Stop
                    Remove-Item "$HOME\vantix-guard.zip" -ErrorAction SilentlyContinue
                    Write-Host "  [GUARD] Extension ready at $guardPath ✓" -ForegroundColor Green
                } catch {
                    Write-Host "  [GUARD] Cloud download skipped: $_" -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Host "  [GUARD] Extension files already prepared at $guardPath ✓" -ForegroundColor Green
        }

        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host "  ✓ VANTIX DUAL-LAYER FIREWALL IS CONFIGURED" -ForegroundColor White
        Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host "  Layer 1 (Proxy):   ACTIVE (127.0.0.1:8443 + Cloud Gateway)" -ForegroundColor Gray
        Write-Host "                     Intercepts Python, SDKs, cURL, & Terminal AI" -ForegroundColor DarkGray
        Write-Host "  Layer 2 (Browser): READY at $guardPath" -ForegroundColor Gray
        Write-Host "                     Load once in chrome://extensions to protect web AI" -ForegroundColor DarkGray
        Write-Host "  Admin Dashboard:   https://vantix-beta.vercel.app" -ForegroundColor Gray
        Write-Host "───────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
        Write-Host "  To test detection: .\vantix-protect.ps1 test" -ForegroundColor Yellow
        Write-Host "  To stop proxy:     .\vantix-protect.ps1 stop" -ForegroundColor Yellow
        Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Green
    }

    "stop" {
        Show-Header
        Write-Host "  Stopping Vantix Proxy & Restoring Direct Connection..." -ForegroundColor Yellow

        # Disable Windows System Proxy in Registry
        try {
            Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyEnable -Value 0 -ErrorAction SilentlyContinue
            Write-Host "  [NET] Windows System Proxy: DISABLED ✓" -ForegroundColor Green
        } catch {}

        # Remove environment variables
        Remove-Item Env:\HTTPS_PROXY -ErrorAction SilentlyContinue
        Remove-Item Env:\HTTP_PROXY -ErrorAction SilentlyContinue
        [System.Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', $null, 'User')

        # Terminate any running bridge processes
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*bridgeCli.js*" } | Stop-Process -Force -ErrorAction SilentlyContinue

        Write-Host "  [ENGINE] Local bridge processes stopped ✓" -ForegroundColor Green
        Write-Host "  System restored to direct internet access.`n" -ForegroundColor Gray
    }

    "status" {
        Show-Header
        Write-Host "  Host: $env:COMPUTERNAME | User: $env:USERNAME" -ForegroundColor Gray
        Write-Host ""

        # Test Cloud Gateway
        try {
            $cloudRes = Invoke-RestMethod -Uri "$CLOUD_URL/api/vantix/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
            Write-Host "  Cloud Gateway ($CLOUD_URL):" -NoNewline
            Write-Host " ONLINE ✓ ($($cloudRes.engine) v$($cloudRes.version))" -ForegroundColor Green
        } catch {
            Write-Host "  Cloud Gateway: OFFLINE / UNREACHABLE ✗" -ForegroundColor Red
        }

        # Test Local Proxy (port 8443)
        $proxyActive = $false
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 8443)
            $tcp.Close()
            $proxyActive = $true
            Write-Host "  Local MITM Proxy (port 8443):           RUNNING ✓" -ForegroundColor Green
        } catch {
            Write-Host "  Local MITM Proxy (port 8443):           STOPPED ✗" -ForegroundColor DarkGray
        }

        # Check Windows Registry Proxy setting
        try {
            $reg = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
            if ($reg.ProxyEnable -eq 1) {
                Write-Host "  Windows System Proxy:                   ENABLED ✓ ($($reg.ProxyServer))" -ForegroundColor Green
            } else {
                Write-Host "  Windows System Proxy:                   DISABLED (Direct connection)" -ForegroundColor DarkGray
            }
        } catch {}

        # Check Browser Guard extension folder
        $guardPath = "$HOME\vantix-guard"
        if (Test-Path $guardPath) {
            Write-Host "  Browser Guard Extension:                DOWNLOADED ✓ ($guardPath)" -ForegroundColor Green
        } else {
            Write-Host "  Browser Guard Extension:                NOT DOWNLOADED ✗" -ForegroundColor DarkGray
        }

        Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
    }

    "test" {
        Show-Header
        Write-Host "  Sending test prompt containing live AWS Secret Key..." -ForegroundColor Yellow
        $prompt = "Testing Vantix AI firewall with AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

        $body = @{
            prompt = $prompt
            userId = "$env:USERNAME-windows"
            sessionId = "win-test-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        } | ConvertTo-Json

        try {
            $response = Invoke-RestMethod -Uri "$CLOUD_URL/api/vantix/chat" -Method Post -ContentType "application/json" -Body $body
            Write-Host "`n  🛡️ INTERCEPTION RESULT:" -ForegroundColor Cyan
            if ($response.blocked -or $response.meta.action -eq "hard_block") {
                Write-Host "  ⛔ SECURITY ENFORCEMENT: HARD BLOCK" -ForegroundColor Red
                Write-Host "     Prompt was blocked before reaching external AI." -ForegroundColor Gray
                Write-Host "  Risk Score:       $($response.meta.riskScore)/100" -ForegroundColor Yellow
                Write-Host "  Categories:       $($response.meta.categoriesRedacted -join ', ')" -ForegroundColor Yellow
                Write-Host "  Latency:          $($response.processingTime)ms" -ForegroundColor Green
                Write-Host "  Response Message: $($response.response)" -ForegroundColor Gray
            } else {
                Write-Host "  ⚡ TEE SANITIZATION: REDACTED" -ForegroundColor Green
                Write-Host "  Sanitized Prompt: $($response.sanitizedPrompt)" -ForegroundColor Gray
            }
            Write-Host "`n  ✓ Live event broadcasted to Dashboard: https://vantix-beta.vercel.app`n" -ForegroundColor Green
        } catch {
            Write-Host "  [!] Error connecting to Vantix Gateway: $_" -ForegroundColor Red
        }
    }

    "send" {
        $customPrompt = $RemainingArgs -join " "
        if (-not $customPrompt) {
            Write-Host "Usage: .\vantix-protect.ps1 send `"Your prompt with secrets`"" -ForegroundColor Yellow
            exit 0
        }
        Show-Header
        Write-Host "  Inspecting prompt: `"$customPrompt`"..." -ForegroundColor Yellow

        $body = @{
            prompt = $customPrompt
            userId = "$env:USERNAME-windows"
            sessionId = "win-live-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        } | ConvertTo-Json

        try {
            $response = Invoke-RestMethod -Uri "$CLOUD_URL/api/vantix/chat" -Method Post -ContentType "application/json" -Body $body
            Write-Host "`n  Action Taken:     $($response.meta.action)" -ForegroundColor Cyan
            Write-Host "  Risk Score:       $($response.meta.riskScore)/100" -ForegroundColor Yellow
            Write-Host "  AI Response:      $($response.response)" -ForegroundColor Gray
            Write-Host "`n  ✓ Live telemetry sent to Admin Dashboard.`n" -ForegroundColor Green
        } catch {
            Write-Host "  [!] Error: $_" -ForegroundColor Red
        }
    }

    default {
        Show-Header
        Write-Host "  Commands:" -ForegroundColor White
        Write-Host "    .\vantix-protect.ps1 start          Start proxy & route traffic"
        Write-Host "    .\vantix-protect.ps1 stop           Stop proxy & restore system"
        Write-Host "    .\vantix-protect.ps1 status         Check proxy and engine status"
        Write-Host "    .\vantix-protect.ps1 test           Run test credential leak"
        Write-Host "    .\vantix-protect.ps1 send <prompt>  Test custom prompt"
        Write-Host ""
    }
}
