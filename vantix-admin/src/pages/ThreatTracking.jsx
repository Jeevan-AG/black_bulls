import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Search,
  ArrowLeft,
  Terminal,
  Sparkles,
  ChevronRight,
  Shield,
  Lock,
  User,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
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

export default function ThreatTracking() {
  const [incidents, setIncidents] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [threatFilter, setThreatFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState(null);

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
      console.error("Error fetching threat telemetry:", err);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 5000);

    const connectWs = () => {
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "detection" || data.originalPrompt) {
              const inc = data;
              setIncidents((prev) => [
                {
                  id: inc.id || `ws-${Date.now()}`,
                  userId: inc.user || inc.userId || "anonymous",
                  userName: inc.userName || (inc.user ? inc.user.charAt(0).toUpperCase() + inc.user.slice(1) : "Unknown User"),
                  userEmail: inc.userEmail || `${inc.user || "user"}@acme.corp`,
                  department: inc.department || "Engineering",
                  endpointHost: inc.host || inc.endpointHost || "workstation",
                  endpointIp: inc.endpointIp || "127.0.0.1",
                  aiPlatform: inc.aiPlatform || "chatgpt.com",
                  actionTaken: inc.actionTaken || "silent_redact",
                  riskScore: inc.riskScore || 50,
                  categoriesRedacted: inc.categoriesRedacted || ["SENSITIVE_DATA"],
                  detections: inc.detections || [],
                  originalPrompt: inc.originalPrompt || "Intercepted prompt",
                  sanitizedPrompt: inc.sanitizedPrompt || "[REDACTED]",
                  timestamp: inc.timestamp || new Date().toISOString(),
                },
                ...prev,
              ]);
            }
          } catch (e) {
            console.error("WS Parse Error", e);
          }
        };
      } catch (err) {
        console.error("WS Connect Error", err);
      }
    };

    connectWs();
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const flaggedEmployees = useMemo(() => {
    const map = new Map();
    incidents.forEach((inc) => {
      const uid = inc.userId || "employee";
      if (!map.has(uid)) {
        map.set(uid, {
          id: uid,
          name: inc.userName || uid,
          email: inc.userEmail || `${uid}@acme.corp`,
          department: inc.department || "Engineering",
          endpointHost: inc.endpointHost || "workstation",
          endpointIp: inc.endpointIp || "127.0.0.1",
          totalAttempts: 0,
          hardBlockedCount: 0,
          redactedCount: 0,
          peakRiskScore: 0,
          lastAttempt: inc.timestamp,
          categoriesMap: new Map(),
          incidentsList: [],
        });
      }

      const emp = map.get(uid);
      emp.totalAttempts += 1;
      if (inc.actionTaken === "hard_block") emp.hardBlockedCount += 1;
      if (inc.actionTaken === "silent_redact") emp.redactedCount += 1;
      if ((inc.riskScore || 0) > emp.peakRiskScore) emp.peakRiskScore = inc.riskScore;

      (inc.categoriesRedacted || []).forEach((cat) => {
        emp.categoriesMap.set(cat, (emp.categoriesMap.get(cat) || 0) + 1);
      });

      emp.incidentsList.push(inc);
    });

    return Array.from(map.values()).map((emp) => {
      emp.incidentsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      let threatLevel = "MEDIUM";
      if (emp.peakRiskScore >= 80 || emp.hardBlockedCount > 0) threatLevel = "CRITICAL";
      else if (emp.peakRiskScore >= 50) threatLevel = "HIGH";
      emp.threatLevel = threatLevel;
      return emp;
    });
  }, [incidents]);

  const filteredEmployees = useMemo(() => {
    return flaggedEmployees.filter((emp) => {
      const matchSearch =
        !searchTerm ||
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase());

      let matchThreat = true;
      if (threatFilter === "CRITICAL") matchThreat = emp.threatLevel === "CRITICAL";
      else if (threatFilter === "HIGH") matchThreat = emp.threatLevel === "HIGH";
      else if (threatFilter === "MEDIUM") matchThreat = emp.threatLevel === "MEDIUM";

      return matchSearch && matchThreat;
    });
  }, [flaggedEmployees, searchTerm, threatFilter]);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return flaggedEmployees.find((e) => e.id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, flaggedEmployees]);

  const categoryChartData = useMemo(() => {
    if (!selectedEmployee) return [];
    return Array.from(selectedEmployee.categoriesMap.entries()).map(([name, count]) => ({ name, count }));
  }, [selectedEmployee]);

  const riskTimelineData = useMemo(() => {
    if (!selectedEmployee) return [];
    return [...selectedEmployee.incidentsList].reverse().map((inc, idx) => ({
      attempt: `#${idx + 1}`,
      riskScore: inc.riskScore || 0,
    }));
  }, [selectedEmployee]);

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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {selectedEmployeeId && (
            <button className="apple-btn" onClick={() => setSelectedEmployeeId(null)} style={{ padding: "8px 16px" }}>
              <ArrowLeft size={14} />
              <span>Back to Overview</span>
            </button>
          )}
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.03em" }}>
              {selectedEmployee ? selectedEmployee.name : "Threat Tracking & Identity Forensics"}
            </h1>
            <p style={{ fontSize: 13.5, color: "var(--apple-text-sub)", margin: "4px 0 0 0" }}>
              Per-user DLP risk scoring, anomaly telemetry, and outbound prompt interception logs
            </p>
          </div>
        </div>

        {!selectedEmployeeId && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 300 }}>
              <Search size={15} color="var(--apple-text-muted)" style={{ position: "absolute", left: 14, top: 13 }} />
              <input
                type="text"
                className="apple-input"
                placeholder="Search user, host, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>
        )}
      </div>

      {!selectedEmployeeId ? (
        /* Overview Table View */
        <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 26px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.015)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255, 0, 85, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldAlert size={16} color="#ff0055" />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", display: "block" }}>Flagged Identities</span>
                <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>Classified by risk severity & volume</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((filter) => (
                <button
                  key={filter}
                  className={`apple-btn ${threatFilter === filter ? "primary" : ""}`}
                  onClick={() => setThreatFilter(filter)}
                  style={{ padding: "5px 14px", fontSize: 11.5, fontWeight: 700 }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="apple-table">
              <thead>
                <tr>
                  <th>Employee / Workstation</th>
                  <th>Department</th>
                  <th>Host / IP</th>
                  <th>Peak Risk</th>
                  <th>Exfiltration Count</th>
                  <th>Threat Tier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} style={{ cursor: "pointer" }} onClick={() => setSelectedEmployeeId(emp.id)}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>{emp.name}</span>
                        <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>{emp.email}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--apple-text-sub)" }}>{emp.department}</td>
                    <td style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--apple-text-muted)" }}>
                      {emp.endpointHost}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 44, height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(emp.peakRiskScore, 100)}%`,
                              height: "100%",
                              background: emp.peakRiskScore >= 80 ? "#ff0055" : emp.peakRiskScore >= 50 ? "#f59e0b" : "#10b981",
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 800, color: emp.peakRiskScore >= 80 ? "#ff0055" : emp.peakRiskScore >= 50 ? "#fbbf24" : "#34d399" }}>
                          {emp.peakRiskScore}/100
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff" }}>
                      {emp.totalAttempts} attempts
                    </td>
                    <td>
                      <span className={`apple-pill ${emp.threatLevel === "CRITICAL" ? "red" : emp.threatLevel === "HIGH" ? "amber" : "cyan"}`}>
                        {emp.threatLevel}
                      </span>
                    </td>
                    <td>
                      <button className="apple-btn" style={{ padding: "6px 12px", fontSize: 11.5 }} onClick={(e) => { e.stopPropagation(); setSelectedEmployeeId(emp.id); }}>
                        <span>Inspect Dossier</span>
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 24px", color: "var(--apple-text-muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <Shield size={22} color="#ff0055" />
                        <span>No threat identities match search filter</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Employee Forensics Dossier View */
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* Top Profile Summary Strip */}
          <div className="apple-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  background: selectedEmployee.threatLevel === "CRITICAL" ? "linear-gradient(135deg, #ff0055 0%, #e11d48 100%)" : "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#ffffff",
                  boxShadow: "0 10px 30px rgba(255, 0, 85, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                }}
              >
                {selectedEmployee.name.slice(0, 2).toUpperCase()}
              </div>

              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", margin: 0 }}>{selectedEmployee.name}</h2>
                <div style={{ fontSize: 13, color: "var(--apple-text-sub)", marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
                  {selectedEmployee.email} • {selectedEmployee.department} • {selectedEmployee.endpointHost} ({selectedEmployee.endpointIp})
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: selectedEmployee.threatLevel === "CRITICAL" ? "#ff0055" : "#f59e0b" }}>
                  {selectedEmployee.peakRiskScore}/100
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--apple-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Peak Risk</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{selectedEmployee.totalAttempts}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--apple-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Exfiltrations</div>
              </div>
            </div>
          </div>

          {/* 2 Graphs: Risk Timeline & Category Distribution */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 22 }}>
            <div className="apple-card">
              <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 18 }}>Risk Progression Timeline</div>
              <div style={{ height: 190, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={riskTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff0055" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#ff0055" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,0,85,0.06)" />
                    <XAxis dataKey="attempt" stroke="#64748b" fontSize={11.5} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11.5} />
                    <Tooltip className="apple-tooltip" />
                    <Area type="monotone" dataKey="riskScore" stroke="#ff0055" strokeWidth={2.5} fillOpacity={1} fill="url(#riskGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="apple-card">
              <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 18 }}>Targeted Confidential Categories</div>
              <div style={{ height: 190, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip className="apple-tooltip" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chronological Prompt Forensics Log */}
          <div className="apple-card" style={{ padding: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255, 0, 85, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Terminal size={16} color="#ff0055" />
              </div>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", display: "block" }}>Chronological Prompt Forensics</span>
                <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>Raw vs sanitized outbound payload inspection</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {selectedEmployee.incidentsList.map((inc, idx) => {
                const isBlocked = inc.actionTaken === "hard_block";
                return (
                  <div
                    key={inc.id || idx}
                    style={{
                      background: "rgba(9, 11, 17, 0.75)",
                      border: "1px solid var(--apple-border)",
                      borderRadius: 16,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em" }}>INCIDENT #{selectedEmployee.incidentsList.length - idx}</span>
                        <span className="apple-pill red" style={{ fontFamily: "JetBrains Mono, monospace" }}>{inc.aiPlatform || "chatgpt.com"}</span>
                        <span style={{ fontSize: 11.5, color: "var(--apple-text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                          {new Date(inc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>

                      <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                        {isBlocked ? <ShieldAlert size={12} /> : <Lock size={12} />}
                        {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ background: "rgba(255, 0, 85, 0.06)", border: "1px solid rgba(255, 0, 85, 0.25)", borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#ff0055", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Outbound Intercepted Prompt
                        </div>
                        <div style={{ fontSize: 12.5, fontFamily: "JetBrains Mono, monospace", color: "#f1f5f9", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {inc.originalPrompt}
                        </div>
                      </div>

                      <div style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Enforcement Scrubbed Result
                        </div>
                        <div style={{ fontSize: 12.5, fontFamily: "JetBrains Mono, monospace", color: "#a7f3d0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {inc.sanitizedPrompt}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
