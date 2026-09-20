#!/usr/bin/env bash
# ─── Vantix AI Data Firewall — 1-Line Remote Quickstart ───────────────────────
# Clones, bootstraps, and starts transparent OS-layer AI interception in 1 line.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/shammazhere/Vantix/main/quickstart.sh | sudo bash
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  VANTIX ENTERPRISE AI FIREWALL — 1-LINE QUICKSTART"
echo "═══════════════════════════════════════════════════════════════"

# 1. Check Root Privileges
if [ "$(id -u)" -ne 0 ]; then
  echo ""
  echo "  ✗ Error: System-wide network interception requires root privileges."
  echo "  Please execute with:"
  echo "    curl -fsSL https://raw.githubusercontent.com/shammazhere/Vantix/main/quickstart.sh | sudo bash"
  echo ""
  exit 1
fi

# 2. Check Operating System
OS="$(uname -s)"
if [ "$OS" != "Linux" ]; then
  echo ""
  echo "  [INFO] Detected Operating System: $OS"
  echo "  Transparent OS kernel redirection (iptables) is designed for Linux."
  echo "  For macOS and Windows users:"
  echo "    • Download the pre-packaged Vantix Browser Guard from your dashboard"
  echo "    • Load unpacked in chrome://extensions to monitor ChatGPT, Claude & Gemini"
  echo ""
  exit 1
fi

# 3. Check Prerequisite Tools
echo "  Step 1/3: Checking environment prerequisites..."
MISSING_PKGS=""
if ! command -v git &>/dev/null; then MISSING_PKGS="$MISSING_PKGS git"; fi
if ! command -v node &>/dev/null; then MISSING_PKGS="$MISSING_PKGS nodejs npm"; fi

if [ -n "$MISSING_PKGS" ]; then
  echo "  [PREREQ] Installing:$MISSING_PKGS..."
  if command -v apt-get &>/dev/null; then
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y -qq $MISSING_PKGS >/dev/null 2>&1 || true
  elif command -v dnf &>/dev/null; then
    dnf install -y $MISSING_PKGS >/dev/null 2>&1 || true
  elif command -v yum &>/dev/null; then
    yum install -y $MISSING_PKGS >/dev/null 2>&1 || true
  fi
fi

# 4. Fetch and Deploy Vantix Suite
INSTALL_DIR="/opt/vantix"
echo "  Step 2/3: Deploying Vantix Engine to $INSTALL_DIR..."

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  [UPDATE] Existing installation detected. Syncing latest updates..."
  cd "$INSTALL_DIR"
  git pull --quiet origin main 2>/dev/null || true
else
  mkdir -p /opt
  git clone --depth 1 https://github.com/shammazhere/Vantix.git "$INSTALL_DIR" --quiet
  cd "$INSTALL_DIR/vantix-backend"
  echo "  [NPM] Initializing engine dependencies..."
  npm install --production --silent >/dev/null 2>&1 || true
fi

# 5. Start Transparent Protection
echo "  Step 3/3: Initializing dual-layer firewall..."
cd "$INSTALL_DIR"
chmod +x vantix-protect.sh
./vantix-protect.sh start
