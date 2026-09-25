import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, Shield, Download, CheckCircle, AlertTriangle, Sun, Moon, Sparkles } from "lucide-react";
import api from "../utils/api";
import { getStoredTheme, applyTheme } from "../utils/theme";

const Settings = () => {
  const [currentTheme, setCurrentTheme] = useState(() => getStoredTheme());
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const [orgInfo, setOrgInfo] = useState({ email: "", employeeCount: 0, createdAt: "" });
  const [isProjectActive, setIsProjectActive] = useState(true);

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail?.theme) setCurrentTheme(e.detail.theme);
    };
    window.addEventListener("vantix:theme-change", handleThemeChange);

    const fetchSettings = async () => {
      try {
        const token = sessionStorage.getItem("vantixAdminToken");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setOrgInfo((prev) => ({ ...prev, email: payload.email || "" }));
        }

        const usersRes = await api.get("/users");
        if (usersRes.data.success) {
          setOrgInfo((prev) => ({ ...prev, employeeCount: usersRes.data.users.length }));
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

    return () => {
      window.removeEventListener("vantix:theme-change", handleThemeChange);
    };
  }, []);

  const handleSelectTheme = (newTheme) => {
    applyTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  const toggleProjectStatus = async () => {
    if (!window.confirm(`Are you sure you want to ${isProjectActive ? "TERMINATE" : "RESTORE"} project access?`)) return;
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
      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      if (res.data.success) {
        setPwSuccess("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPwError(err.response?.data?.error || "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--apple-text-main)", margin: 0, letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
          Security administration, workspace appearance & system status
        </p>
      </div>

      {/* Theme & Appearance Card */}
      <div className="apple-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Sparkles size={18} color="#e11d48" />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--apple-text-main)", margin: 0 }}>
            Workspace Theme & Appearance
          </h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--apple-text-sub)", margin: "0 0 18px 0" }}>
          Customize your interface appearance. Toggle between dark cyberpunk mode and clean light daylight mode.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {/* Dark Mode Option */}
          <div
            onClick={() => handleSelectTheme("dark")}
            style={{
              padding: 18,
              borderRadius: 14,
              border: `2px solid ${currentTheme === "dark" ? "#e11d48" : "var(--apple-border)"}`,
              background: currentTheme === "dark" ? "rgba(225, 29, 72, 0.09)" : "transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Moon size={18} color="#f43f5e" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--apple-text-main)" }}>Dark Mode</span>
              </div>
              {currentTheme === "dark" && (
                <span className="apple-pill red" style={{ fontSize: 10, padding: "2px 8px" }}>Active</span>
              )}
            </div>

            {/* Dark UI Preview */}
            <div
              style={{
                height: 56,
                borderRadius: 8,
                background: "#060709",
                border: "1px solid rgba(225, 29, 72, 0.3)",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ height: 6, width: "45%", background: "#e11d48", borderRadius: 3 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ height: 22, flex: 1, background: "rgba(20, 21, 28, 0.95)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }} />
                <div style={{ height: 22, flex: 1, background: "rgba(20, 21, 28, 0.95)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--apple-text-muted)", margin: 0 }}>
              Cyberpunk high-contrast theme optimized for command center operations.
            </p>
          </div>

          {/* Light Mode Option */}
          <div
            onClick={() => handleSelectTheme("light")}
            style={{
              padding: 18,
              borderRadius: 14,
              border: `2px solid ${currentTheme === "light" ? "#e11d48" : "var(--apple-border)"}`,
              background: currentTheme === "light" ? "rgba(225, 29, 72, 0.09)" : "transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sun size={18} color="#f59e0b" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--apple-text-main)" }}>Light Mode</span>
              </div>
              {currentTheme === "light" && (
                <span className="apple-pill red" style={{ fontSize: 10, padding: "2px 8px" }}>Active</span>
              )}
            </div>

            {/* Light UI Preview */}
            <div
              style={{
                height: 56,
                borderRadius: 8,
                background: "#f3f5f8",
                border: "1px solid rgba(0, 0, 0, 0.12)",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ height: 6, width: "45%", background: "#e11d48", borderRadius: 3 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ height: 22, flex: 1, background: "#ffffff", borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }} />
                <div style={{ height: 22, flex: 1, background: "#ffffff", borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }} />
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--apple-text-muted)", margin: 0 }}>
              Crisp daylight mode with bright canvas and clear, high-contrast typography.
            </p>
          </div>
        </div>
      </div>

      {/* Organization Overview Card */}
      <div className="apple-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Admin Identity</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--apple-text-main)", marginTop: 4 }}>{orgInfo.email || "admin@vantix.corp"}</div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Registered Identities</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--apple-cyan)", marginTop: 4 }}>{orgInfo.employeeCount} Employees</div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Vantix Core</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--apple-emerald)", marginTop: 4 }}>v1.0.0 Production</div>
        </div>
      </div>

      {/* Password Management Card */}
      <div className="apple-card" style={{ maxWidth: 540 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--apple-text-main)", marginBottom: 16 }}>Change Admin Password</h3>

        {pwError && <div style={{ padding: "8px 12px", background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#f43f5e", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{pwError}</div>}
        {pwSuccess && <div style={{ padding: "8px 12px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{pwSuccess}</div>}

        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>Current Password</label>
            <input type="password" className="apple-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>New Password</label>
            <input type="password" className="apple-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>Confirm New Password</label>
            <input type="password" className="apple-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          <button type="submit" className="apple-btn primary" disabled={busy} style={{ marginTop: 8, width: "fit-content" }}>
            {busy ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="apple-card" style={{ border: "1px solid rgba(244, 63, 94, 0.2)", background: "rgba(244, 63, 94, 0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={16} color="#f43f5e" />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f43f5e", margin: 0 }}>System Kill-Switch</h3>
        </div>

        <p style={{ fontSize: 13, color: "var(--apple-text-sub)", lineHeight: 1.5, marginBottom: 16 }}>
          Remotely terminate or restore global backend telemetry access for all connected proxies and browser guards.
        </p>

        <button
          className={`apple-btn ${isProjectActive ? "danger" : "primary"}`}
          onClick={toggleProjectStatus}
          disabled={busy}
        >
          {isProjectActive ? <Lock size={14} /> : <Unlock size={14} />}
          <span>{isProjectActive ? "Terminate Project Access" : "Restore Project Access"}</span>
        </button>
      </div>
    </motion.div>
  );
};

export default Settings;
