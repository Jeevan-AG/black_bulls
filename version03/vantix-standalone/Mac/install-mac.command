#!/usr/bin/env bash

# ─── Vantix Standalone AI Guard — macOS Setup Script ──────────────────────────
# Double-clickable shell script for macOS users.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_SOURCE="$SCRIPT_DIR/vantix-guard-extension"
DEST_DIR="$HOME/vantix-guard-extension"

echo ""
echo "==============================================================="
echo "   VANTIX STANDALONE AI DATA GUARD — macOS SETUP"
echo "==============================================================="
echo ""

echo "[1/3] Copying self-contained extension to your Mac home folder..."
rm -rf "$DEST_DIR"
cp -R "$EXT_SOURCE" "$DEST_DIR"
echo "      Location: $DEST_DIR"

echo ""
echo "[2/3] Opening Google Chrome Extensions page..."
open -a "Google Chrome" "chrome://extensions" 2>/dev/null || open "chrome://extensions" 2>/dev/null

echo ""
echo "[3/3] FINAL STEPS IN CHROME / BRAVE / EDGE:"
echo "      1. Enable 'Developer mode' in the TOP-RIGHT corner."
echo "      2. Click 'Load unpacked' in the top-left."
echo "      3. Select this folder:"
echo "         $DEST_DIR"
echo ""
echo "==============================================================="
echo "   ✓ Vantix is now 100% ready to run offline on macOS!"
echo "==============================================================="
echo ""

read -p "Press Enter to finish..."
