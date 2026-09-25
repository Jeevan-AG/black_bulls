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
  Fingerprint,
  Eye,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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

const cleanPromptText = (text) => {
  if (!text || typeof text !== "string") return "";
  let clean = text;

  const contextTags = [
    "EnvironmentContext",
    "CurrentFile",
    "WorkspaceContext",
    "EditorContext",
    "ProjectContext",
    "Context",
    "system",
    "workspace_info",
    "user_context"
  ];

  for (const tag of contextTags) {
    const fullTagRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    clean = clean.replace(fullTagRegex, "");

    const openTagIdx = clean.search(new RegExp(`<${tag}[^>]*>`, "i"));
    if (openTagIdx !== -1) {
      clean = clean.slice(0, openTagIdx);
    }
  }

  clean = clean.replace(/```(?:system_information|environment|context)[\s\S]*?```/gi, "");
  clean = clean.replace(/^User(?:\s+Query|\s+Question|\s+Prompt)?:\s*/i, "");

  return clean.trim() || text.trim();
};

const cleanAiResponseText = (raw) => {
  if (!raw || typeof raw !== "string") return "";

  const sseChunks = [];
  const sseLines = raw.split("\n");
  for (const line of sseLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:") && trimmed.length > 5) {
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === "[DONE]") continue;
      try {
        const obj = JSON.parse(dataStr);
        const delta =
          obj.choices?.[0]?.delta?.content ||
          obj.choices?.[0]?.delta?.text ||
          obj.choices?.[0]?.message?.content ||
          obj.choices?.[0]?.text;
        if (typeof delta === "string") {
          sseChunks.push(delta);
          continue;
        }
        if (obj.delta?.text) {
          sseChunks.push(obj.delta.text);
          continue;
        }
        if (obj.delta?.content) {
          sseChunks.push(obj.delta.content);
          continue;
        }
        if (obj.candidates?.[0]?.content?.parts?.[0]?.text) {
          sseChunks.push(obj.candidates[0].content.parts[0].text);
          continue;
        }
      } catch (e) {}
    }
  }
  if (sseChunks.length > 0) {
    return sseChunks.join("").trim();
  }

  let extracted = "";
  let idx = 0;
  while (idx < raw.length) {
    const startObj = raw.indexOf("{", idx);
    if (startObj === -1) break;

    let depth = 0;
    let endObj = -1;
    let inString = false;
    let escape = false;

    for (let i = startObj; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            endObj = i;
            break;
          }
        }
      }
    }

    if (endObj !== -1) {
      const jsonStr = raw.slice(startObj, endObj + 1);
      try {
        const obj = JSON.parse(jsonStr);
        if (obj.assistantResponseEvent?.content) {
          extracted += obj.assistantResponseEvent.content;
        } else if (obj.content && typeof obj.content === "string") {
          extracted += obj.content;
        } else if (obj.text && typeof obj.text === "string") {
          extracted += obj.text;
        } else if (obj.delta?.content) {
          extracted += obj.delta.content;
        } else if (obj.delta?.text) {
          extracted += obj.delta.text;
        } else if (obj.choices?.[0]?.delta?.content) {
          extracted += obj.choices[0].delta.content;
        } else if (obj.choices?.[0]?.message?.content) {
          extracted += obj.choices[0].message.content;
        } else if (obj.candidates?.[0]?.content?.parts?.[0]?.text) {
          extracted += obj.candidates[0].content.parts[0].text;
        } else if (obj.response && typeof obj.response === "string") {
          extracted += obj.response;
        } else if (obj.message && typeof obj.message === "string") {
          extracted += obj.message;
        }
      } catch (e) {}
      idx = endObj + 1;
    } else {
      idx = startObj + 1;
    }
  }

  if (extracted.trim().length > 0) return extracted.trim();

  try {
    const obj = JSON.parse(raw);
    const text =
      obj.assistantResponseEvent?.content ||
      obj.choices?.[0]?.message?.content ||
      obj.choices?.[0]?.delta?.content ||
      obj.candidates?.[0]?.content?.parts?.[0]?.text ||
      obj.response ||
      obj.content ||
      obj.text;
    if (typeof text === "string" && text.trim().length > 0) return text.trim();
  } catch (e) {}

  let clean = raw
    .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
    .replace(/:event-type\s*\w+/gi, "")
    .replace(/:content-type\s*[\w\/-]+/gi, "")
    .replace(/:message-type\s*\w+/gi, "")
    .replace(/assistantResponseEvent/gi, "")
    .replace(/\{"modelId":[^}]+\}/g, "")
    .replace(/\{"conversationId":[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return clean || raw;
};

export default function ThreatTracking() {
  const [incidents, setIncidents] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [threatFilter, setThreatFilter] = useState("ALL");
  const [collapsedCaseIds, setCollapsedCaseIds] = useState(new Set());
  const [dossierCaseSearch, setDossierCaseSearch] = useState("");
  const [dossierPlatformFilter, setDossierPlatformFilter] = useState("ALL");
  const [dossierActionFilter, setDossierActionFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState(null);

  const wsRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchLiveData = async () => {
    try {
      const auditRes = await fetch(`${API_BASE}/api/vantix/audit-logs?limit=500`);
      if (auditRes.ok) {
        const auditJson = await auditRes.json();
        if (auditJson.success && Array.isArray(auditJson.logs)) {
          const formatted = auditJson.logs.map((log) => {
            const uid = log.userId || log.user || "employee";
            const rawPrompt = log.originalPrompt || log.promptSnippet || "Outbound prompt intercepted";
            const rawSanitized = log.sanitizedPrompt || "[SANITIZED]";
            const rawAiResponse = log.restoredResponse || "";

            return {
              id: log.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              userId: uid,
              userName: log.userName || uid.charAt(0).toUpperCase() + uid.slice(1).replace(/[._]/g, " "),
              userEmail: log.userEmail || `${uid}@acme.corp`,
              department: log.department || "Cloud Engineering & AI Platform",
              endpointHost: log.endpointHost || log.host || `${uid}-workstation`,
              endpointIp: log.endpointIp || "127.0.0.1",
              aiPlatform: log.aiPlatform || "chatgpt.com",
              actionTaken: log.actionTaken || (log.riskScore >= 70 ? "hard_block" : log.riskScore >= 30 ? "silent_redact" : "pass"),
              riskScore: log.riskScore !== undefined ? log.riskScore : 0,
              categoriesRedacted: log.categoriesRedacted || ["CONFIDENTIAL_DATA"],
              detections: log.detections || [],
              originalPrompt: cleanPromptText(rawPrompt),
              sanitizedPrompt: cleanPromptText(rawSanitized),
              restoredResponse: cleanAiResponseText(rawAiResponse),
              cryptoSignature: log.cryptoSignature || "",
              timestamp: log.timestamp || new Date().toISOString(),
            };
          });
          setIncidents(formatted);
        }
      }
    } catch (err) {
      console.error("Error fetching threat telemetry:", err);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 8000);

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
                  restoredResponse: inc.restoredResponse || "",
                  cryptoSignature: inc.cryptoSignature || "",
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

  // Filtered cases for the active Flagged Identity (supports search across any number of cases)
  const filteredDossierCases = useMemo(() => {
    if (!selectedEmployee || !selectedEmployee.incidentsList) return [];
    return selectedEmployee.incidentsList.filter((c) => {
      const promptText = `${c.originalPrompt || ""} ${c.sanitizedPrompt || ""} ${c.restoredResponse || ""}`.toLowerCase();
      const cats = (c.categoriesRedacted || []).join(" ").toLowerCase();
      const plat = (c.aiPlatform || "").toLowerCase();

      const q = dossierCaseSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        promptText.includes(q) ||
        cats.includes(q) ||
        plat.includes(q) ||
        (c.id && c.id.toLowerCase().includes(q));

      const matchesPlatform =
        dossierPlatformFilter === "ALL" ||
        plat.includes(dossierPlatformFilter.toLowerCase());

      const matchesAction =
        dossierActionFilter === "ALL" ||
        (dossierActionFilter === "hard_block" && c.actionTaken === "hard_block") ||
        (dossierActionFilter === "silent_redact" && c.actionTaken !== "hard_block");

      return matchesSearch && matchesPlatform && matchesAction;
    });
  }, [selectedEmployee, dossierCaseSearch, dossierPlatformFilter, dossierActionFilter]);

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
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--apple-text-main)", margin: 0, letterSpacing: "-0.02em" }}>
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
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-main)" }}>Flagged Identities</span>
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
                        <span style={{ fontWeight: 600, color: "var(--apple-text-main)" }}>{emp.name}</span>
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
                    <td style={{ fontSize: 13, fontWeight: 600, color: "var(--apple-text-main)" }}>
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
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--apple-text-main)", margin: 0 }}>{selectedEmployee.name}</h2>
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
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--apple-text-main)" }}>{selectedEmployee.totalAttempts}</div>
                <div style={{ fontSize: 11, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Exfiltrations</div>
              </div>
            </div>
          </div>

          {/* 2 Graphs: Risk Timeline & Category Distribution */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
            <div className="apple-card">
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-main)", marginBottom: 16 }}>Risk Progression Timeline</div>
              <div style={{ height: 210, width: "100%" }}>
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
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--apple-text-main)", marginBottom: 16 }}>Targeted Confidential Categories</div>
              <div style={{ height: 210, width: "100%" }}>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={categoryChartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={65}
                        stroke="#0d0e12"
                        strokeWidth={1.5}
                        label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : "")}
                        labelLine={false}
                      >
                        {categoryChartData.map((entry, index) => (
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
                        formatter={(value, name) => [`${value} detections`, name]}
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
                    No confidential categories targeted
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chronological Prompt Forensics Log */}
          <div className="apple-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Terminal size={16} color="#ff0055" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--apple-text-main)" }}>
                  All Recorded Cases for {selectedEmployee.name} ({selectedEmployee.incidentsList.length} Total)
                </span>
                <span className="apple-pill rose" style={{ fontSize: 11, fontWeight: 700 }}>
                  Showing {filteredDossierCases.length} of {selectedEmployee.incidentsList.length}
                </span>
              </div>

              {/* Case Controls: Expand/Collapse All */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="apple-btn"
                  style={{ padding: "4px 10px", fontSize: 11 }}
                  onClick={() => {
                    if (collapsedCaseIds.size === 0) {
                      const allIds = new Set(selectedEmployee.incidentsList.map((c, i) => c.id || i));
                      setCollapsedCaseIds(allIds);
                    } else {
                      setCollapsedCaseIds(new Set());
                    }
                  }}
                >
                  {collapsedCaseIds.size === 0 ? "Collapse All" : "Expand All"}
                </button>
              </div>
            </div>

            {/* Dossier Case Filters Bar */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--apple-border)",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {/* Search inside this person's cases */}
              <div style={{ position: "relative", flex: "1 1 200px" }}>
                <Search size={13} color="#71717a" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search within this person's cases (prompt, token, category)..."
                  className="apple-input"
                  style={{ paddingLeft: 30, width: "100%", height: 32, fontSize: 11.5 }}
                  value={dossierCaseSearch}
                  onChange={(e) => setDossierCaseSearch(e.target.value)}
                />
              </div>

              {/* Filter by Platform */}
              <select
                className="apple-input"
                style={{ width: 150, height: 32, fontSize: 11.5 }}
                value={dossierPlatformFilter}
                onChange={(e) => setDossierPlatformFilter(e.target.value)}
              >
                <option value="ALL">All AI Platforms</option>
                <option value="antigravity">Antigravity (Gemini)</option>
                <option value="kiro">Kiro (Amazon Q)</option>
                <option value="cursor">Cursor AI</option>
                <option value="windsurf">Windsurf AI</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
              </select>

              {/* Filter by Action */}
              <select
                className="apple-input"
                style={{ width: 140, height: 32, fontSize: 11.5 }}
                value={dossierActionFilter}
                onChange={(e) => setDossierActionFilter(e.target.value)}
              >
                <option value="ALL">All Actions</option>
                <option value="hard_block">Hard Blocked</option>
                <option value="silent_redact">Silent Redacted</option>
              </select>

              {(dossierCaseSearch || dossierPlatformFilter !== "ALL" || dossierActionFilter !== "ALL") && (
                <button
                  className="apple-btn"
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => {
                    setDossierCaseSearch("");
                    setDossierPlatformFilter("ALL");
                    setDossierActionFilter("ALL");
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Chronological List of Cases */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filteredDossierCases.map((inc, idx) => {
                const caseKey = inc.id || idx;
                const isCollapsed = collapsedCaseIds.has(caseKey);
                const isBlocked = inc.actionTaken === "hard_block";

                const toggleCase = () => {
                  setCollapsedCaseIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(caseKey)) next.delete(caseKey);
                    else next.add(caseKey);
                    return next;
                  });
                };

                return (
                  <div
                    key={caseKey}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${isBlocked ? "rgba(255, 0, 85, 0.3)" : "rgba(225, 29, 72, 0.2)"}`,
                      borderLeft: `4px solid ${isBlocked ? "#ff0055" : "#e11d48"}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    {/* Case Header Banner */}
                    <div
                      style={{
                        padding: "12px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        background: "rgba(255, 255, 255, 0.015)",
                      }}
                      onClick={toggleCase}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#ffffff" }}>
                          Case #{selectedEmployee.incidentsList.length - idx}
                        </span>
                        {renderAiPlatformBadge(inc.aiPlatform)}
                        <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                          {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 12, color: inc.riskScore >= 70 ? "#ff0055" : "#f59e0b" }}>
                          Risk: {inc.riskScore}/100
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, color: "var(--apple-text-muted)" }}>
                          {new Date(inc.timestamp).toLocaleString()}
                        </span>
                        <ChevronRight
                          size={16}
                          color="#a1a1aa"
                          style={{ transform: !isCollapsed ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
                        />
                      </div>
                    </div>

                    {/* Case Forensic Body */}
                    {!isCollapsed && (
                      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--apple-border)" }}>
                        {/* Categories Tag Strip */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {(inc.categoriesRedacted || ["SENSITIVE_DATA"]).map((cat, catIdx) => (
                            <span
                              key={catIdx}
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "rgba(255, 0, 85, 0.12)",
                                color: "#ff0055",
                                border: "1px solid rgba(255, 0, 85, 0.25)",
                              }}
                            >
                              [{cat.replace(/_/g, " ").toUpperCase()}]
                            </span>
                          ))}
                        </div>

                        {/* 3-Pane Forensic Inspection Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                          {/* Original Intercepted Prompt */}
                          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, border: "1px solid rgba(255, 0, 85, 0.2)" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#ff0055", textTransform: "uppercase", marginBottom: 6 }}>
                              1. Original Intercepted Prompt (Plaintext Secret Attempt)
                            </div>
                            <pre style={{ fontSize: 11.5, color: "#fca5a5", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.45, maxHeight: 180, overflowY: "auto" }}>
                              {inc.originalPrompt || "No prompt captured"}
                            </pre>
                          </div>

                          {/* Sanitized Outbound Prompt */}
                          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
                              2. Sanitized Outbound Payload (Sent to AI)
                            </div>
                            <pre style={{ fontSize: 11.5, color: "#7dd3fc", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.45, maxHeight: 180, overflowY: "auto" }}>
                              {inc.sanitizedPrompt || "[SANITIZED]"}
                            </pre>
                          </div>

                          {/* Restored AI Response / Block Enforcement */}
                          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: 6 }}>
                              3. AI Response / Enforcement Action
                            </div>
                            <pre style={{ fontSize: 11.5, color: "#6ee7b7", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.45, maxHeight: 180, overflowY: "auto" }}>
                              {inc.restoredResponse || (isBlocked ? "🚫 Outbound transmission hard-blocked by Vantix Firewall." : "✓ Sanitized response passed seamlessly.")}
                            </pre>
                          </div>
                        </div>

                        {/* Cryptographic Signature */}
                        {inc.cryptoSignature && (
                          <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--apple-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Shield size={12} color="#10b981" />
                            <span>HMAC-SHA256 Audit Signature: <code style={{ color: "#a1a1aa" }}>{inc.cryptoSignature}</code></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredDossierCases.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid var(--apple-border)", color: "var(--apple-text-muted)", fontSize: 12.5 }}>
                  No cases match search or filter criteria. Clear filters to view all {selectedEmployee.incidentsList.length} cases.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
