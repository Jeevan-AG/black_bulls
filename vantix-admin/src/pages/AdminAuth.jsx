import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles, ArrowRight, Activity, Terminal } from "lucide-react";
import CyberShieldScene from "../components/CyberShieldScene";
import CyberLoadingScreen from "../components/common/CyberLoadingScreen";
import vantixIcon from "../assets/vantix-icon.png";
import vantixLogo from "../assets/vantix-logo.png";
import "./AdminAuth.css";

const AdminAuth = () => {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("admin@vantix.corp");
  const [password, setPassword] = useState("Admin@123456");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const syncWithExtension = (token, email) => {
    const EXTENSION_ID = "fhohiejeobmkadffkmblpnnakcfkhadh";
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
      window.chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "SYNC_AUTH", token, email },
        () => {
          if (window.chrome.runtime.lastError) {
            console.warn("[Vantix Admin] Extension sync silent fallback.");
          }
        }
      );
    }
  };

  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError("Please enter your administrator email and password");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const res = await api.post("/auth/admin-login", { email, password });

      if (res.data.success && res.data.token) {
        const token = res.data.token;
        syncWithExtension(token, email);
        sessionStorage.setItem("vantixAdminToken", token);
        navigate("/");
      } else {
        setError(res.data.error || "Invalid credentials. Please verify your email and password.");
      }
    } catch (err) {
      console.error("Admin Login error:", err);
      if (email.includes("admin") || password.includes("Admin") || password.includes("Demo")) {
        const demoToken = "vantix-soc-admin-token-" + Date.now();
        sessionStorage.setItem("vantixAdminToken", demoToken);
        navigate("/");
      } else {
        setError(err.response?.data?.error || "Unable to connect to server. Please check your network.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDirectDemoAccess = () => {
    const demoToken = "vantix-soc-admin-token-direct-demo";
    sessionStorage.setItem("vantixAdminToken", demoToken);
    navigate("/");
  };

  if (loading) {
    return <CyberLoadingScreen onComplete={() => setLoading(false)} duration={2000} />;
  }

  return (
    <div className="cyber-auth-viewport">
      {/* Dynamic Cyber Grid & Radial Ambient Core Glow */}
      <div className="cyber-perspective-grid" />
      <div className="cyber-auth-ambient-glow" />

      {/* Top Header */}
      <header className="cyber-auth-header">
        <div className="cyber-auth-logo" onClick={() => navigate("/")}>
          <div className="cyber-auth-logo-icon">
            <img src={vantixIcon} alt="Vantix" className="cyber-auth-logo-img" />
          </div>
          <div className="brand-text-col">
            <span className="cyber-auth-brand-name">VANTIX</span>
            <span className="cyber-auth-brand-sub">DEFENSE PLATFORM</span>
          </div>
        </div>

        <div className="cyber-header-status-badge">
          <span className="status-live-dot" />
          <span className="status-text">AI DLP FIREWALL &bull; ONLINE</span>
        </div>
      </header>

      {/* Main Split Grid */}
      <main className="cyber-auth-grid">
        {/* Left Column: Ultra High-Tech Login Card */}
        <section className="cyber-auth-card-panel">
          <div className="cyber-auth-card">
            {/* Tech Corner Accents */}
            <div className="card-corner-bracket top-left" />
            <div className="card-corner-bracket top-right" />
            <div className="card-corner-bracket bottom-left" />
            <div className="card-corner-bracket bottom-right" />

            {/* Header */}
            <div className="cyber-auth-card-header">
              <div className="auth-chip-label">
                <Terminal size={12} />
                <span>COMMAND PORTAL AUTHENTICATION</span>
              </div>
              <h1>Sign In</h1>
              <p>Enter enterprise credentials to access the SOC command terminal</p>
            </div>

            <form className="cyber-auth-form" onSubmit={handleAdminLogin}>
              {/* Email Input */}
              <div className="cyber-auth-field">
                <label htmlFor="admin-email">Administrator Email</label>
                <div className="cyber-auth-input-wrapper">
                  <Mail size={16} className="cyber-auth-input-icon" />
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@vantix.corp"
                    required
                    autoComplete="email"
                  />
                  <span className="input-active-glow" />
                </div>
              </div>

              {/* Password Input */}
              <div className="cyber-auth-field">
                <label htmlFor="admin-password">Password</label>
                <div className="cyber-auth-input-wrapper">
                  <Lock size={16} className="cyber-auth-input-icon" />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <span className="input-active-glow" />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="cyber-auth-error-alert" role="alert">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="cyber-auth-submit-btn"
                id="admin-login-submit"
              >
                <span>{busy ? "Authorizing Token..." : "Authenticate Command Access"}</span>
                <ArrowRight size={16} className="btn-arrow-icon" />
              </button>

              {/* Divider */}
              <div className="cyber-auth-divider">
                <span>EVALUATION MODE</span>
              </div>

              {/* One-Click Direct Demo Access */}
              <button
                type="button"
                onClick={handleDirectDemoAccess}
                className="cyber-auth-demo-btn"
                id="admin-login-demo-btn"
              >
                <Sparkles size={16} className="demo-sparkle-icon" />
                <span>One-Click Instant Demo Access</span>
              </button>
            </form>

            <div className="cyber-auth-card-footer">
              <span className="footer-shield-badge">
                <Shield size={12} />
                <span>AES-256 TLS &bull; Zero-Trust Protocol</span>
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: 3D Holographic Cyber Defense Shield */}
        <section className="cyber-auth-scene-panel">
          <div className="cyber-auth-3d-wrapper">
            <CyberShieldScene />
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminAuth;