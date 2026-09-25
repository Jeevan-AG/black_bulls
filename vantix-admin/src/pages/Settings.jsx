import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  Sliders,
  Shield,
  KeyRound,
  Download,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Server,
  Globe,
  Radio,
  CheckCircle2,
  HardDrive,
  Cpu,
} from "lucide-react";

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  // Copied command states
  const [copiedKey, setCopiedKey] = useState(null);

  // Org info
  const [orgInfo, setOrgInfo] = useState({
    email: "",
    employeeCount: 0,
    createdAt: "",
  });
  const [isProjectActive, setIsProjectActive] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = sessionStorage.getItem("vantixAdminToken");
        if (token && token.includes(".")) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setOrgInfo((prev) => ({ ...prev, email: payload.email || "" }));
        }

        const usersRes = await api.get("/users");
        if (usersRes.data.success) {
          setOrgInfo((prev) => ({
            ...prev,
            employeeCount: usersRes.data.users.length,
          }));
        }

        const statusRes = await api.get("/auth/project-status");
        if (statusRes.data.success) {
          setIsProjectActive(statusRes.data.isActive);
        }
      } catch (err) {
        console.error("Settings error:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleProjectStatus = async () => {
    if (
      !window.confirm(
        `Are you sure you want to ${
          isProjectActive ? "TERMINATE" : "RESTORE"
        } global project access? This affects all clients connecting to this cluster.`
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      const res = await api.post("/auth/toggle-project-status");
      if (res.data.success) {
        setIsProjectActive(res.data.isActive);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to toggle project status");
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }

    try {
      setBusy(true);
      const res = await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      if (res.data.success) {
        setPwSuccess("Administrator password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPwError(err.response?.data?.error || "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  const platforms = [
    "ChatGPT",
    "Gemini",
    "Claude",
    "Copilot",
    "Perplexity",
    "DeepSeek",
    "Grok",
    "Meta AI",
    "HuggingChat",
    "Mistral",
  ];

  const linuxCmd = "curl -fsSL https://vantix-beta.vercel.app/quickstart.sh | sudo bash";
  const macCmd =
    "curl -fsSL https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip -o ~/vantix-guard.zip && unzip -qo ~/vantix-guard.zip -d ~/vantix-guard";
  const winCmd =
    'iwr https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip -OutFile "$HOME\\vantix-guard.zip"; Expand-Archive "$HOME\\vantix-guard.zip" -DestinationPath "$HOME\\vantix-guard" -Force';

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <Sliders size={26} color="#22d3ee" />
            <span>Infrastructure & Engine Configuration</span>
          </div>
          <p className="page-subtitle">
            CLUSTER GATEWAY, ENDPOINT DISTRIBUTION & ROOT AUTHENTICATION
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className="enclave-badge">
            <span className="beacon-dot" />
            <span>GATEWAY ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── Organization & Cluster Telemetry ── */}
      <div className="grid grid--3">
        <div className="telemetry-kpi card--cyan-accent">
          <div className="kpi-head">
            <span className="kpi-title">Root Administrator</span>
            <div className="kpi-icon">
              <Shield size={16} />
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "15px",
              fontWeight: 700,
              color: "#ffffff",
              wordBreak: "break-all",
            }}
          >
            {orgInfo.email || "admin@vantix.corp"}
          </div>
          <div className="kpi-footer">
            <span>Cryptographic Session Authority</span>
          </div>
        </div>

        <div className="telemetry-kpi card--emerald-accent">
          <div className="kpi-head">
            <span className="kpi-title">Monitored Fleet Size</span>
            <div className="kpi-icon" style={{ color: "#34d399" }}>
              <Server size={16} />
            </div>
          </div>
          <div className="kpi-value text-emerald">{orgInfo.employeeCount}</div>
          <div className="kpi-footer">
            <span>Enrolled Employee Endpoints</span>
          </div>
        </div>

        <div className="telemetry-kpi">
          <div className="kpi-head">
            <span className="kpi-title">Enclave Engine Version</span>
            <div className="kpi-icon" style={{ color: "var(--cyan-primary)" }}>
              <Cpu size={16} />
            </div>
          </div>
          <div className="kpi-value text-cyan">v2.4.0</div>
          <div className="kpi-footer">
            <span>TEE Hardware Shield Active</span>
          </div>
        </div>
      </div>

      {/* ── Cross-Platform Fleet Deployment ── */}
      <section className="glass-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={18} color="#22d3ee" />
              <span>Cross-Platform Guard Deployment & Installation</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              1-Line deployment scripts connecting client machines directly to your live cloud cluster
            </p>
          </div>

          <a
            href="/downloads/vantix-browser-guard.zip"
            download="vantix-browser-guard.zip"
            className="btn btn--cyan"
            style={{ textDecoration: "none" }}
          >
            <Download size={14} />
            <span>Download Extension (.zip)</span>
          </a>
        </div>

        <div className="grid grid--2" style={{ gap: "16px" }}>
          {/* Linux 1-line */}
          <div
            style={{
              background: "rgba(5, 8, 17, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="badge badge--cyan" style={{ fontSize: "10px" }}>LINUX</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                  Full OS Intercept (iptables + MITM)
                </span>
              </div>
              <button
                className="btn btn--secondary"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={() => handleCopy(linuxCmd, "linux")}
              >
                {copiedKey === "linux" ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{copiedKey === "linux" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Intercepts Python scripts, terminal cURL, and AI SDKs targeting OpenAI/Anthropic:
            </p>
            <div className="terminal-block">
              <code>{linuxCmd}</code>
            </div>
          </div>

          {/* macOS 1-line */}
          <div
            style={{
              background: "rgba(5, 8, 17, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="badge badge--cyan" style={{ fontSize: "10px" }}>MACOS</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                  Terminal Auto-Unpack
                </span>
              </div>
              <button
                className="btn btn--secondary"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={() => handleCopy(macCmd, "mac")}
              >
                {copiedKey === "mac" ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{copiedKey === "mac" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Downloads & unpacks browser guard extension to <code>~/vantix-guard</code>:
            </p>
            <div className="terminal-block">
              <code>{macCmd}</code>
            </div>
          </div>

          {/* Windows PowerShell 1-line */}
          <div
            style={{
              background: "rgba(5, 8, 17, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "16px",
              gridColumn: "1 / -1",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="badge badge--cyan" style={{ fontSize: "10px" }}>WINDOWS</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                  PowerShell 1-Line Deployment
                </span>
              </div>
              <button
                className="btn btn--secondary"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={() => handleCopy(winCmd, "win")}
              >
                {copiedKey === "win" ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{copiedKey === "win" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Fetches and unpacks extension directly to <code>$HOME\vantix-guard</code>:
            </p>
            <div className="terminal-block">
              <code>{winCmd}</code>
            </div>
          </div>
        </div>

        {/* Live Gateway & Monitored Platforms */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span className="field-label" style={{ marginBottom: "4px" }}>ACTIVE CLUSTER GATEWAY</span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#34d399",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
              >
                <span className="beacon-dot" />
                <span>https://vantix-backend-7gcw.onrender.com</span>
              </div>
            </div>

            <div>
              <span className="field-label" style={{ marginBottom: "6px" }}>PROTECTED SURFACES</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {platforms.map((p) => (
                  <span key={p} className="badge badge--neutral" style={{ fontSize: "11px" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security Credentials & Danger Zone (Grid) ── */}
      <div className="grid grid--2">
        {/* Change Admin Password */}
        <section className="glass-panel">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <KeyRound size={18} color="#22d3ee" />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
              Rotate Administrator Password
            </h3>
          </div>

          {pwError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                color: "#fb7185",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                marginBottom: "14px",
              }}
            >
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#34d399",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                marginBottom: "14px",
              }}
            >
              {pwSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="field-label">Current Master Password</label>
              <input
                className="input input--mono"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            <div>
              <label className="field-label">New Master Password</label>
              <input
                className="input input--mono"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="•••••••••••• (min 6 chars)"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="field-label">Confirm New Password</label>
              <input
                className="input input--mono"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            <div style={{ marginTop: "4px" }}>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? "Updating..." : "Rotate Credentials"}
              </button>
            </div>
          </form>
        </section>

        {/* Emergency Killswitch & Lockdown */}
        <section
          className="glass-panel"
          style={{
            border: isProjectActive ? "1px solid rgba(244, 63, 94, 0.2)" : "1px solid rgba(16, 185, 129, 0.3)",
            background: isProjectActive ? "rgba(244, 63, 94, 0.02)" : "rgba(16, 185, 129, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <AlertTriangle size={18} color={isProjectActive ? "#f43f5e" : "#34d399"} />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
              Emergency Cluster Lockdown
            </h3>
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "20px" }}>
            If you suspect an active corporate breach or unmanaged rogue node leak, you can instantly engage global cluster lockdown. This terminates packet routing and blocks outbound AI queries across all connected extensions until manually re-enabled.
          </p>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              background: "rgba(5, 8, 17, 0.6)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>Current System State</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                {isProjectActive ? "All nodes actively proxying & inspecting" : "Emergency lockdown engaged"}
              </div>
            </div>

            <span className={`badge ${isProjectActive ? "badge--safe" : "badge--critical"}`}>
              {isProjectActive ? (
                <>
                  <span className="beacon-dot" /> ACTIVE & ENFORCING
                </>
              ) : (
                "CLUSTER LOCKED DOWN"
              )}
            </span>
          </div>

          <button
            className={`btn ${isProjectActive ? "btn--danger" : "btn--primary"}`}
            onClick={toggleProjectStatus}
            disabled={busy}
            style={{ width: "100%", height: "42px", fontSize: "13px" }}
          >
            {isProjectActive ? (
              <>
                <Lock size={15} />
                <span>Engage Emergency Lockdown</span>
              </>
            ) : (
              <>
                <Unlock size={15} />
                <span>Restore Cluster Operations</span>
              </>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}
