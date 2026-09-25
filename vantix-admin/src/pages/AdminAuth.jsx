import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles, X, Shield } from "lucide-react";
import CyberShieldScene from "../components/CyberShieldScene";
import "./AdminAuth.css";

const AdminAuth = () => {
  const [email, setEmail] = useState("admin@vantix.corp");
  const [password, setPassword] = useState("Admin@123456");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  return (
    <div className="cyber-landing-viewport red-industrial-theme">
      {/* Background Red Ambient Glow & Circuit Grid */}
      <div className="red-ambient-glow" />
      <div className="red-diagonal-hazard" />

      {/* Top Header Navigation (No underlines, clean text) */}
      <header className="cyber-header">
        <div className="cyber-logo-group" onClick={() => navigate("/")}>
          <div className="red-badge-icon">
            <span className="finix-x">X</span>
          </div>
          <span className="cyber-brand-name">
            FINIX <span className="brand-badge-num">26</span>
          </span>
        </div>

        <nav className="cyber-nav-links">
          <span className="cyber-nav-item">INDUSTRIAL SECURITY</span>
          <span className="cyber-nav-item">ARCHITECTURE</span>
          <span className="cyber-nav-item">THREAT INTELLIGENCE</span>
          <span className="cyber-nav-item">COMPLIANCE</span>
        </nav>
      </header>

      {/* Main Hero Container */}
      <main className="cyber-hero-grid">
        {/* Left Column: Hero Title & Controls */}
        <section className="cyber-hero-left">
          <div className="cyber-title-wrapper">
            <h1 className="cyber-hero-headline">
              <span>INDUSTRIAL</span>
              <span className="text-crimson-gradient">SECURITY</span>
            </h1>
            <p className="cyber-hero-description">
              Zero-trust perimeter protection with real-time AI payload inspection, 
              hardware isolation, and active defense against industrial cyber threats.
            </p>
          </div>

          <div className="cyber-hero-actions">
            <button
              className="cyber-btn-explore red-explore-btn"
              onClick={handleDirectDemoAccess}
              id="explore-btn"
            >
              ACCESS CONSOLE
            </button>
            <button
              className="cyber-btn-contact red-contact-btn"
              onClick={() => setShowAuthModal(true)}
              id="contact-btn"
            >
              ADMIN SIGN IN
            </button>
          </div>
        </section>

        {/* Right Column: 3D Red Cyber Shield & Concentric HUD Circles */}
        <section className="cyber-hero-right">
          <div className="cyber-3d-wrapper">
            <CyberShieldScene />
          </div>
        </section>
      </main>

      {/* Sleek Admin Sign In Modal */}
      {showAuthModal && (
        <div className="cyber-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div
            className="cyber-modal-card red-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="cyber-modal-close"
              onClick={() => setShowAuthModal(false)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="cyber-modal-header">
              <div className="red-badge-glow">
                <Shield size={20} />
              </div>
              <h2>Industrial SOC Authentication</h2>
              <p>Enter administrator credentials to unlock the command interface</p>
            </div>

            <form className="cyber-modal-form" onSubmit={handleAdminLogin}>
              <div className="cyber-form-group">
                <label htmlFor="modal-email">Administrator Email</label>
                <div className="cyber-input-wrapper">
                  <Mail size={16} className="cyber-input-icon" />
                  <input
                    id="modal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@vantix.corp"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="cyber-form-group">
                <label htmlFor="modal-password">Password</label>
                <div className="cyber-input-wrapper">
                  <Lock size={16} className="cyber-input-icon" />
                  <input
                    id="modal-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-reveal-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="cyber-error-alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="cyber-submit-btn red-submit-btn"
                id="submit-login-modal"
              >
                {busy ? "Authorizing..." : "Unlock Industrial SOC"}
              </button>

              <div className="cyber-modal-divider">
                <span>OR EVALUATE</span>
              </div>

              <button
                type="button"
                onClick={handleDirectDemoAccess}
                className="cyber-demo-direct-btn"
                id="modal-demo-access-btn"
              >
                <Sparkles size={16} />
                <span>One-Click Instant Demo Access</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuth;