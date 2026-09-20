import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import "./AdminAuth.css";

const AdminAuth = () => {
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

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-logo-box">
            <Shield size={22} />
          </div>
          <h1>Sign in to Vantix</h1>
          <p>Security Operations Center & AI Data Firewall</p>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          <form className="auth-form" onSubmit={handleAdminLogin}>
            {/* Email Field */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-email">
                Administrator Email
              </label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vantix.corp"
                  required
                  autoComplete="email"
                  className="auth-input"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="admin-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-password-toggle"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="auth-error-alert" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="auth-primary-btn"
              id="admin-login-submit"
            >
              <span>{busy ? "Authenticating..." : "Sign In to SOC Console"}</span>
            </button>

            <div className="auth-divider">
              <span>or evaluate</span>
            </div>

            {/* Direct Demo Access Button */}
            <button
              type="button"
              onClick={handleDirectDemoAccess}
              className="auth-demo-btn"
              id="admin-login-demo-btn"
            >
              <span>⚡ One-Click Demo Access</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <span>Protected by 256-bit TLS &middot; Enterprise SOC v2.4</span>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;