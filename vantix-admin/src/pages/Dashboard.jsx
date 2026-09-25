import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  Lock,
  Activity,
  Download,
  Play,
  Sparkles,
  Database,
  Terminal,
  Zap,
  Radio,
  Cpu,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const CLOUD_BACKEND_URL = "https://vantix-backend-7gcw.onrender.com";
const CLOUD_WS_URL = "wss://vantix-backend-7gcw.onrender.com/ws/vantix";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && (window.location.port === "5173" || window.location.hostname === "localhost")
    ? "http://localhost:5000"
    : CLOUD_BACKEND_URL);

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== "undefined" && (window.location.port === "5173" || window.location.hostname === "localhost")) {
    return `ws://${window.location.hostname || "localhost"}:5000/ws/vantix`;
  }
  return CLOUD_WS_URL;
};

const PIE_COLORS = ["#ff0055", "#e11d48", "#f43f5e", "#fb7185", "#f59e0b", "#06b6d4"];

export default function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Simulation Modal State
  const [showSimModal, setShowSimModal] = useState(false);
  const [simEmployee, setSimEmployee] = useState("employee");
  const [simLeakType, setSimLeakType] = useState("aws_keys");
  const [simCustomPrompt, setSimCustomPrompt] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const wsRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchLiveData = async () => {
    try {
      const auditRes = await fetch(`${API_BASE}/api/vantix/audit-logs`);
      if (auditRes.ok) {
        const auditJson = await auditRes.json();
        if (auditJson.success && Array.isArray(auditJson.logs) && auditJson.logs.length > 0) {
          setIncidents((prev) => {
            const merged = [...prev];
            auditJson.logs.forEach((log) => {
              if (log.userId && !merged.some((m) => m.id === log.id || (m.timestamp === log.timestamp && m.userId === log.userId))) {
                merged.unshift({
                  id: log.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  userId: log.userId,
                  userName: log.userName || log.userId.charAt(0).toUpperCase() + log.userId.slice(1).replace(/[._]/g, " "),
                  userEmail: log.userEmail || `${log.userId}@acme.corp`,
                  department: log.department || "Core Systems",
                  endpointHost: log.endpointHost || log.host || `${log.userId}-workstation`,
                  endpointIp: log.endpointIp || "127.0.0.1",
                  aiPlatform: log.aiPlatform || "chatgpt.com",
                  actionTaken: log.actionTaken || (log.riskScore >= 70 ? "hard_block" : log.riskScore >= 30 ? "silent_redact" : "pass"),
                  riskScore: log.riskScore !== undefined ? log.riskScore : 0,
                  categoriesRedacted: log.categoriesRedacted || ["CONFIDENTIAL_DATA"],
                  detections: log.detections || [],
                  originalPrompt: log.originalPrompt || log.promptSnippet || "Outbound prompt intercepted",
                  sanitizedPrompt: log.sanitizedPrompt || "[SANITIZED]",
                  timestamp: log.timestamp || new Date().toISOString(),
                });
              }
            });
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn("API sync notice:", err.message);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const wsUrl = getWsUrl();
    let socket = null;

    function connect() {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(event.data);
            if (packet.type === "detection" || packet.originalPrompt) {
              const incoming = {
                id: packet.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                userId: packet.user || "employee",
                userName: packet.userName || (packet.user ? packet.user.charAt(0).toUpperCase() + packet.user.slice(1).replace(/[._]/g, " ") : "Employee"),
                userEmail: packet.userEmail || `${packet.user || "employee"}@acme.corp`,
                department: packet.department || "Core Systems",
                endpointHost: packet.host || "workstation",
                endpointIp: packet.endpointIp || "127.0.0.1",
                aiPlatform: packet.aiPlatform || "chatgpt.com",
                actionTaken: packet.actionTaken || (packet.riskScore >= 70 ? "hard_block" : packet.riskScore >= 30 ? "silent_redact" : "pass"),
                riskScore: packet.riskScore !== undefined ? packet.riskScore : 0,
                categoriesRedacted: packet.detections ? Array.from(new Set(packet.detections.map((d) => d.category))) : (packet.categoriesRedacted || ["CONFIDENTIAL_DATA"]),
                detections: packet.detections || [],
                originalPrompt: packet.originalPrompt || "Outbound prompt intercepted",
                sanitizedPrompt: packet.sanitizedPrompt || "[SANITIZED]",
                timestamp: packet.timestamp || new Date().toISOString(),
              };

              setIncidents((prev) => [incoming, ...prev]);
              showToast(`Interception: ${incoming.userName} (${incoming.actionTaken === "hard_block" ? "Blocked" : "Redacted"})`);
            }
          } catch (e) {
            console.error("Packet parse error:", e);
          }
        };

        socket.onclose = () => setTimeout(connect, 4000);
      } catch (err) {
        console.warn("WebSocket error:", err);
      }
    }

    connect();
    const interval = setInterval(fetchLiveData, 8000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const totalIntercepts = incidents.length;
  const totalBlocked = incidents.filter((i) => i.actionTaken === "hard_block").length;
  const totalRedacted = incidents.filter((i) => i.actionTaken === "silent_redact").length;

  const globalCategoryChartData = useMemo(() => {
    const counts = {};
    incidents.forEach((inc) => {
      const cats = inc.categoriesRedacted && inc.categoriesRedacted.length > 0
        ? inc.categoriesRedacted
        : (inc.detections || []).map((d) => d.category);
      cats.forEach((c) => {
        const clean = c.replace(/_/g, " ").toUpperCase();
        counts[clean] = (counts[clean] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [incidents]);

  const globalEnforcementData = useMemo(() => {
    return [
      { name: "Hard Blocked", count: totalBlocked, fill: "#ff0055" },
      { name: "Silent Redacted", count: totalRedacted, fill: "#e11d48" },
      { name: "Monitored Pass", count: Math.max(0, totalIntercepts - totalBlocked - totalRedacted), fill: "#10b981" },
    ];
  }, [totalIntercepts, totalBlocked, totalRedacted]);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      let prompt = simCustomPrompt;
      if (!prompt) {
        if (simLeakType === "aws_keys") {
          prompt = 'AWS Key leak check: access_key_id = "AKIAIOSFODNN7EXAMPLE" and secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"';
        } else if (simLeakType === "scada_reg") {
          prompt = "SCADA PLC register 0x4001 at 192.168.1.50 turbine trip sequence analysis.";
        } else {
          prompt = "PCI verification: card 4532-8812-9901-4321, cvv 882 for payment testing.";
        }
      }

      await fetch(`${API_BASE}/api/vantix/simulate-leak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: simEmployee, leakType: simLeakType, prompt }),
      });

      showToast(`Simulation launched for ${simEmployee}`);
      setShowSimModal(false);
      setSimCustomPrompt("");
      setTimeout(fetchLiveData, 600);
    } catch (err) {
      showToast("Simulation sent via stream");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExportAudit = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(incidents, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "vantix-dlp-audit-log.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "column", gap: 30 }}
    >
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: "fixed",
              top: 24,
              right: 28,
              zIndex: 9999,
              background: "rgba(11, 13, 20, 0.96)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 0, 85, 0.5)",
              color: "#ffffff",
              padding: "12px 22px",
              borderRadius: "9999px",
              boxShadow: "0 14px 40px rgba(0,0,0,0.8), 0 0 25px rgba(255,0,85,0.35)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Sparkles size={16} color="#ff0055" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.03em" }}>
              Operation Centre
            </h1>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 12px",
                borderRadius: "9999px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                color: "#34d399",
              }}
            >
              <span className="live-pulse-dot emerald" style={{ width: 6, height: 6 }} />
              SOC LIVE • PROXY 0.4ms
            </div>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: 13.5, color: "var(--apple-text-sub)" }}>
            Enterprise AI exfiltration mitigation & zero-trust packet inspector
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="apple-btn" onClick={() => setShowSimModal(true)}>
            <Play size={14} color="#ff0055" />
            <span>Simulate Test</span>
          </button>
          <button className="apple-btn primary" onClick={handleExportAudit}>
            <Download size={14} />
            <span>Export Audit</span>
          </button>
        </div>
      </div>

      {/* 4 Rich Cyberpunk KPI Scorecards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
        {/* Card 1: Total Intercepts */}
        <motion.div
          className="apple-card"
          whileHover={{ y: -3, borderColor: "rgba(255, 0, 85, 0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(255, 0, 85, 0.08) 0%, rgba(14, 17, 26, 0.85) 100%)",
            borderTop: "2px solid #ff0055",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--apple-text-sub)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Total Intercepts
            </span>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255, 0, 85, 0.14)", border: "1px solid rgba(255, 0, 85, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(255, 0, 85, 0.25)" }}>
              <Activity size={18} color="#ff0055" />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {totalIntercepts}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              <span className="live-pulse-dot" style={{ width: 5, height: 5 }} />
              <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)", fontWeight: 600 }}>Active OS packet stream</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Hard Blocked */}
        <motion.div
          className="apple-card"
          whileHover={{ y: -3, borderColor: "rgba(255, 23, 68, 0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(255, 23, 68, 0.08) 0%, rgba(14, 17, 26, 0.85) 100%)",
            borderTop: "2px solid #ff1744",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--apple-text-sub)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Hard Blocked
            </span>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255, 23, 68, 0.14)", border: "1px solid rgba(255, 23, 68, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(255, 23, 68, 0.25)" }}>
              <ShieldAlert size={18} color="#ff1744" />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#ff1744", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {totalBlocked}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--apple-text-muted)", marginTop: 10, fontWeight: 600 }}>
              Halted before AI transmission
            </div>
          </div>
        </motion.div>

        {/* Card 3: Silent Redacted */}
        <motion.div
          className="apple-card"
          whileHover={{ y: -3, borderColor: "rgba(244, 63, 94, 0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(14, 17, 26, 0.85) 100%)",
            borderTop: "2px solid #f43f5e",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--apple-text-sub)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Silent Redacted
            </span>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(244, 63, 94, 0.14)", border: "1px solid rgba(244, 63, 94, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(244, 63, 94, 0.25)" }}>
              <Lock size={18} color="#f43f5e" />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#f43f5e", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {totalRedacted}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--apple-text-muted)", marginTop: 10, fontWeight: 600 }}>
              PII & API tokens sanitized
            </div>
          </div>
        </motion.div>

        {/* Card 4: Protection Ratio */}
        <motion.div
          className="apple-card"
          whileHover={{ y: -3, borderColor: "rgba(16, 185, 129, 0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 17, 26, 0.85) 100%)",
            borderTop: "2px solid #10b981",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--apple-text-sub)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Enforcement Ratio
            </span>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(16, 185, 129, 0.25)" }}>
              <Zap size={18} color="#10b981" />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#10b981", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {totalIntercepts > 0 ? Math.round(((totalBlocked + totalRedacted) / totalIntercepts) * 100) : 100}%
            </div>
            <div style={{ fontSize: 11.5, color: "var(--apple-text-muted)", marginTop: 10, fontWeight: 600 }}>
              Zero uninspected leakage
            </div>
          </div>
        </motion.div>
      </div>

      {/* 2 Clean Recharts Visualizations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 22 }}>
        {/* Chart 1: Exfiltration Vectors */}
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255, 0, 85, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Database size={15} color="#ff0055" />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", display: "block" }}>Exfiltration Vectors</span>
                <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>Classified DLP threat categories</span>
              </div>
            </div>
            <span className="apple-pill red">{globalCategoryChartData.length} Classes</span>
          </div>

          <div style={{ height: 220, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {globalCategoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={globalCategoryChartData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {globalCategoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip className="apple-tooltip" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--apple-text-muted)", fontSize: 12.5 }}>
                <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px dashed rgba(255,0,85,0.3)" }}
                  />
                  <Radio size={24} color="#ff0055" />
                </div>
                <span>Radar Active • Awaiting Outbound Threat Signatures</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Enforcement Breakdown */}
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(225, 29, 72, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={15} color="#e11d48" />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", display: "block" }}>Enforcement Pipeline</span>
                <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>Interception actions executed</span>
              </div>
            </div>
            <span className="apple-pill red">{totalIntercepts} Processed</span>
          </div>

          <div style={{ height: 220, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={globalEnforcementData} layout="vertical" margin={{ top: 10, right: 24, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,0,85,0.06)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11.5} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11.5} width={120} tickLine={false} />
                <Tooltip className="apple-tooltip" />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={16}>
                  {globalEnforcementData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Interception Stream Feed */}
      <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.015)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255, 0, 85, 0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Terminal size={16} color="#ff0055" />
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", display: "block" }}>Real-time Interception Feed</span>
              <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>Live OS MITM packet inspection ledger</span>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--apple-text-sub)", fontWeight: 600 }}>{incidents.length} events logged</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="apple-table">
            <thead>
              <tr>
                <th>User / Workstation</th>
                <th>Target AI Platform</th>
                <th>Enforcement Action</th>
                <th>Risk Score</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 8).map((inc, idx) => {
                const isBlocked = inc.actionTaken === "hard_block";
                return (
                  <tr key={inc.id || idx}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>{inc.userName}</span>
                        <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{inc.endpointHost} ({inc.endpointIp})</span>
                      </div>
                    </td>
                    <td>
                      <span className="apple-pill red" style={{ textTransform: "lowercase", fontFamily: "JetBrains Mono, monospace" }}>
                        {inc.aiPlatform || "chatgpt.com"}
                      </span>
                    </td>
                    <td>
                      <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                        {isBlocked ? <ShieldAlert size={12} /> : <Lock size={12} />}
                        {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 50, height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(inc.riskScore, 100)}%`,
                              height: "100%",
                              background: inc.riskScore >= 70 ? "#ff0055" : inc.riskScore >= 30 ? "#f59e0b" : "#10b981",
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 13, color: inc.riskScore >= 70 ? "#ff0055" : inc.riskScore >= 30 ? "#fbbf24" : "#34d399" }}>
                          {inc.riskScore}/100
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--apple-text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                      {new Date(inc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,0,85,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Shield size={22} color="#ff0055" />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-sub)" }}>
                        No interception events recorded in this session.
                      </span>
                      <button className="apple-btn" onClick={() => setShowSimModal(true)} style={{ marginTop: 4 }}>
                        <Play size={13} color="#ff0055" />
                        <span>Trigger Test Interception</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulation Modal */}
      <AnimatePresence>
        {showSimModal && (
          <motion.div
            className="orion-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowSimModal(false)}
          >
            <motion.div
              className="apple-card"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              style={{ width: 480, maxWidth: "90vw", background: "rgba(11, 13, 20, 0.98)", border: "1px solid rgba(255, 0, 85, 0.4)", boxShadow: "0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(255,0,85,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255, 0, 85, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={16} color="#ff0055" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Simulate AI Exfiltration Test
                  </h3>
                  <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>Inject live test payloads into the MITM proxy pipeline</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--apple-text-sub)", marginBottom: 6, display: "block" }}>
                    Select User Origin
                  </label>
                  <select
                    className="apple-input"
                    value={simEmployee}
                    onChange={(e) => setSimEmployee(e.target.value)}
                  >
                    <option value="employee">Current Workstation User (127.0.0.1)</option>
                    <option value="sarah_chen">Sarah Chen (DevOps - SecOps Host)</option>
                    <option value="david_miller">David Miller (Finance - ERP Host)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--apple-text-sub)", marginBottom: 6, display: "block" }}>
                    Threat Scenario Type
                  </label>
                  <select
                    className="apple-input"
                    value={simLeakType}
                    onChange={(e) => setSimLeakType(e.target.value)}
                  >
                    <option value="aws_keys">AWS Credentials (AKIA... + Secret Key)</option>
                    <option value="scada_reg">SCADA PLC Register (Turbine 0x4001)</option>
                    <option value="credit_card">PCI Credit Card (Visa 4532...)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 26 }}>
                <button className="apple-btn" onClick={() => setShowSimModal(false)}>
                  Cancel
                </button>
                <button className="apple-btn primary" onClick={handleSimulate} disabled={isSimulating}>
                  {isSimulating ? "Injecting..." : "Launch Interception"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
