import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, Shield, Download, CheckCircle, AlertTriangle } from "lucide-react";
import api from "../utils/api";

const Settings = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const [orgInfo, setOrgInfo] = useState({ email: "", employeeCount: 0, createdAt: "" });
  const [isProjectActive, setIsProjectActive] = useState(true);

  useEffect(() => {
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
  }, []);

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
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
          Security administration, password & system status
        </p>
      </div>

      {/* Organization Overview Card */}
      <div className="apple-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Admin Identity</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginTop: 4 }}>{orgInfo.email || "admin@vantix.corp"}</div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Registered Identities</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#38bdf8", marginTop: 4 }}>{orgInfo.employeeCount} Employees</div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Vantix Core</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#10b981", marginTop: 4 }}>v1.0.0 Production</div>
        </div>
      </div>

      {/* Password Management Card */}
      <div className="apple-card" style={{ maxWidth: 540 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 16 }}>Change Admin Password</h3>

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
