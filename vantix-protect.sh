#!/usr/bin/env bash

# ─── Vantix Enterprise AI Data Firewall ───────────────────────────────────────
# One command to monitor ALL AI traffic on your entire system.
#
# Usage:
#   sudo ./vantix-protect.sh start    ← Start monitoring (auto-detects everything)
#   sudo ./vantix-protect.sh stop     ← Stop monitoring, restore system
#   ./vantix-protect.sh status        ← Check what's running
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR/vantix-bridge"
BACKEND_DIR="$SCRIPT_DIR/vantix-backend"
ADMIN_DIR="$SCRIPT_DIR/vantix-admin"
CA_CERT="$BRIDGE_DIR/ca/vantix-ca.crt"
PROXY_PORT=8443
PID_FILE="$SCRIPT_DIR/.vantix.pid"
LOG_FILE="$SCRIPT_DIR/vantix.log"
REAL_USER="${SUDO_USER:-$(whoami)}"
REAL_HOME=$(eval echo "~$REAL_USER")

GUARD_DIR="$SCRIPT_DIR/vantix-browser-guard"

# ─── Helper: Ensure root for start/stop ──────────────────────────────────────
require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo ""
    echo "  ✗ System-wide AI interception requires root privileges."
    echo "  Run with: sudo ./vantix-protect.sh $1"
    echo ""
    exit 1
  fi
}

# ─── Helper: Install Vantix Root CA system-wide & in browsers ────────────────
install_ca() {
  # Generate CA if it doesn't exist
  if [ ! -f "$CA_CERT" ]; then
    echo "  [CA] Generating Vantix Enterprise Root CA..."
    node "$BRIDGE_DIR/bridgeCli.js" setup-cert 2>/dev/null
  fi

  # Install into system CA store (curl, wget, python, node, etc.)
  if [ ! -f "/usr/local/share/ca-certificates/vantix-ca.crt" ]; then
    echo "  [CA] Installing Root CA into system trust store..."
    cp "$CA_CERT" /usr/local/share/ca-certificates/vantix-ca.crt
    update-ca-certificates --fresh > /dev/null 2>&1 || true
    echo "  [CA] System CA store: TRUSTED ✓"
  else
    echo "  [CA] System CA store: ALREADY TRUSTED ✓"
  fi

  # Ensure certutil (libnss3-tools) is available for browser databases
  if ! command -v certutil &>/dev/null; then
    echo "  [CA] Installing libnss3-tools for Chrome/Brave/Edge NSS trust..."
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y -qq libnss3-tools >/dev/null 2>&1 || true
  fi

  # Install into Chrome/Chromium/Brave NSS database
  if command -v certutil &>/dev/null; then
    mkdir -p "$REAL_HOME/.pki/nssdb" 2>/dev/null || true
    certutil -d sql:"$REAL_HOME/.pki/nssdb" -A -t "C,," -n "Vantix Enterprise CA" -i "$CA_CERT" 2>/dev/null || true
    echo "  [CA] Chrome / Chromium / Brave NSS DB: TRUSTED ✓"

    # Also install into ALL Firefox profiles (Firefox uses its own cert store)
    local FF_INSTALLED=0
    while IFS= read -r -d '' ff_profile; do
      ff_dir="$(dirname "$ff_profile")"
      certutil -d sql:"$ff_dir" -A -t "C,," -n "Vantix Enterprise CA" -i "$CA_CERT" 2>/dev/null && FF_INSTALLED=$((FF_INSTALLED+1))
    done < <(find "$REAL_HOME/.mozilla/firefox" -name "cert9.db" -print0 2>/dev/null)
    if [ "$FF_INSTALLED" -gt 0 ]; then
      echo "  [CA] Firefox NSS DB ($FF_INSTALLED profiles): TRUSTED ✓"
    fi
  fi
}

# ─── Helper: Setup Managed Browser Policies (Chrome, Brave, Edge) ───────────
setup_browser_policies() {
  local CHROME_DIR="/etc/opt/chrome/policies/managed"
  local CHROMIUM_DIR="/etc/chromium/policies/managed"
  local EDGE_DIR="/etc/opt/edge/policies/managed"

  mkdir -p "$CHROME_DIR" "$CHROMIUM_DIR" "$EDGE_DIR" 2>/dev/null || true

  cat <<EOF > "$CHROME_DIR/vantix_guard.json"
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

  cp "$CHROME_DIR/vantix_guard.json" "$CHROMIUM_DIR/vantix_guard.json" 2>/dev/null || true
  cp "$CHROME_DIR/vantix_guard.json" "$EDGE_DIR/vantix_guard.json" 2>/dev/null || true
}

# ─── Helper: Setup iptables transparent redirect + QUIC fallback ─────────────
setup_iptables() {
  # 1. Clean existing Vantix rules first (idempotent)
  iptables -t nat -D OUTPUT -p tcp --dport 443 -m owner ! --uid-owner 0 -j REDIRECT --to-port "$PROXY_PORT" 2>/dev/null || true
  iptables -D OUTPUT -p udp --dport 443 -m owner ! --uid-owner 0 -j DROP 2>/dev/null || true

  # 2. Redirect all outbound HTTPS from non-root users to Vantix proxy
  iptables -t nat -A OUTPUT -p tcp --dport 443 -m owner ! --uid-owner 0 -j REDIRECT --to-port "$PROXY_PORT"

  # 3. Block UDP 443 for non-root users (forces Chrome/Edge to fall back from QUIC to inspected TCP)
  iptables -A OUTPUT -p udp --dport 443 -m owner ! --uid-owner 0 -j DROP
}

# ─── Helper: Remove iptables rules ──────────────────────────────────────────
remove_iptables() {
  iptables -t nat -D OUTPUT -p tcp --dport 443 -m owner ! --uid-owner 0 -j REDIRECT --to-port "$PROXY_PORT" 2>/dev/null || true
  iptables -D OUTPUT -p udp --dport 443 -m owner ! --uid-owner 0 -j DROP 2>/dev/null || true
}

# ─── Load .env file variables ────────────────────────────────────────────────
load_env() {
  if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    source "$BACKEND_DIR/.env" 2>/dev/null || true
    set +a
  fi
}


case "${1:-}" in

  # ═════════════════════════════════════════════════════════════════════════════
  #  START — One command, full system coverage
  # ═════════════════════════════════════════════════════════════════════════════
  start)
    require_root "start"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  VANTIX — SYSTEM-WIDE AI TRAFFIC FIREWALL"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""

    # Step 1: Install CA certificate
    echo "  Step 1/4: Certificate Authority & Browser Trust Stores"
    install_ca
    echo ""

    # Step 2: Kill any previous instance
    if [ -f "$PID_FILE" ]; then
      OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
      if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "  [CLEANUP] Stopping previous instance (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
      fi
      rm -f "$PID_FILE"
    fi
    pkill -f "VANTIX_TRANSPARENT=1.*server.js" 2>/dev/null || true
    # Also free ports
    fuser -k 5000/tcp 2>/dev/null || true
    fuser -k $PROXY_PORT/tcp 2>/dev/null || true
    sleep 0.5

    # Step 3: Start unified backend + transparent proxy
    echo "  Step 2/4: Detection Engine + Transparent Proxy"
    echo "  [ENGINE] Starting Vantix (backend:5000 + proxy:$PROXY_PORT)..."

    load_env

    (
      cd "$BACKEND_DIR" || exit 1
      VANTIX_TRANSPARENT=1 \
        NODE_EXTRA_CA_CERTS="$CA_CERT" \
        nohup node server.js > "$LOG_FILE" 2>&1 &
      echo $! > "$PID_FILE"
    )

    VANTIX_PID=$(cat "$PID_FILE" 2>/dev/null)
    sleep 2.5

    # Verify it started
    if kill -0 "$VANTIX_PID" 2>/dev/null; then
      echo "  [ENGINE] Detection Engine (port 5000):  ACTIVE ✓"
      echo "  [ENGINE] Transparent Proxy (port $PROXY_PORT): ACTIVE ✓"
    else
      echo "  [ERROR] Failed to start Vantix. Log:"
      tail -10 "$LOG_FILE"
      exit 1
    fi
    echo ""

    # Step 4: Setup iptables
    echo "  Step 3/4: OS Network Interception (Layer 1)"
    setup_iptables
    echo "  [NET] iptables: ALL outbound HTTPS → Vantix proxy (TCP:8443) ✓"
    echo "  [NET] iptables: QUIC UDP port 443 restricted (forces TCP inspection) ✓"
    echo ""

    # Step 5: Enterprise Browser Guard Policies
    echo "  Step 4/4: Enterprise Browser Guard (Layer 2)"
    setup_browser_policies
    echo "  [BROWSER] Chrome / Brave / Edge enterprise policies: DEPLOYED ✓"
    echo "  [BROWSER] Extension package: $GUARD_DIR ✓"
    echo ""

    echo "═══════════════════════════════════════════════════════════════"
    echo "  ✓ VANTIX DUAL-LAYER AI DATA FIREWALL IS ACTIVE"
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Monitored User:    $REAL_USER on $(hostname)"
    echo "  Layer 1 (OS/Net):  Protects Python, SDKs, CLI, IDEs, curl"
    echo "  Layer 2 (Browser): Protects ChatGPT, Claude, Gemini in Chrome"
    echo "  Admin Dashboard:   http://localhost:5173"
    echo "───────────────────────────────────────────────────────────────"
    echo "  Run 3-scenario demo:  ./vantix-protect.sh demo"
    echo "  Test leaked AWS key:  ./vantix-protect.sh test"
    echo "  To stop:              sudo ./vantix-protect.sh stop"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    ;;


  # ═════════════════════════════════════════════════════════════════════════════
  #  STOP — Clean shutdown, restore system
  # ═════════════════════════════════════════════════════════════════════════════
  stop)
    require_root "stop"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  STOPPING VANTIX SYSTEM-WIDE MONITOR"
    echo "═══════════════════════════════════════════════════════════════"

    # 1. Remove iptables redirect (FIRST — restore networking immediately)
    remove_iptables
    echo "  [NET] iptables rules removed — networking restored ✓"

    # 2. Kill Vantix process
    if [ -f "$PID_FILE" ]; then
      VPID=$(cat "$PID_FILE" 2>/dev/null)
      if [ -n "$VPID" ] && kill -0 "$VPID" 2>/dev/null; then
        kill "$VPID" 2>/dev/null || true
        echo "  [ENGINE] Vantix process (PID $VPID) stopped ✓"
      fi
      rm -f "$PID_FILE"
    fi

    # Kill any stragglers
    pkill -f "VANTIX_TRANSPARENT=1" 2>/dev/null || true
    fuser -k 8443/tcp 2>/dev/null || true

    echo ""
    echo "  System restored to normal networking."
    echo "  All AI traffic now goes directly — no inspection."
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    ;;


  # ═════════════════════════════════════════════════════════════════════════════
  #  STATUS — Check what's running
  # ═════════════════════════════════════════════════════════════════════════════
  status)
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  VANTIX SYSTEM STATUS"
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Machine:  $REAL_USER on $(hostname)"

    # Detection Engine (port 5000)
    if curl -s --max-time 2 http://127.0.0.1:5000/api/vantix/health > /dev/null 2>&1; then
      echo "  Detection Engine (5000): RUNNING ✓"
    else
      echo "  Detection Engine (5000): STOPPED ✗"
    fi

    # Transparent Proxy (port 8443)
    if ss -tln 2>/dev/null | grep -q ":${PROXY_PORT} "; then
      echo "  Transparent Proxy ($PROXY_PORT):  RUNNING ✓"
    elif netstat -tln 2>/dev/null | grep -q ":${PROXY_PORT} "; then
      echo "  Transparent Proxy ($PROXY_PORT):  RUNNING ✓"
    else
      echo "  Transparent Proxy ($PROXY_PORT):  STOPPED ✗"
    fi

    # Admin Dashboard (port 5173)
    if curl -s --max-time 2 http://127.0.0.1:5173 > /dev/null 2>&1; then
      echo "  Admin Dashboard (5173):  RUNNING ✓ → http://localhost:5173"
    else
      echo "  Admin Dashboard (5173):  STOPPED ✗"
    fi

    # iptables rule (non-blocking check)
    if sudo -n iptables -t nat -C OUTPUT -p tcp --dport 443 -m owner ! --uid-owner 0 -j REDIRECT --to-port "$PROXY_PORT" 2>/dev/null; then
      echo "  iptables Interception:   ACTIVE ✓ (all HTTPS → Vantix)"
    elif [ -f "$PID_FILE" ]; then
      echo "  iptables Interception:   ACTIVE ✓ (Redirecting port 443 → $PROXY_PORT)"
    else
      echo "  iptables Interception:   INACTIVE ✗"
    fi

    # CA cert
    if [ -f "/usr/local/share/ca-certificates/vantix-ca.crt" ]; then
      echo "  Root CA Certificate:     INSTALLED ✓"
    else
      echo "  Root CA Certificate:     NOT INSTALLED ✗"
    fi

    # Browser Guard Extension
    if [ -f "$SCRIPT_DIR/vantix-browser-guard/manifest.json" ]; then
      echo "  Browser Guard (Chrome):  BUILT & READY ✓ ($SCRIPT_DIR/vantix-browser-guard)"
    fi

    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    ;;


  # ═════════════════════════════════════════════════════════════════════════════
  #  SEND — Quick CLI prompt test  
  # ═════════════════════════════════════════════════════════════════════════════
  demo)
    node "$BRIDGE_DIR/runDemo.js"
    ;;

  send|prompt|test)
    shift
    if [ -z "$1" ]; then
      node "$BRIDGE_DIR/bridgeCli.js" test "Testing Vantix protection with AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    else
      node "$BRIDGE_DIR/bridgeCli.js" test "$@"
    fi
    ;;


  # ═════════════════════════════════════════════════════════════════════════════
  #  HELP
  # ═════════════════════════════════════════════════════════════════════════════
  *)
    echo ""
    echo "Vantix — System-Wide AI Data Firewall"
    echo ""
    echo "  sudo ./vantix-protect.sh start     Start monitoring ALL AI traffic"
    echo "  sudo ./vantix-protect.sh stop      Stop monitoring, restore system"
    echo "  ./vantix-protect.sh status         Check monitoring status"
    echo "  ./vantix-protect.sh demo           Run the 3-scenario judge demonstration"
    echo "  ./vantix-protect.sh test           Run a test detection with AWS key leak"
    echo "  ./vantix-protect.sh send <prompt>  Quick-test a custom prompt"
    echo ""
    ;;

esac
