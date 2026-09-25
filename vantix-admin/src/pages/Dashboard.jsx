import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  User,
  Users,
  Search,
  ArrowLeft,
  ExternalLink,
  Activity,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Download,
  RefreshCw,
  Play,
  Filter,
  Terminal,
  Server,
  Lock,
  Eye,
  ChevronRight,
  Sparkles,
  Layers,
  Globe,
  ShieldCheck,
  Zap,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import "./Dashboard.css";

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

// Dynamic incident stream (starts empty)
const INITIAL_SEED_INCIDENTS = [];


const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

// ── Helpers for Enterprise AI Platform Badges & Timestamps ────────────────────
const renderAiPlatformBadge = (platform, count = null) => {
  const p = (platform || "").toLowerCase();
  let badgeClass = "default";
  let displayName = platform || "External AI";
  let domainName = platform || "unknown";

  if (p.includes("kiro") || p.includes("amazonaws.com") || p.includes("amazon q") || p.includes("codewhisperer")) {
    badgeClass = "kiro";
    displayName = "Kiro (Amazon Q)";
    domainName = "q.us-east-1.amazonaws.com";
  } else if (p.includes("cursor")) {
    badgeClass = "cursor";
    displayName = "Cursor AI";
    domainName = "cursor.com";
  } else if (p.includes("windsurf") || p.includes("codeium")) {
    badgeClass = "windsurf";
    displayName = "Windsurf AI";
    domainName = "codeium.com";
  } else if (p.includes("github") || p.includes("copilot")) {
    badgeClass = "copilot";
    displayName = "GitHub Copilot";
    domainName = "githubcopilot.com";
  } else if (p.includes("chatgpt")) {
    badgeClass = "chatgpt";
    displayName = "ChatGPT";
    domainName = "chatgpt.com";
  } else if (p.includes("claude") || p.includes("anthropic")) {
    badgeClass = "claude";
    displayName = "Claude";
    domainName = "claude.ai";
  } else if (p.includes("gemini")) {
    badgeClass = "gemini";
    displayName = "Gemini";
    domainName = "gemini.google.com";
  } else if (p.includes("api.openai") || p.includes("openai api") || p.includes("groq")) {
    badgeClass = "api";
    displayName = "AI API Gateway";
    domainName = "api.openai.com";
  } else if (p.includes("deepseek")) {
    badgeClass = "deepseek";
    displayName = "DeepSeek";
    domainName = "deepseek.com";
  }

  return (
    <span className={`ai-site-badge ${badgeClass}`}>
      <span className="ai-site-dot" />
      <span className="ai-site-name">{displayName}</span>
      <span className="ai-site-domain">({domainName})</span>
      {count !== null && count !== undefined && (
        <span className="ai-site-count">{count} {count === 1 ? "attempt" : "attempts"}</span>
      )}
    </span>
  );
};

const formatIncidentTimestamp = (ts) => {
  if (!ts) return { full: "Unknown Timestamp", relative: "" };
  const d = new Date(ts);
  const full =
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " • " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) +
    " UTC";

  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  let relative = "";
  if (diffMins < 1) relative = "Just now";
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else {
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) relative = `${diffHours}h ago`;
    else relative = `${Math.floor(diffHours / 24)}d ago`;
  }

  return { full, relative };
};

const cleanPromptText = (text) => {
  if (!text || typeof text !== "string") return "";
  let clean = text;

  // 1. Remove XML/HTML-style IDE context wrappers (<tag>...</tag> or <tag>...)
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

  // 2. Remove markdown code blocks with system context
  clean = clean.replace(/```(?:system_information|environment|context)[\s\S]*?```/gi, "");

  // 3. Remove leading/trailing formatting
  clean = clean.replace(/^User(?:\s+Query|\s+Question|\s+Prompt)?:\s*/i, "");

  return clean.trim() || text.trim();
};

const cleanAiResponseText = (raw) => {
  if (!raw || typeof raw !== "string") return "";

  // 1. Check for SSE format ("data: {...}") - OpenAI / Groq / Ollama / DeepSeek / Claude
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

  // 2. Extract JSON objects from EventStream or concatenated JSON chunks (Kiro / AWS Bedrock)
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
      } catch (e) {
        const mContent = jsonStr.match(/"content":\s*"((?:[^"\\]|\\.)*)"/);
        if (mContent) {
          try { extracted += JSON.parse(`"${mContent[1]}"`); } catch (e2) { extracted += mContent[1]; }
        } else {
          const mText = jsonStr.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
          if (mText) {
            try { extracted += JSON.parse(`"${mText[1]}"`); } catch (e3) { extracted += mText[1]; }
          }
        }
      }
      idx = endObj + 1;
    } else {
      idx = startObj + 1;
    }
  }

  if (extracted.trim().length > 0) {
    return extracted.trim();
  }

  // 3. Fallback: Parse whole string as single JSON if applicable
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

  // 4. Fallback: Strip EventStream binary / metadata artifacts
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

export default function Dashboard() {
  // ── Real-Time Incidents State ──────────────────────────────────────────────
  const [incidents, setIncidents] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [threatFilter, setThreatFilter] = useState("ALL"); // ALL, CRITICAL, HIGH, MEDIUM
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState(null);

  // Simulation Modal State
  const [showSimModal, setShowSimModal] = useState(false);
  const [simEmployee, setSimEmployee] = useState("employee");
  const [simLeakType, setSimLeakType] = useState("aws_keys");
  const [simCustomPrompt, setSimCustomPrompt] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const wsRef = useRef(null);

  // ── Show Temporary Banner Alert ────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Fetch Initial Live Data from Backend ───────────────────────────────────
  const fetchLiveData = async () => {
    try {
      // Check flagged-employees first
      const empRes = await fetch(`${API_BASE}/api/vantix/flagged-employees`);
      if (empRes.ok) {
        const json = await empRes.json();
        if (json.success && json.employees && json.employees.length > 0) {
          // Sync with backend records
        }
      }

      // Check audit logs
      const auditRes = await fetch(`${API_BASE}/api/vantix/audit-logs`);
      if (auditRes.ok) {
        const auditJson = await auditRes.json();
        if (auditJson.success && Array.isArray(auditJson.logs) && auditJson.logs.length > 0) {
          // Normalize and merge with in-memory incidents
          setIncidents((prev) => {
            const merged = [...prev];
            auditJson.logs.forEach((log) => {
              if (log.userId && !merged.some((m) => m.id === log.id || (m.timestamp === log.timestamp && m.userId === log.userId))) {
                merged.unshift({
                  id: log.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  userId: log.userId,
                  userName: log.userName || log.userId.charAt(0).toUpperCase() + log.userId.slice(1).replace(/[._]/g, " "),
                  userEmail: log.userEmail || `${log.userId}@acme.corp`,
                  department: log.department || (log.userId.includes("chen") ? "Cloud Infrastructure & DevOps" : "Core Systems"),
                  endpointHost: log.endpointHost || log.host || `${log.userId}-workstation`,
                  endpointIp: log.endpointIp || "127.0.0.1",
                  aiPlatform: log.aiPlatform || "chatgpt.com",
                  actionTaken: log.actionTaken || (log.riskScore >= 90 ? "hard_block" : log.riskScore >= 20 ? "silent_redact" : "pass"),
                  riskScore: log.riskScore !== undefined ? log.riskScore : 0,
                  categoriesRedacted: log.categoriesRedacted || ["CONFIDENTIAL_DATA"],
                  detections: log.detections || [],
                  originalPrompt: log.originalPrompt || log.promptSnippet || "Outbound prompt intercepted",
                  sanitizedPrompt: log.sanitizedPrompt || "[SANITIZED]",
                  restoredResponse: log.restoredResponse || "Safely processed response.",
                  cryptoSignature: log.cryptoSignature || "HMAC-SHA256-VERIFIED",
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

  // ── Establish WebSocket Connection ─────────────────────────────────────────
  useEffect(() => {
    fetchLiveData();

    const wsUrl = getWsUrl();
    let socket = null;

    function connect() {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
          console.log("[Vantix Admin] Connected to live security telemetry stream");
        };

        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(event.data);
            if (packet.type === "detection" || packet.originalPrompt) {
              const incomingIncident = {
                id: packet.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                userId: packet.user || "employee",
                userName: packet.userName || (packet.user ? packet.user.charAt(0).toUpperCase() + packet.user.slice(1).replace(/[._]/g, " ") : "Employee"),
                userEmail: packet.userEmail || `${packet.user || "employee"}@acme.corp`,
                department: packet.department || "Core Systems",
                endpointHost: packet.host || "workstation",
                endpointIp: packet.endpointIp || "127.0.0.1",
                aiPlatform: packet.aiPlatform || "chatgpt.com",
                actionTaken: packet.actionTaken || (packet.riskScore >= 90 ? "hard_block" : packet.riskScore >= 20 ? "silent_redact" : "pass"),
                riskScore: packet.riskScore !== undefined ? packet.riskScore : 0,
                categoriesRedacted: packet.detections ? Array.from(new Set(packet.detections.map((d) => d.category))) : (packet.categoriesRedacted || ["CONFIDENTIAL_DATA"]),
                detections: packet.detections || [],
                originalPrompt: packet.originalPrompt || "Outbound prompt intercepted",
                sanitizedPrompt: packet.sanitizedPrompt || "[SANITIZED]",
                restoredResponse: packet.restoredResponse || "Response delivered.",
                cryptoSignature: packet.signature || "HMAC-SHA256-VERIFIED",
                timestamp: packet.timestamp || new Date().toISOString(),
              };

              setIncidents((prev) => [incomingIncident, ...prev]);

              // Show clear toast notification for security events
              const isSensitive = incomingIncident.riskScore >= 20 || incomingIncident.actionTaken === "hard_block" || incomingIncident.actionTaken === "silent_redact" || (incomingIncident.detections && incomingIncident.detections.length > 0);
              if (isSensitive) {
                if (incomingIncident.actionTaken === "hard_block") {
                  showToast(`🚫 CRITICAL BLOCK: Outbound transmission halted from ${incomingIncident.userName} (${incomingIncident.aiPlatform || "AI"})`);
                } else {
                  const tokenCount = incomingIncident.detections?.length || 1;
                  showToast(`🛡 SILENT REDACTION: ${tokenCount} sensitive secret${tokenCount > 1 ? "s" : ""} redacted seamlessly for ${incomingIncident.userName} (${incomingIncident.aiPlatform || "AI"})`);
                }
              } else {
                showToast(`✅ Clean prompt from ${incomingIncident.userName} passed inspection`);
              }
            } else if (packet.type === "reset") {
              setIncidents([]);
              showToast("Telemetry buffer reset to clean state.");
            }
          } catch (e) {
            console.error("Packet parse error:", e);
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          setTimeout(connect, 4000);
        };

        socket.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        console.warn("WebSocket init notice:", err);
      }
    }

    connect();

    // Periodic sync poll every 10 seconds
    const interval = setInterval(fetchLiveData, 10000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ── Dynamic Aggregation of Flagged Employees from Incident Stream ──────────
  const flaggedEmployees = useMemo(() => {
    const userMap = new Map();

    incidents.forEach((inc) => {
      // Track and flag if the employee attempted to leak sensitive data (credentials, PII, industrial)
      const isActualLeak = (inc.riskScore >= 20) || (inc.actionTaken === "hard_block") || (inc.actionTaken === "silent_redact") || (Array.isArray(inc.detections) && inc.detections.length > 0);
      if (!isActualLeak) {
        return; // Harmless clean prompt: skip
      }

      const key = (inc.userId || inc.userEmail || "unknown").toLowerCase();
      if (!userMap.has(key)) {
        userMap.set(key, {
          id: key,
          userId: inc.userId,
          name: inc.userName || key.charAt(0).toUpperCase() + key.slice(1).replace(/[._]/g, " "),
          email: inc.userEmail || `${key}@acme.corp`,
          department: inc.department || "Core Engineering",
          endpointHost: inc.endpointHost || "ws-node",
          endpointIp: inc.endpointIp || "127.0.0.1",
          totalAttempts: 0,
          hardBlockedCount: 0,
          redactedCount: 0,
          peakRiskScore: 0,
          categories: new Set(),
          lastAttempt: inc.timestamp,
        });
      }

      const entry = userMap.get(key);
      entry.totalAttempts++;
      if (inc.actionTaken === "hard_block") entry.hardBlockedCount++;
      if (inc.actionTaken === "silent_redact") entry.redactedCount++;
      if (inc.riskScore > entry.peakRiskScore) entry.peakRiskScore = inc.riskScore;

      if (new Date(inc.timestamp) >= new Date(entry.lastAttempt)) {
        entry.lastAttempt = inc.timestamp;
        if (inc.endpointHost) entry.endpointHost = inc.endpointHost;
        if (inc.endpointIp) entry.endpointIp = inc.endpointIp;
      }

      if (Array.isArray(inc.categoriesRedacted)) {
        inc.categoriesRedacted.forEach((c) => entry.categories.add(c.replace(/_/g, " ")));
      }
      if (Array.isArray(inc.detections)) {
        inc.detections.forEach((d) => {
          if (d.category) entry.categories.add(d.category.replace(/_/g, " "));
        });
      }
    });

    return Array.from(userMap.values())
      .filter((u) => u.totalAttempts > 0 && u.peakRiskScore >= 35)
      .map((u) => ({
        ...u,
        topCategories: Array.from(u.categories),
        threatLevel:
          u.peakRiskScore >= 85
            ? "CRITICAL"
            : u.peakRiskScore >= 60
            ? "HIGH"
            : "MEDIUM",
        status:
          u.hardBlockedCount > 0
            ? "Blocked"
            : u.redactedCount > 0
            ? "Active Redactions"
            : "Monitored",
      }))
      .sort((a, b) => b.peakRiskScore - a.peakRiskScore || b.totalAttempts - a.totalAttempts);
  }, [incidents]);

  // ── Filtered Employees for Table View ───────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return flaggedEmployees.filter((emp) => {
      const matchSearch =
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.endpointIp.includes(searchTerm) ||
        emp.endpointHost.toLowerCase().includes(searchTerm.toLowerCase());

      const matchThreat = threatFilter === "ALL" || emp.threatLevel === threatFilter;

      return matchSearch && matchThreat;
    });
  }, [flaggedEmployees, searchTerm, threatFilter]);

  // ── Selected Employee Dossier Data & Analytics ─────────────────────────────
  const currentEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return flaggedEmployees.find((e) => e.id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, flaggedEmployees]);

  const employeeIncidents = useMemo(() => {
    if (!selectedEmployeeId) return [];
    const list = incidents.filter(
      (inc) =>
        ((inc.userId && inc.userId.toLowerCase() === selectedEmployeeId.toLowerCase()) ||
        (inc.userEmail && inc.userEmail.toLowerCase().includes(selectedEmployeeId.toLowerCase()))) &&
        (inc.riskScore >= 30 || inc.actionTaken === "hard_block" || inc.actionTaken === "silent_redact" || (inc.detections && inc.detections.length > 0))
    );
    // Sort descending by timestamp so the latest cases are at the TOP
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [selectedEmployeeId, incidents]);

  // Graph 1: Category Distribution for Selected Employee
  const categoryChartData = useMemo(() => {
    if (employeeIncidents.length === 0) return [];
    const counts = {};
    employeeIncidents.forEach((inc) => {
      const cats =
        inc.categoriesRedacted && inc.categoriesRedacted.length > 0
          ? inc.categoriesRedacted
          : (inc.detections || []).map((d) => d.category);
      cats.forEach((c) => {
        const clean = c.replace(/_/g, " ");
        counts[clean] = (counts[clean] || 0) + 1;
      });
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [employeeIncidents]);

  // Graph 2: Risk Progression Timeline (Chronological Case #1 -> Case #N)
  const riskTimelineData = useMemo(() => {
    if (employeeIncidents.length === 0) return [];
    const chronological = [...employeeIncidents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return chronological.map((inc, idx) => ({
      attempt: `Case #${idx + 1}`,
      time: new Date(inc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      riskScore: inc.riskScore || 0,
      action: inc.actionTaken === "hard_block" ? "Blocked" : "Redacted",
      service: inc.aiPlatform || "chatgpt.com",
    }));
  }, [employeeIncidents]);

  // Targeted AI Platforms Visited by this Employee
  const employeeAiPlatforms = useMemo(() => {
    const counts = {};
    employeeIncidents.forEach((inc) => {
      const p = (inc.aiPlatform || "chatgpt.com").toLowerCase();
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).map(([platform, count]) => ({ platform, count }));
  }, [employeeIncidents]);

  // Graph 3: Enforcement Action Ratio
  const actionChartData = useMemo(() => {
    if (!currentEmployee) return [];
    const data = [
      { name: "Hard Blocked", value: currentEmployee.hardBlockedCount, fill: "#ef4444" },
      { name: "Redacted & Scrubbed", value: currentEmployee.redactedCount, fill: "#3b82f6" },
      {
        name: "Monitored / Passed",
        value: Math.max(0, currentEmployee.totalAttempts - currentEmployee.hardBlockedCount - currentEmployee.redactedCount),
        fill: "#10b981",
      },
    ].filter((d) => d.value > 0);
    return data;
  }, [currentEmployee]);

  // ── Executive KPI Totals (Dynamically Computed) ────────────────────────────
  const totalIntercepts = incidents.length;
  const totalBlocked = incidents.filter((i) => i.actionTaken === "hard_block").length;
  const totalRedacted = incidents.filter((i) => i.actionTaken === "silent_redact").length;
  const totalFlaggedCount = flaggedEmployees.length;

  // ── Global Executive Visual Intelligence (Company-Wide Overview) ───────────
  const globalCategoryChartData = useMemo(() => {
    const counts = {};
    incidents.forEach((inc) => {
      if (inc.riskScore >= 35 || inc.actionTaken === "hard_block") {
        const cats =
          inc.categoriesRedacted && inc.categoriesRedacted.length > 0
            ? inc.categoriesRedacted
            : (inc.detections || []).map((d) => d.category);
        cats.forEach((c) => {
          const clean = c.replace(/_/g, " ").toUpperCase();
          counts[clean] = (counts[clean] || 0) + 1;
        });
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [incidents]);

  const globalEnforcementData = useMemo(() => {
    const criticalCount = flaggedEmployees.filter((e) => e.peakRiskScore >= 80).length;
    const highCount = flaggedEmployees.filter((e) => e.peakRiskScore >= 50 && e.peakRiskScore < 80).length;
    const mediumCount = flaggedEmployees.filter((e) => e.peakRiskScore < 50).length;

    return [
      { name: "Hard Blocked", count: totalBlocked, fill: "#ef4444" },
      { name: "Redacted", count: totalRedacted, fill: "#38bdf8" },
      { name: "Critical Threats", count: criticalCount, fill: "#f43f5e" },
      { name: "Elevated Risk", count: highCount, fill: "#f59e0b" },
      { name: "Monitored", count: mediumCount, fill: "#10b981" },
    ];
  }, [flaggedEmployees, totalBlocked, totalRedacted]);

  // ── Trigger Live Leak Simulation ───────────────────────────────────────────
  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      let prompt = simCustomPrompt;
      if (!prompt) {
        if (simLeakType === "aws_keys") {
          prompt =
            'Review this AWS policy snippet: access_key_id = "AKIAIOSFODNN7EXAMPLE" and secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" for production S3 replication.';
        } else if (simLeakType === "scada_reg") {
          prompt =
            "Analyzing turbine Mark VIe register 0x4001 at internal substation 192.168.1.50 with nominal grid frequency 60.2 Hz. What triggers sudden emergency trip?";
        } else if (simLeakType === "patient_ssn") {
          prompt =
            "Summarize clinical diagnosis for patient Johnathan Doe, SSN: 123-45-6789, MRN #98421 with acute cardiac arrhythmia.";
        } else if (simLeakType === "credit_card") {
          prompt =
            'Verify charge webhook payload: { card: "4532-8812-9901-4321", cvv: "882", exp: "08/28", holder: "David R. Sterling" }';
        } else if (simLeakType === "benign_prompt") {
          prompt =
            "Explain how combined cycle gas turbines achieve high thermodynamic efficiency.";
        } else if (simLeakType === "sanitized_prompt") {
          prompt =
            "Investigating turbine [SCADA_REG_01] at internal substation [INTERNAL_IP_01] with nominal grid frequency [FREQUENCY_01]. What triggers sudden emergency trip?";
        } else {
          prompt =
            'Troubleshoot JWT token generation using master private secret: "jwt_secret_signing_key_prod_9942a" in our authorization middleware.';
        }
      }

      // Try simulation endpoint first
      const res = await fetch(`${API_BASE}/api/vantix/simulate-leak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: simEmployee,
          leakType: simLeakType,
          prompt,
        }),
      });

      // If simulate-leak route is 404, send via /chat directly
      if (!res.ok) {
        await fetch(`${API_BASE}/api/vantix/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-vantix-user": simEmployee,
            "x-vantix-host": `${simEmployee}-workstation`,
          },
          body: JSON.stringify({
            prompt,
            userId: simEmployee,
            userEmail: `${simEmployee}@acme.corp`,
          }),
        });
      }

      showToast(`Simulation executed for ${simEmployee}! Real-time telemetry broadcast.`);
      setShowSimModal(false);
      setSimCustomPrompt("");
      fetchLiveData();
    } catch (err) {
      console.error("Simulation error:", err);
      showToast("Error triggering simulation: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // ── Export Audit Log as JSON ───────────────────────────────────────────────
  const handleExportAudit = (targetIncidents = incidents, filename = "vantix-dlp-audit.json") => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetIncidents, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Audit trail exported to ${filename}`);
  };

  return (
    <div className="soc-container">
      {/* ─── Toast Notification Banner ──────────────────────────────────────── */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 24,
            zIndex: 99999,
            background: "rgba(17, 24, 39, 0.95)",
            border: "1px solid #4f46e5",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <Sparkles size={16} color="#818cf8" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── Top SOC Executive Navigation ──────────────────────────────────── */}
      <header className="soc-header">
        <div className="soc-header-left">
          <div className="soc-logo-badge">
            <Shield size={22} />
          </div>
          <div className="soc-title-group">
            <h1>
              VANTIX SECURITY OPERATIONS CENTER
              <span className="status-tag" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                ENTERPRISE DLP
              </span>
            </h1>
            <p>Real-Time AI Data Loss Prevention, Exfiltration Interception & Employee Risk Directory</p>
          </div>
        </div>

        <div className="soc-header-right">
          <button className="action-btn" onClick={() => setShowSimModal(true)} title="Simulate an employee exfiltration attempt in real time">
            <Play size={14} color="#818cf8" />
            <span>Simulate Exfiltration</span>
          </button>

          <button className="action-btn" onClick={() => handleExportAudit()} title="Export complete audit ledger as JSON">
            <Download size={14} />
            <span>Export Audit Log</span>
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: DIRECTORY OF FLAGGED EMPLOYEES (Default Primary Screen)
         ══════════════════════════════════════════════════════════════════════ */}
      {!selectedEmployeeId ? (
        <section>
          {/* Dynamic Top Metric Ribbon (Exclusively in Overview) */}
          <div className="soc-kpi-grid">
            <div className="kpi-metric-card critical">
              <div className="kpi-header">
                <span className="kpi-label">Flagged Employees</span>
                <div className="kpi-icon-wrap">
                  <Users size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-number">{totalFlaggedCount}</span>
              </div>
              <div className="kpi-subtext">Identities with detected leak attempts</div>
            </div>

            <div className="kpi-metric-card warning">
              <div className="kpi-header">
                <span className="kpi-label">Hard Blocked Leaks</span>
                <div className="kpi-icon-wrap">
                  <ShieldAlert size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-number">{totalBlocked}</span>
              </div>
              <div className="kpi-subtext">Critical credentials & secrets stopped cold</div>
            </div>

            <div className="kpi-metric-card blue">
              <div className="kpi-header">
                <span className="kpi-label">Redacted & Scrubbed</span>
                <div className="kpi-icon-wrap">
                  <Lock size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-number">{totalRedacted}</span>
              </div>
              <div className="kpi-subtext">PII, IP & config parameters tokenized</div>
            </div>

            <div className="kpi-metric-card safe">
              <div className="kpi-header">
                <span className="kpi-label">Total Inspected Requests</span>
                <div className="kpi-icon-wrap">
                  <Activity size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-number">{totalIntercepts}</span>
              </div>
              <div className="kpi-subtext">OS Network Proxy & Browser Guard</div>
            </div>
          </div>

          {/* Executive Threat Intelligence Visuals (Vidals) */}
          <div className="soc-overview-visuals-grid">
            {/* Visual Card 1: Enterprise Data Exfiltration Vectors */}
            <div className="overview-visual-card">
              <div className="overview-visual-header">
                <div>
                  <div className="overview-visual-title">
                    <Database size={17} color="#f43f5e" />
                    <span>Company-Wide Exfiltration Vectors</span>
                  </div>
                  <div className="overview-visual-subtitle">
                    Distribution of sensitive data classes detected in unauthorized AI prompts
                  </div>
                </div>
                <span className="visual-metric-badge">
                  {globalCategoryChartData.length} Target Classes
                </span>
              </div>

              <div style={{ height: 210, width: "100%" }}>
                {globalCategoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={globalCategoryChartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {globalCategoryChartData.map((entry, index) => (
                          <Cell
                            key={`global-cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#111827",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 12,
                          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(val, name) => [`${val} attempts`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--soc-text-dim)", fontSize: 13 }}>
                    No corporate exfiltration vectors detected yet
                  </div>
                )}
              </div>

              {/* Dynamic Category Chips Legend */}
              <div className="visual-category-legend">
                {globalCategoryChartData.slice(0, 5).map((cat, idx) => (
                  <div key={idx} className="visual-legend-chip">
                    <span
                      className="visual-legend-dot"
                      style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span>{cat.name}</span>
                    <span className="visual-legend-count">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Card 2: Security Policy Enforcement & Severity Ratio */}
            <div className="overview-visual-card">
              <div className="overview-visual-header">
                <div>
                  <div className="overview-visual-title">
                    <ShieldAlert size={17} color="#38bdf8" />
                    <span>Firewall Enforcement & Severity Profile</span>
                  </div>
                  <div className="overview-visual-subtitle">
                    Live system-wide action breakdown across OS proxy and browser filters
                  </div>
                </div>
                <span className="visual-metric-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                  {totalIntercepts} Events Inspected
                </span>
              </div>

              <div style={{ height: 210, width: "100%", marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={globalEnforcementData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#6b7280" fontSize={11} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#9ca3af"
                      fontSize={11.5}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(val) => [`${val} occurrences`, "Count"]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                      {globalEnforcementData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Enforcement summary note */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--soc-text-muted)", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span>Hard Block Rate: <strong style={{ color: "#ef4444" }}>{totalIntercepts > 0 ? Math.round((totalBlocked / totalIntercepts) * 100) : 0}%</strong></span>
                <span>Silent Redaction Rate: <strong style={{ color: "#38bdf8" }}>{totalIntercepts > 0 ? Math.round((totalRedacted / totalIntercepts) * 100) : 0}%</strong></span>
                <span>Active Endpoints: <strong style={{ color: "#34d399" }}>{flaggedEmployees.length} Monitored</strong></span>
              </div>
            </div>
          </div>

          {/* Guidance Banner */}
          <div className="soc-guidance-banner">
            <Sparkles size={18} color="#818cf8" style={{ flexShrink: 0 }} />
            <span>
              <strong>Incident Directory:</strong> Click on any flagged employee below to inspect their full forensics dossier, raw sanitized prompts, cryptographic audit hashes, and timeline charts.
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="soc-controls-bar">
            <div className="search-input-wrap">
              <Search size={16} color="#9ca3af" />
              <input
                type="text"
                placeholder="Search employees by name, email, department, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-pills-group">
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--soc-text-dim)", textTransform: "uppercase" }}>
                Filter Threat:
              </span>
              <button
                className={`filter-pill-btn ${threatFilter === "ALL" ? "active" : ""}`}
                onClick={() => setThreatFilter("ALL")}
              >
                All ({flaggedEmployees.length})
              </button>
              <button
                className={`filter-pill-btn critical ${threatFilter === "CRITICAL" ? "active critical" : ""}`}
                onClick={() => setThreatFilter("CRITICAL")}
              >
                Critical (≥80)
              </button>
              <button
                className={`filter-pill-btn ${threatFilter === "HIGH" ? "active" : ""}`}
                onClick={() => setThreatFilter("HIGH")}
              >
                High (≥50)
              </button>
              <button
                className={`filter-pill-btn ${threatFilter === "MEDIUM" ? "active" : ""}`}
                onClick={() => setThreatFilter("MEDIUM")}
              >
                Medium (≥25)
              </button>
            </div>
          </div>

          {/* Flagged Employees Table */}
          <div className="soc-table-card">
            <div className="soc-table-header-row">
              <div className="soc-table-header-title">
                <ShieldAlert size={18} color="#f87171" />
                <span>Employees Triggering Security Policies</span>
                <span className="soc-badge-counter">{filteredEmployees.length} EMPLOYEES</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--soc-text-dim)" }}>
                Click any row to inspect confidential exfiltration details
              </div>
            </div>

            <div className="soc-table-responsive">
              <table className="soc-employees-table">
                <thead>
                  <tr>
                    <th>EMPLOYEE / IDENTITY</th>
                    <th>ENDPOINT & HOST</th>
                    <th>VIOLATION SUMMARY</th>
                    <th>DETECTED LEAK CATEGORIES</th>
                    <th>PEAK RISK</th>
                    <th>LAST ATTEMPT</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--soc-text-dim)" }}>
                        No flagged employees matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const avatarInitials = emp.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const avatarClass =
                        emp.threatLevel === "CRITICAL"
                          ? "critical"
                          : emp.threatLevel === "HIGH"
                          ? "high"
                          : "medium";

                      return (
                        <tr
                          key={emp.id}
                          className="employee-row"
                          onClick={() => setSelectedEmployeeId(emp.id)}
                        >
                          {/* Employee Identity */}
                          <td>
                            <div className="employee-profile-cell">
                              <div className={`employee-avatar ${avatarClass}`}>{avatarInitials}</div>
                              <div className="employee-name-meta">
                                <span className="employee-name">{emp.name}</span>
                                <span className="employee-email">{emp.email}</span>
                                <span className="dept-pill">{emp.department}</span>
                              </div>
                            </div>
                          </td>

                          {/* Endpoint */}
                          <td>
                            <div className="endpoint-cell">
                              <span className="endpoint-host">{emp.endpointHost}</span>
                              <span className="endpoint-ip">{emp.endpointIp}</span>
                            </div>
                          </td>

                          {/* Violations Count */}
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontWeight: 700, color: "#fff" }}>
                                {emp.totalAttempts} total leak {emp.totalAttempts === 1 ? "attempt" : "attempts"}
                              </span>
                              <div style={{ display: "flex", gap: 6 }}>
                                {emp.hardBlockedCount > 0 && (
                                  <span className="status-tag blocked">{emp.hardBlockedCount} Blocked</span>
                                )}
                                {emp.redactedCount > 0 && (
                                  <span className="status-tag redacted">{emp.redactedCount} Redacted</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Categories */}
                          <td>
                            <div className="leak-chips-container">
                              {emp.topCategories.slice(0, 3).map((cat, cIdx) => (
                                <span key={cIdx} className="leak-chip">
                                  {cat}
                                </span>
                              ))}
                              {emp.topCategories.length > 3 && (
                                <span className="leak-chip" style={{ background: "rgba(255,255,255,0.05)", color: "var(--soc-text-muted)" }}>
                                  +{emp.topCategories.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Peak Risk */}
                          <td>
                            <div
                              className={`threat-score-pill ${
                                emp.threatLevel === "CRITICAL"
                                  ? "critical"
                                  : emp.threatLevel === "HIGH"
                                  ? "high"
                                  : "medium"
                              }`}
                            >
                              <span>{emp.peakRiskScore}</span>
                              <span style={{ fontSize: 10, opacity: 0.8 }}>/ 100</span>
                              <span style={{ fontSize: 10, textTransform: "uppercase", marginLeft: 4 }}>
                                {emp.threatLevel}
                              </span>
                            </div>
                          </td>

                          {/* Last Attempt */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--soc-text-muted)", fontSize: 12 }}>
                              <Clock size={13} />
                              <span>{new Date(emp.lastAttempt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </td>

                          {/* Action Button */}
                          <td>
                            <button
                              className="inspect-link-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmployeeId(emp.id);
                              }}
                            >
                              <span>Inspect Dossier</span>
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════
            VIEW 2: DRILL-DOWN DOSSIER FOR SELECTED EMPLOYEE
           ══════════════════════════════════════════════════════════════════════ */
        <section>
          {/* Top Navigation Bar: Unmissable Return to Overview + Quick Employee Switcher */}
          <div className="dossier-top-nav-bar">
            <button
              className="dossier-back-to-overview-btn"
              onClick={() => setSelectedEmployeeId(null)}
              id="back-to-soc-overview-btn"
            >
              <ArrowLeft size={18} />
              <span>← Back to Overview & All Employees</span>
              <span className="directory-count-tag">{flaggedEmployees.length} Flagged</span>
            </button>

            {/* Quick Switch Employee Pills */}
            <div className="dossier-quick-switcher">
              <span className="switcher-label">Quick Switch:</span>
              <div className="switcher-pills-list">
                {flaggedEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    className={`switcher-pill-btn ${emp.id === selectedEmployeeId ? "active" : ""}`}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                  >
                    <span
                      className="switcher-dot"
                      style={{
                        background:
                          emp.threatLevel === "CRITICAL"
                            ? "#ef4444"
                            : emp.threatLevel === "HIGH"
                            ? "#f59e0b"
                            : "#38bdf8",
                      }}
                    />
                    <span className="switcher-name">{emp.name}</span>
                    <span className="switcher-score">{emp.peakRiskScore}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {currentEmployee && (
            <>
              {/* Employee Dossier Header Card */}
              <div className="employee-dossier-profile-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 20 }}>
                  <div className="dossier-identity">
                    <div
                      className="dossier-avatar-large"
                      style={{
                        background:
                          currentEmployee.threatLevel === "CRITICAL"
                            ? "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)"
                            : currentEmployee.threatLevel === "HIGH"
                            ? "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)"
                            : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      }}
                    >
                      {currentEmployee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="dossier-details">
                      <h2>{currentEmployee.name}</h2>
                      <div className="dossier-meta-row">
                        <span>{currentEmployee.email}</span>
                        <span>•</span>
                        <span>{currentEmployee.department}</span>
                        <span>•</span>
                        <span style={{ fontFamily: "monospace", color: "#93c5fd" }}>
                          {currentEmployee.endpointHost} ({currentEmployee.endpointIp})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="dossier-kpi-group">
                    <div className="dossier-kpi-item">
                      <span className="val" style={{ color: currentEmployee.threatLevel === "CRITICAL" ? "#ef4444" : "#f59e0b" }}>
                        {currentEmployee.peakRiskScore}/100
                      </span>
                      <span className="lbl">Peak Risk Level</span>
                    </div>
                    <div className="dossier-kpi-item">
                      <span className="val">{currentEmployee.totalAttempts}</span>
                      <span className="lbl">Total Exfiltration Attempts</span>
                    </div>
                    <div className="dossier-kpi-item">
                      <span className="val" style={{ color: "#f87171" }}>{currentEmployee.hardBlockedCount}</span>
                      <span className="lbl">Hard Blocked</span>
                    </div>
                    <div className="dossier-kpi-item">
                      <span className="val" style={{ color: "#60a5fa" }}>{currentEmployee.redactedCount}</span>
                      <span className="lbl">Silent Redacted</span>
                    </div>

                    <button
                      className="action-btn"
                      onClick={() => handleExportAudit(employeeIncidents, `dossier-${currentEmployee.userId}.json`)}
                    >
                      <Download size={14} />
                      <span>Export Dossier</span>
                    </button>
                  </div>
                </div>

                {/* Target AI Services Visited Summary Strip */}
                <div className="employee-targeted-ai-strip" style={{ width: "100%", marginTop: 16 }}>
                  <span className="targeted-ai-title">
                    <Globe size={14} color="#38bdf8" />
                    <span>Targeted AI Platforms:</span>
                  </span>
                  {employeeAiPlatforms.map(({ platform, count }) => (
                    <React.Fragment key={platform}>
                      {renderAiPlatformBadge(platform, count)}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Clean 2-Column Visualizations (Spacious, Legible, No Mesh) */}
              <div className="dossier-charts-2col">
                {/* Chart 1: Leak Categories Breakdown */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <ShieldAlert size={16} color="#f87171" />
                    <span>Exfiltrated Confidential Data Categories</span>
                  </div>
                  <div className="chart-card-subtitle">
                    Classification of corporate assets this employee attempted to transmit
                  </div>
                  <div className="chart-canvas-wrap">
                    {categoryChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={4}
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                            itemStyle={{ color: "#fff" }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--soc-text-dim)" }}>
                        No categories to chart
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart 2: Threat Progression Timeline */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Activity size={16} color="#60a5fa" />
                    <span>Risk Progression Over Chronological Attempts</span>
                  </div>
                  <div className="chart-card-subtitle">
                    Live severity trajectory across successive prompt attempts
                  </div>
                  <div className="chart-canvas-wrap">
                    {riskTimelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={riskTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="attempt" stroke="#6b7280" fontSize={11} />
                          <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={11} />
                          <Tooltip
                            contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                            itemStyle={{ color: "#fff" }}
                          />
                          <Area type="monotone" dataKey="riskScore" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#riskGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--soc-text-dim)" }}>
                        No timeline data
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chronological Leak Attempts Log */}
              <div className="leak-attempts-section">
                <div className="leak-attempts-header">
                  <div className="leak-attempts-title">
                    <Terminal size={18} color="#818cf8" />
                    <span>Forensic Case History ({employeeIncidents.length} Cases — Latest Case #{employeeIncidents.length} at Top)</span>
                  </div>

                  {/* Filter by Target Service */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--soc-text-dim)" }}>Filter Destination:</span>
                    <select
                      value={serviceFilter}
                      onChange={(e) => setServiceFilter(e.target.value)}
                      style={{
                        background: "var(--soc-surface)",
                        border: "1px solid var(--soc-border)",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "6px 12px",
                        fontSize: 12,
                        outline: "none",
                      }}
                    >
                      <option value="ALL">All Destinations</option>
                      <option value="kiro">Kiro / Amazon Q (q.us-east-1.amazonaws.com)</option>
                      <option value="cursor">Cursor AI (cursor.com)</option>
                      <option value="chatgpt">ChatGPT (chatgpt.com)</option>
                      <option value="claude">Claude (claude.ai)</option>
                      <option value="gemini">Gemini (gemini.google.com)</option>
                      <option value="copilot">GitHub Copilot</option>
                      <option value="openai">OpenAI API (api.openai.com)</option>
                      <option value="deepseek">DeepSeek (deepseek.com)</option>
                    </select>
                  </div>
                </div>

                {employeeIncidents
                  .filter((inc) => serviceFilter === "ALL" || (inc.aiPlatform && inc.aiPlatform.toLowerCase().includes(serviceFilter.toLowerCase())))
                  .map((incident, idx) => {
                    const isBlocked = incident.actionTaken === "hard_block";
                    const timeObj = formatIncidentTimestamp(incident.timestamp);

                    return (
                      <div
                        key={incident.id || idx}
                        className={`attempt-incident-card ${isBlocked ? "blocked" : "redacted"}`}
                      >
                        {/* Incident Top Bar */}
                        <div className="attempt-card-top">
                          <div className="attempt-card-meta">
                            <span style={{ fontWeight: 800, color: "#fff", letterSpacing: "0.5px" }}>
                              CASE #{employeeIncidents.length - idx}{idx === 0 ? " • LATEST CASE" : ""}
                            </span>
                            {/* Branded AI Platform Badge */}
                            {renderAiPlatformBadge(incident.aiPlatform)}
                            {/* Enterprise Timestamp */}
                            <div className="incident-timestamp-block">
                              <Clock size={13} color="#94a3b8" />
                              <span>{timeObj.full}</span>
                              {timeObj.relative && (
                                <span className="incident-relative-tag">{timeObj.relative}</span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className={`status-tag ${isBlocked ? "blocked" : "redacted"}`}>
                              {isBlocked ? "🚫 HARD BLOCKED - PRE-FLIGHT" : "🛡 SILENT REDACTED"}
                            </span>
                            <span
                              className={`threat-score-pill ${
                                incident.riskScore >= 80 ? "critical" : incident.riskScore >= 50 ? "high" : "medium"
                              }`}
                            >
                              RISK: {incident.riskScore}/100
                            </span>
                          </div>
                        </div>

                        {/* Incident Detected Chips */}
                        {incident.detections && incident.detections.length > 0 && (
                          <div style={{ padding: "14px 20px 0 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--soc-text-dim)", textTransform: "uppercase", display: "flex", alignItems: "center", marginRight: 4 }}>
                              Targeted Confidential Data:
                            </span>
                            {incident.detections.map((det, dIdx) => (
                              <div
                                key={dIdx}
                                style={{
                                  background: "rgba(239, 68, 68, 0.08)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span style={{ color: "#fca5a5", fontWeight: 700 }}>{det.category}:</span>
                                <span style={{ color: "#ffffff", fontWeight: 600 }}>{det.matchedText}</span>
                                {det.isolationRisk && (
                                  <span style={{ color: "#f87171", fontSize: 10 }}>({det.isolationRisk}% Risk)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Raw Prompt vs Sanitized Action Inspector */}
                        <div className="attempt-card-body">
                          <div className="attempt-diff-grid">
                            {/* Column 1: Outbound Exfiltration Attempt */}
                            <div className="diff-panel attempted">
                              <div className="diff-panel-header">
                                <span>1. Pre-Firewall Outbound Prompt (What Employee Tried to Send)</span>
                                <span style={{ color: "#fca5a5" }}>PRE-FLIGHT INTERCEPTION</span>
                              </div>
                              <div className="diff-content-box" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                {cleanPromptText(incident.originalPrompt)}
                              </div>
                            </div>

                            {/* Column 2: Firewall Enforcement Result */}
                            <div className="diff-panel sanitized">
                              <div className="diff-panel-header">
                                <span>2. Firewall Enforcement Result</span>
                                <span style={{ color: isBlocked ? "#f87171" : "#93c5fd" }}>
                                  {isBlocked ? "HALTED BEFORE REACHING AI" : "SANITIZED PAYLOAD DELIVERED"}
                                </span>
                              </div>
                              <div className="diff-content-box" style={{ color: isBlocked ? "#fca5a5" : "#93c5fd", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                {cleanPromptText(incident.sanitizedPrompt)}
                              </div>
                            </div>
                          </div>

                          {/* AI Delivered Response (if not blocked) */}
                          {incident.restoredResponse && (
                            <div style={{ marginTop: 14, background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 8, padding: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", marginBottom: 6 }}>
                                3. AI Completion Delivered to Employee
                              </div>
                              <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                                {cleanAiResponseText(incident.restoredResponse)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Footer with Endpoint Host & HMAC Signature */}
                        <div className="attempt-card-footer">
                          <div>
                            ENDPOINT: {incident.endpointHost} ({incident.endpointIp})
                          </div>
                          <div>
                            AUDIT SIGNATURE: {incident.cryptoSignature ? `${incident.cryptoSignature.slice(0, 18)}...` : "HMAC-SHA256-VERIFIED"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ─── Simulation Modal ────────────────────────────────────────────────── */}
      {showSimModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Simulate Outbound AI Data Exfiltration</h3>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 18 }}
                onClick={() => setShowSimModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <label className="modal-label">Select Employee Origin</label>
              <select
                className="modal-select"
                value={simEmployee}
                onChange={(e) => setSimEmployee(e.target.value)}
              >
                <option value="employee">Current Workstation User</option>
                {flaggedEmployees.filter(e => e.userId !== "employee").map(emp => (
                  <option key={emp.id} value={emp.userId}>{emp.name}</option>
                ))}
              </select>

              <label className="modal-label">Data Leak Scenario</label>
              <select
                className="modal-select"
                value={simLeakType}
                onChange={(e) => setSimLeakType(e.target.value)}
              >
                <option value="aws_keys">AWS Production Credentials (AKIA... + Secret Key)</option>
                <option value="scada_reg">SCADA PLC Register (Turbine 0x4001 + Substation IP)</option>
                <option value="patient_ssn">Protected Health Information (Patient SSN + MRN)</option>
                <option value="credit_card">PCI Credit Card Number (Visa 4532... + CVV)</option>
                <option value="jwt_secret">Production API Signing Secret (JWT RS256 Key)</option>
                <option value="benign_prompt">Clean Prompt (Engineering Question — Risk 0 / Pass)</option>
                <option value="sanitized_prompt">Sanitized Prompt (Tokens Redacted — Risk 0 / Pass)</option>
              </select>

              <label className="modal-label">Custom Prompt Override (Optional)</label>
              <textarea
                className="modal-textarea"
                rows={3}
                placeholder="Leave blank to use preconfigured real-world exfiltration payload..."
                value={simCustomPrompt}
                onChange={(e) => setSimCustomPrompt(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button className="action-btn" onClick={() => setShowSimModal(false)}>
                Cancel
              </button>
              <button className="action-btn primary" onClick={handleSimulate} disabled={isSimulating}>
                {isSimulating ? "Transmitting through Firewall..." : "⚡ Launch Interception Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
