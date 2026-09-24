# ─── Vantix Standalone AI Guard — Windows Installer Script ─────────────────────
# Automatically sets up the extension on Windows without needing any servers or admin tools!
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   VANTIX STANDALONE AI DATA GUARD — WINDOWS SETUP" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtSource = Join-Path $ScriptDir "vantix-guard-extension"
$UserDest = Join-Path $env:USERPROFILE "vantix-guard-extension"

Write-Host "[1/3] Copying self-contained extension to your user folder..." -ForegroundColor Yellow
if (Test-Path $UserDest) {
    Remove-Item $UserDest -Recurse -Force
}

Copy-Item -Path $ExtSource -Destination $UserDest -Recurse -Force
Write-Host "      Location: $UserDest" -ForegroundColor Green

Write-Host ""
Write-Host "[2/3] Opening Google Chrome Extensions page..." -ForegroundColor Yellow
Start-Process "chrome://extensions" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[3/3] FINAL STEPS IN CHROME:" -ForegroundColor Yellow
Write-Host "      1. In Chrome, enable 'Developer mode' in the TOP-RIGHT corner." -ForegroundColor White
Write-Host "      2. Click 'Load unpacked' in the top-left." -ForegroundColor White
Write-Host "      3. Select this folder:" -ForegroundColor White
Write-Host "         $UserDest" -ForegroundColor Cyan
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   ✓ Vantix is now 100% ready to run offline on Windows!" -ForegroundColor Green
Write-Host "   Click the Vantix badge on ChatGPT or open the Popup to launch your Dashboard." -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

Read-Host -Prompt "Press Enter to finish..."
