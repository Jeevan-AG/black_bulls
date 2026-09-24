#!/usr/bin/env bash

# ─── Vantix Standalone AI Guard — Linux Setup Script ──────────────────────────
# Automated setup script for Linux users.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_SOURCE="$SCRIPT_DIR/vantix-guard-extension"
DEST_DIR="$HOME/.local/share/vantix-guard-extension"

echo ""
echo "==============================================================="
echo "   VANTIX STANDALONE AI DATA GUARD — LINUX SETUP"
echo "==============================================================="
echo ""

mkdir -p "$HOME/.local/share"
echo "[1/3] Copying self-contained extension to user directory..."
rm -rf "$DEST_DIR"
cp -R "$EXT_SOURCE" "$DEST_DIR"
echo "      Location: $DEST_DIR"

echo ""
echo "[2/3] Attempting to launch browser to extensions tab..."
if command -v google-chrome &>/dev/null; then
  google-chrome "chrome://extensions" &>/dev/null &
elif command -v chromium &>/dev/null; then
  chromium "chrome://extensions" &>/dev/null &
elif command -v brave-browser &>/dev/null; then
  brave-browser "chrome://extensions" &>/dev/null &
fi

echo ""
echo "[3/3] FINAL STEPS IN BROWSER:"
echo "      1. Navigate to chrome://extensions (or brave://extensions)."
echo "      2. Toggle 'Developer mode' ON in the top-right."
echo "      3. Click 'Load unpacked' and select:"
echo "         $DEST_DIR"
echo ""
echo "==============================================================="
echo "   ✓ Vantix is now 100% ready to run offline on Linux!"
echo "==============================================================="
echo ""
