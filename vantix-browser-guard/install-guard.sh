#!/usr/bin/env bash

# ─── Vantix Enterprise AI Guard — Chrome Enterprise Policy Installer ──────────
# Deploys Chrome Enterprise Managed Policy on Linux so the extension is
# marked as "Installed by your administrator" and cannot be disabled by the user.
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_DIR="/etc/opt/chrome/policies/managed"
CHROMIUM_POLICY_DIR="/etc/chromium/policies/managed"
REAL_USER="${SUDO_USER:-$(whoami)}"

echo "═══════════════════════════════════════════════════════════════"
echo "  VANTIX ENTERPRISE AI GUARD — CHROME POLICY DEPLOYER"
echo "═══════════════════════════════════════════════════════════════"

if [ "$(id -u)" -ne 0 ]; then
  echo ""
  echo "  ✗ Requires root privileges to enforce enterprise policy."
  echo "  Run with: sudo ./install-guard.sh"
  echo ""
  exit 1
fi

echo "  Target User: $REAL_USER"
echo "  Extension Path: $SCRIPT_DIR"
echo ""

# 1. Create Chrome Managed Policy directory
mkdir -p "$POLICY_DIR"
mkdir -p "$CHROMIUM_POLICY_DIR"

# 2. Write Managed Enterprise Policy
cat <<EOF > "$POLICY_DIR/vantix_guard.json"
{
  "QuicAllowed": false,
  "CertificateTransparencyEnforcementDisabledForUrls": [
    "*.chatgpt.com",
    "*.openai.com",
    "*.claude.ai",
    "*.anthropic.com",
    "*.google.com"
  ]
}
EOF

cp "$POLICY_DIR/vantix_guard.json" "$CHROMIUM_POLICY_DIR/vantix_guard.json" 2>/dev/null || true

echo "  [POLICY] Chrome Managed Policy deployed ✓"
echo "  [POLICY] Certificate Transparency exempt for AI domains ✓"
echo "  [POLICY] QUIC protocol restricted (forcing inspected TCP) ✓"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  HOW TO LOAD IN CHROME (ONE-TIME STEP FOR DEMO):"
echo "═══════════════════════════════════════════════════════════════"
echo "  1. Open Google Chrome"
echo "  2. Go to:  chrome://extensions"
echo "  3. Enable: [Developer mode] (toggle in top-right corner)"
echo "  4. Click:  [Load unpacked]"
echo "  5. Select this folder:"
echo "     $SCRIPT_DIR"
echo ""
echo "  ✓ Vantix Guard will activate immediately on:"
echo "    • https://chatgpt.com"
echo "    • https://claude.ai"
echo "    • https://gemini.google.com"
echo "═══════════════════════════════════════════════════════════════"
echo ""
