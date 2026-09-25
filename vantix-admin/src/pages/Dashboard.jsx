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
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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

const PIE_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#e11d48", // Rose Red
];

const renderAiPlatformBadge = (platform) => {
  const p = (platform || "").toLowerCase();
  let displayName = platform || "AI Endpoint";
  let pillClass = "red";

  if (p.includes("kiro") || p.includes("amazonaws.com") || p.includes("amazon q") || p.includes("codewhisperer")) {
    displayName = "Kiro (Amazon Q)";
    pillClass = "rose";
  } else if (p.includes("cursor")) {
    displayName = "Cursor AI";
    pillClass = "rose";
  } else if (p.includes("antigravity") || p.includes("cloudcode") || p.includes("cloudaicompanion")) {
    displayName = "Antigravity (Gemini)";
    pillClass = "rose";
  } else if (p.includes("windsurf") || p.includes("codeium")) {
    displayName = "Windsurf AI";
    pillClass = "rose";
  } else if (p.includes("github") || p.includes("copilot")) {
    displayName = "GitHub Copilot";
    pillClass = "rose";
  } else if (p.includes("chatgpt")) {
    displayName = "ChatGPT";
    pillClass = "red";
  } else if (p.includes("claude") || p.includes("anthropic")) {
    displayName = "Claude";
    pillClass = "rose";
  } else if (p.includes("gemini")) {
    displayName = "Gemini";
    pillClass = "rose";
  }

  return <span className={`apple-pill ${pillClass}`}>{displayName}</span>;
};

function KpiSquareStatCard({ label, value, icon, color, tooltip, borderTopColor, bgGradient }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <motion.div
      className="apple-card kpi-square-card"
      whileHover={{ y: -4, borderColor: color }}
      style={{
        background: bgGradient,
        borderTop: `2px solid ${borderTopColor}`,
      }}
    >
      <div className="kpi-square-top">
        <span className="kpi-square-label">{label}</span>
        <div
          className="kpi-info-trigger"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
          tabIndex={0}
          aria-label={`${label} Information`}
        >
          <Info size={13} />
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                className="kpi-square-tooltip"
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <div className="kpi-tooltip-title">{label}</div>
                <div className="kpi-tooltip-desc">{tooltip}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="kpi-square-center">
        <div
          className="kpi-square-icon-box"
          style={{
            borderColor: `${color}45`,
            background: `${color}18`,
            color: color,
            boxShadow: `0 8px 24px ${color}25`,
          }}
        >
          {icon}
        </div>
      </div>

      <div className="kpi-square-bottom">
        <div
          className="kpi-square-value"
          style={{
            color: color === "#10b981" ? "#10b981" : color === "#ff0055" || color === "#e11d48" || color === "#f43f5e" ? color : "#ffffff"
          }}
        >
          {value}
        </div>
      </div>
    </motion.div>
  );
}

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
                  department: log.department || "Engineering",
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
    const interval = setInterval(fetchLiveData, 10000);

    const handleOpenSim = () => setShowSimModal(true);
    const handleExport = () => handleExportAudit();

    window.addEventListener('vantix:open-simulate', handleOpenSim);
    window.addEventListener('vantix:export-audit', handleExport);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
      window.removeEventListener('vantix:open-simulate', handleOpenSim);
      window.removeEventListener('vantix:export-audit', handleExport);
    };
  }, [incidents]);

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
      fetchLiveData();
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
    downloadAnchor.setAttribute("download", "vantix-audit-log.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "column", gap: 28 }}
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
              background: "rgba(13, 14, 18, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(225, 29, 72, 0.4)",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: "9999px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Sparkles size={14} color="#ff0055" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--apple-text-main)", margin: 0, letterSpacing: "-0.02em" }}>
          Operation Centre
        </h1>
      </div>

      {/* 4 Square Cyberpunk KPI Scorecards */}
      <div className="kpi-square-grid">
        <KpiSquareStatCard
          label="Total Intercepts"
          value={totalIntercepts}
          icon={<Activity size={26} color="#ff0055" />}
          color="#ff0055"
          borderTopColor="#ff0055"
          bgGradient="linear-gradient(145deg, rgba(255, 0, 85, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
          tooltip="Real-time OS proxy stream monitoring outbound AI requests, prompt payloads & neural tokens."
        />

        <KpiSquareStatCard
          label="Hard Blocked"
          value={totalBlocked}
          icon={<ShieldAlert size={26} color="#e11d48" />}
          color="#e11d48"
          borderTopColor="#e11d48"
          bgGradient="linear-gradient(145deg, rgba(225, 29, 72, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
          tooltip="Outbound prompts immediately blocked and halted before AI transmission due to critical credentials, keys, or high risk scores."
        />

        <KpiSquareStatCard
          label="Silent Redacted"
          value={totalRedacted}
          icon={<Lock size={26} color="#f43f5e" />}
          color="#f43f5e"
          borderTopColor="#f43f5e"
          bgGradient="linear-gradient(145deg, rgba(244, 63, 94, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
          tooltip="Outbound prompts sanitized in-flight with sensitive tokens scrubbed & masked, allowing benign workflow to continue."
        />

        <KpiSquareStatCard
          label="Block Rate"
          value={`${totalIntercepts > 0 ? Math.round((totalBlocked / totalIntercepts) * 100) : 0}%`}
          icon={<Zap size={26} color="#10b981" />}
          color="#10b981"
          borderTopColor="#10b981"
          bgGradient="linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
          tooltip="Enforcement protection ratio calculated as total hard-blocked violations divided by total inspected events."
        />
      </div>

      {/* 2 Clean Recharts Visualizations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 }}>
        {/* Chart 1: Exfiltration Data Classes */}
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Database size={16} color="#ff0055" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-main)" }}>Exfiltration Vectors</span>
            </div>
          </div>

          <div style={{ height: 230, width: "100%" }}>
            {globalCategoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={globalCategoryChartData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={68}
                    stroke="#0d0e12"
                    strokeWidth={1.5}
                    label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : "")}
                    labelLine={false}
                  >
                    {globalCategoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13, 14, 18, 0.95)",
                      border: "1px solid var(--apple-border-strong)",
                      borderRadius: "10px",
                      color: "#ffffff",
                      fontSize: "12px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
                    }}
                    formatter={(value, name) => [`${value} incidents`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: "#a1a1aa", paddingTop: 4 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--apple-text-muted)", fontSize: 12 }}>
                No exfiltration vectors recorded
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Enforcement Breakdown */}
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} color="#e11d48" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-main)" }}>Enforcement Actions</span>
            </div>
          </div>

          <div style={{ height: 230, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={globalEnforcementData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(225,29,72,0.06)" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={11} width={110} tickLine={false} />
                <Tooltip className="apple-tooltip" />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
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
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={16} color="#ff0055" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-main)" }}>Real-time Interception Feed</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--apple-text-muted)" }}>{incidents.length} events</span>
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
              {incidents.slice(0, 7).map((inc, idx) => {
                const isBlocked = inc.actionTaken === "hard_block";
                return (
                  <tr key={inc.id || idx}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "var(--apple-text-main)" }}>{inc.userName}</span>
                        <span style={{ fontSize: 11, color: "var(--apple-text-muted)" }}>{inc.endpointHost}</span>
                      </div>
                    </td>
                    <td>
                      {renderAiPlatformBadge(inc.aiPlatform)}
                    </td>
                    <td>
                      <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                        {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: inc.riskScore >= 70 ? "#ff0055" : "#f59e0b" }}>
                        {inc.riskScore}/100
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--apple-text-muted)" }}>
                      {new Date(inc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--apple-text-muted)" }}>
                    No interceptions recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apple Simulation Modal */}
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: 440, maxWidth: "90vw", background: "rgba(13, 14, 18, 0.95)", border: "1px solid rgba(225, 29, 72, 0.3)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 16 }}>
                Simulate Exfiltration Test
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
                    Select User Origin
                  </label>
                  <select
                    className="apple-input"
                    value={simEmployee}
                    onChange={(e) => setSimEmployee(e.target.value)}
                  >
                    <option value="employee">Current Workstation User</option>
                    <option value="sarah_chen">Sarah Chen (DevOps)</option>
                    <option value="david_miller">David Miller (Finance)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
                    Scenario Type
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                <button className="apple-btn" onClick={() => setShowSimModal(false)}>
                  Cancel
                </button>
                <button className="apple-btn primary" onClick={handleSimulate} disabled={isSimulating}>
                  {isSimulating ? "Testing..." : "Launch Interception"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
