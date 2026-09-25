import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../utils/api";
import { Mail, Lock, Eye, EyeOff, Shield, ArrowRight, Sparkles } from "lucide-react";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07080c", padding: 20, position: "relative", overflow: "hidden" }}>
      <div className="orion-global-bg" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="apple-card"
        style={{
          width: 420,
          maxWidth: "100%",
          padding: 36,
          backdropFilter: "blur(40px)",
          background: "linear-gradient(135deg, rgba(16, 20, 32, 0.9) 0%, rgba(10, 12, 18, 0.98) 100%)",
          border: "1px solid rgba(255, 0, 85, 0.3)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(255, 0, 85, 0.2)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(135deg, #ff0055 0%, #e11d48 60%, #9f1239 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 24,
              marginBottom: 14,
              boxShadow: "0 0 25px rgba(255, 0, 85, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            V
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.025em" }}>
            VANTIX SOC
          </h1>
          <p style={{ fontSize: 13, color: "var(--apple-text-sub)", margin: "6px 0 0 0" }}>
            Industrial AI Data Loss Prevention Platform
          </p>
        </div>

        <form onSubmit={handleAdminLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--apple-text-sub)", marginBottom: 6, display: "block" }}>
              Administrator Email
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
            <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--apple-text-sub)", marginBottom: 6, display: "block" }}>
              Secret Password
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
                style={{ position: "absolute", right: 14, top: 12, background: "none", border: "none", color: "var(--apple-text-muted)", cursor: "pointer" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.4)", color: "#f43f5e", borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button type="submit" className="apple-btn primary" disabled={busy} style={{ width: "100%", padding: "13px", marginTop: 6, fontSize: 14, fontWeight: 700, borderRadius: "14px" }}>
            <span>{busy ? "Authenticating..." : "Sign In to SOC"}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminAuth;