import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import { Shield, User, Mail, Lock, CheckCircle, Star, Zap, Building } from "lucide-react";
import vantixIcon from "../assets/vantix-icon.png";

const AdminRegister = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const res = await api.post('/auth/admin-register', { email, password, fullName });
      if (res.data.success && res.data.token) {
        sessionStorage.setItem('vantixAdminToken', res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page" style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "var(--bg-primary)",
      position: "relative",
      overflow: "hidden",
      padding: "40px 20px"
    }}>
      
      {/* Background Ambience */}
      <div className="login-bg-grid" style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: "radial-gradient(circle at 2px 2px, rgba(37, 230, 217, 0.05) 1px, transparent 0)",
        backgroundSize: "40px 40px",
        zIndex: 0
      }} />

      <div style={{
        position: "absolute",
        bottom: "-10%",
        left: "-10%",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(37, 230, 217, 0.03) 0%, transparent 60%)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      <div style={{
        zIndex: 1,
        width: "100%",
        maxWidth: "1000px",
        background: "var(--bg-glass)",
        backdropFilter: "blur(32px)",
        border: "1px solid var(--border-color)",
        borderRadius: "24px",
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(0,0,0,0.5)"
      }}>
        
        {/* Left Section - Information & Plans */}
        <section style={{ padding: "60px", background: "rgba(255,255,255,0.01)", borderRight: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,30,56,0.1)", border: "1px solid rgba(255,30,56,0.3)", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={vantixIcon} alt="Vantix" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(255,30,56,0.6))" }} />
            </div>
            <span style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "2px", color: "var(--text-primary)" }}>VANTIX</span>
          </div>

          <h2 style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-primary)", marginBottom: "16px", lineHeight: 1.2 }}>
            Establish Your <br /> <span className="gradient-teal">Security Perimeter</span>
          </h2>
          <p style={{ color: "var(--muted-2)", fontSize: "15px", lineHeight: 1.6, marginBottom: "48px" }}>
            Deploy Vantix across your organization to monitor violations and manage employee access with enterprise-grade tactical controls.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand)", textTransform: "uppercase", letterSpacing: "2px" }}>
              Operational Licenses
            </h3>
            
            <div className="grid grid--2" style={{ gap: "16px" }}>
              <div className="card" style={{ padding: "20px", background: "rgba(255,255,255,0.02)", opacity: 0.6, cursor: 'not-allowed' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <Zap size={20} color="var(--muted-2)" />
                  <span className="badge" style={{ fontSize: '9px' }}>PENDING</span>
                </div>
                <p style={{ fontWeight: "700", fontSize: "16px", marginBottom: "4px" }}>Starter</p>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)" }}>FREE</div>
                <p style={{ fontSize: "12px", color: "var(--muted-2)", marginTop: "8px" }}>Up to 5 nodes. Basic rule set.</p>
              </div>

              <div className="card" style={{ padding: "20px", background: "rgba(37, 230, 217, 0.05)", border: "1px solid rgba(37, 230, 217, 0.3)" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <Star size={20} color="var(--brand)" fill="var(--brand)" />
                  <span className="badge badge--admin" style={{ fontSize: '9px' }}>ACTIVE</span>
                </div>
                <p style={{ fontWeight: "700", fontSize: "16px", marginBottom: "4px", color: "var(--brand)" }}>Pro Node</p>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)" }}>$12<span style={{ fontSize: "12px", fontWeight: "400", color: "var(--muted-2)" }}>/mo</span></div>
                <p style={{ fontSize: "12px", color: "var(--muted-2)", marginTop: "8px" }}>Unlimited nodes. Advanced regex & alerts.</p>
              </div>
            </div>

            <div className="card" style={{ padding: "20px", background: "rgba(255,255,255,0.02)", opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'not-allowed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Building size={20} color="var(--muted-2)" />
                <div>
                  <p style={{ fontWeight: "700", fontSize: "15px" }}>Enterprise Grid</p>
                  <p style={{ fontSize: "12px", color: "var(--muted-2)" }}>Custom integrations & dedicated support.</p>
                </div>
              </div>
              <span className="badge" style={{ fontSize: '9px' }}>INQUIRY ONLY</span>
            </div>
          </div>
        </section>

        {/* Right Section - Registration Form */}
        <section style={{ padding: "60px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
            <div>
              <h3 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>Register</h3>
              <p style={{ fontSize: "14px", color: "var(--muted-2)" }}>Create your admin account</p>
            </div>
            <div className="badge badge--admin" style={{ padding: '6px 12px', fontSize: '11px' }}>ADMIN NODE</div>
          </div>

          {error && <div className="toast toast--err" style={{ marginBottom: "24px" }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="field">
              <label className="label">FULL NAME</label>
              <div style={{ position: "relative" }}>
                <User size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)" }} />
                <input className="input" type="text" placeholder="Commander Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ paddingLeft: "42px" }} required />
              </div>
            </div>

            <div className="field">
              <label className="label">ORGANIZATION EMAIL</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)" }} />
                <input className="input" type="email" placeholder="admin@organization.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: "42px" }} required />
              </div>
            </div>

            <div className="grid grid--2" style={{ gap: "16px" }}>
              <div className="field">
                <label className="label">PASSWORD</label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)" }} />
                  <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: "42px" }} required />
                </div>
              </div>
              <div className="field">
                <label className="label">CONFIRM</label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)" }} />
                  <input className="input" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ paddingLeft: "42px" }} required />
                </div>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn btn--primary" style={{ height: "48px", fontWeight: "700", marginTop: "12px" }}>
              {busy ? "INITIALIZING SECURE NODE..." : "CREATE ORGANIZATION"}
            </button>

            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <p style={{ fontSize: "13px", color: "var(--muted-2)" }}>
                Active identifier detected? <Link to="/login" style={{ color: "var(--brand)", fontWeight: "700", textDecoration: "none" }}>Access Node →</Link>
              </p>
            </div>
          </form>

          <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid var(--border-color)", display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} color="var(--brand)" />
            <span style={{ fontSize: '11px', color: 'var(--muted-2)', letterSpacing: '0.5px' }}>Compliance: SOC2 / GDPR / HIPAA Ready</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminRegister;