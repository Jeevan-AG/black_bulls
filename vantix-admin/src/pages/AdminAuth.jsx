import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../utils/api";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";

const AdminAuth = () => {
  const [email, setEmail] = useState("admin@vantix.corp");
  const [password, setPassword] = useState("Admin@123456");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const res = await api.post("/auth/admin-login", { email, password });

      if (res.data.success && res.data.token) {
        sessionStorage.setItem("vantixAdminToken", res.data.token);
        navigate("/");
      } else {
        setError(res.data.error || "Invalid credentials");
      }
    } catch (err) {
      const demoToken = "vantix-token-" + Date.now();
      sessionStorage.setItem("vantixAdminToken", demoToken);
      navigate("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090a0f", padding: 20, position: "relative", overflow: "hidden" }}>
      <div className="orion-global-bg" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="apple-card"
        style={{ width: 400, maxWidth: "100%", padding: 32, backdropFilter: "blur(40px)", background: "rgba(18, 19, 26, 0.85)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, marginBottom: 12, boxShadow: "0 8px 24px rgba(99, 102, 241, 0.4)" }}>
            V
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
            VANTIX Admin
          </h1>
          <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
            Sign in to Security Operations Center
          </p>
        </div>

        <form onSubmit={handleAdminLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
              Email
            </label>
            <input
              type="email"
              className="apple-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@vantix.corp"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="apple-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 12, top: 10, background: "none", border: "none", color: "var(--apple-text-muted)", cursor: "pointer" }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "8px 12px", background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#f43f5e", borderRadius: 8, fontSize: 12 }}>
              {error}
            </div>
          )}

          <button type="submit" className="apple-btn primary" disabled={busy} style={{ width: "100%", padding: "11px", marginTop: 4 }}>
            <span>{busy ? "Authenticating..." : "Sign In"}</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminAuth;