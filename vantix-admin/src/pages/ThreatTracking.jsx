import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Search,
  ArrowLeft,
  Terminal,
  Sparkles,
  ChevronRight,
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

const PIE_COLORS = ["#ff0055", "#e11d48", "#f43f5e", "#9f1239", "#f59e0b", "#fb7185"];

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
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {selectedEmployeeId && (
            <button className="apple-btn" onClick={() => setSelectedEmployeeId(null)} style={{ padding: "6px 12px" }}>
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          )}
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
            {selectedEmployee ? selectedEmployee.name : "Threat Tracking"}
          </h1>
        </div>

        {!selectedEmployeeId && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 280 }}>
              <Search size={14} color="var(--apple-text-muted)" style={{ position: "absolute", left: 14, top: 12 }} />
              <input
                type="text"
                className="apple-input"
                placeholder="Search employee or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>
        )}
      </div>

      {!selectedEmployeeId ? (
        /* Overview Table View */
        <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={16} color="#ff0055" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>Flagged Identities</span>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((filter) => (
                <button
                  key={filter}
                  className={`apple-btn ${threatFilter === filter ? "primary" : ""}`}
                  onClick={() => setThreatFilter(filter)}
                  style={{ padding: "4px 12px", fontSize: 11 }}
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
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Host / IP</th>
                  <th>Peak Risk</th>
                  <th>Exfiltration Attempts</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} style={{ cursor: "pointer" }} onClick={() => setSelectedEmployeeId(emp.id)}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "#ffffff" }}>{emp.name}</span>
                        <span style={{ fontSize: 11, color: "var(--apple-text-muted)" }}>{emp.email}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--apple-text-sub)" }}>{emp.department}</td>
                    <td style={{ fontSize: 12, fontFamily: "monospace", color: "var(--apple-text-muted)" }}>
                      {emp.endpointHost}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: emp.peakRiskScore >= 80 ? "#ff0055" : "#f59e0b" }}>
                        {emp.peakRiskScore}/100
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>
                      {emp.totalAttempts} attempts
                    </td>
                    <td>
                      <span className={`apple-pill ${emp.threatLevel === "CRITICAL" ? "red" : emp.threatLevel === "HIGH" ? "amber" : "red"}`}>
                        {emp.threatLevel}
                      </span>
                    </td>
                    <td>
                      <button className="apple-btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setSelectedEmployeeId(emp.id); }}>
                        <span>Inspect</span>
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--apple-text-muted)" }}>
                      No threat identities match search filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Employee Forensics Dossier View */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Top Profile Summary Strip */}
          <div className="apple-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: selectedEmployee.threatLevel === "CRITICAL" ? "linear-gradient(135deg, #ff0055 0%, #e11d48 100%)" : "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {selectedEmployee.name.slice(0, 2).toUpperCase()}
              </div>

              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", margin: 0 }}>{selectedEmployee.name}</h2>
                <div style={{ fontSize: 12, color: "var(--apple-text-muted)", marginTop: 4 }}>
                  {selectedEmployee.email} • {selectedEmployee.department} • {selectedEmployee.endpointHost} ({selectedEmployee.endpointIp})
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: selectedEmployee.threatLevel === "CRITICAL" ? "#ff0055" : "#f59e0b" }}>
                  {selectedEmployee.peakRiskScore}/100
                </div>
                <div style={{ fontSize: 11, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Peak Risk</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff" }}>{selectedEmployee.totalAttempts}</div>
                <div style={{ fontSize: 11, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Exfiltrations</div>
              </div>
            </div>
          </div>

          {/* 2 Graphs: Risk Timeline & Category Distribution */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
            <div className="apple-card">
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", marginBottom: 16 }}>Risk Progression Timeline</div>
              <div style={{ height: 180, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={riskTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff0055" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ff0055" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(225,29,72,0.06)" />
                    <XAxis dataKey="attempt" stroke="#71717a" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} />
                    <Tooltip className="apple-tooltip" />
                    <Area type="monotone" dataKey="riskScore" stroke="#ff0055" strokeWidth={2} fillOpacity={1} fill="url(#riskGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="apple-card">
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", marginBottom: 16 }}>Targeted Confidential Categories</div>
              <div style={{ height: 180, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4}>
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip className="apple-tooltip" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chronological Prompt Forensics Log */}
          <div className="apple-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Terminal size={16} color="#ff0055" />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>Chronological Prompt Forensics</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {selectedEmployee.incidentsList.map((inc, idx) => {
                const isBlocked = inc.actionTaken === "hard_block";
                return (
                  <div
                    key={inc.id || idx}
                    style={{
                      background: "rgba(13, 14, 18, 0.6)",
                      border: "1px solid var(--apple-border)",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>INCIDENT #{selectedEmployee.incidentsList.length - idx}</span>
                        <span className="apple-pill red">{inc.aiPlatform || "chatgpt.com"}</span>
                        <span style={{ fontSize: 11, color: "var(--apple-text-muted)" }}>
                          {new Date(inc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>

                      <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                        {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ background: "rgba(255, 0, 85, 0.05)", border: "1px solid rgba(255, 0, 85, 0.2)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#ff0055", textTransform: "uppercase", marginBottom: 6 }}>Outbound Prompt Attempt</div>
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#e5e7eb", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {inc.originalPrompt}
                        </div>
                      </div>

                      <div style={{ background: "rgba(225, 29, 72, 0.05)", border: "1px solid rgba(225, 29, 72, 0.2)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#e11d48", textTransform: "uppercase", marginBottom: 6 }}>Firewall Enforcement Result</div>
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#fca5a5", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
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
