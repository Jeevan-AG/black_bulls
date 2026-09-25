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
  User,
  ArrowLeft,
  Search,
  Eye,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  X,
  UserX,
  UserCheck,
  TrendingUp,
  Fingerprint,
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
  AreaChart,
  Area,
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

export default function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Person Investigation State
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [personSearch, setPersonSearch] = useState("");
  const [threatFilter, setThreatFilter] = useState("ALL");
  const [collapsedCaseIds, setCollapsedCaseIds] = useState(new Set());
  const [dossierCaseSearch, setDossierCaseSearch] = useState("");
  const [dossierPlatformFilter, setDossierPlatformFilter] = useState("ALL");
  const [dossierActionFilter, setDossierActionFilter] = useState("ALL");
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Simulation Modal State
  const [showSimModal, setShowSimModal] = useState(false);
  const [simEmployee, setSimEmployee] = useState("mohammed");
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
                userId: packet.user || packet.userId || "employee",
                userName: packet.userName || (packet.user ? packet.user.charAt(0).toUpperCase() + packet.user.slice(1).replace(/[._]/g, " ") : "Employee"),
                userEmail: packet.userEmail || `${packet.user || packet.userId || "employee"}@acme.corp`,
                department: packet.department || "Cloud Engineering & AI Platform",
                endpointHost: packet.host || packet.endpointHost || "workstation",
                endpointIp: packet.endpointIp || "127.0.0.1",
                aiPlatform: packet.aiPlatform || "chatgpt.com",
                actionTaken: packet.actionTaken || (packet.riskScore >= 70 ? "hard_block" : packet.riskScore >= 30 ? "silent_redact" : "pass"),
                riskScore: packet.riskScore !== undefined ? packet.riskScore : 0,
                categoriesRedacted: packet.detections ? Array.from(new Set(packet.detections.map((d) => d.category))) : (packet.categoriesRedacted || ["CONFIDENTIAL_DATA"]),
                detections: packet.detections || [],
                originalPrompt: cleanPromptText(packet.originalPrompt || "Outbound prompt intercepted"),
                sanitizedPrompt: cleanPromptText(packet.sanitizedPrompt || "[SANITIZED]"),
                restoredResponse: cleanAiResponseText(packet.restoredResponse || ""),
                cryptoSignature: packet.cryptoSignature || "",
                timestamp: packet.timestamp || new Date().toISOString(),
              };

              setIncidents((prev) => [incoming, ...prev.filter((p) => p.id !== incoming.id)]);
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
  }, []);

  const totalIntercepts = incidents.length;
  const totalBlocked = incidents.filter((i) => i.actionTaken === "hard_block").length;
  const totalRedacted = incidents.filter((i) => i.actionTaken === "silent_redact").length;

  // ── Group Incidents by Person / Identity ─────────────────────────────────────
  const monitoredPersons = useMemo(() => {
    const userMap = new Map();

    incidents.forEach((inc) => {
      const key = (inc.userId || inc.userEmail || "unknown").toLowerCase();
      if (!userMap.has(key)) {
        userMap.set(key, {
          id: key,
          userId: inc.userId || key,
          name: inc.userName || (key.charAt(0).toUpperCase() + key.slice(1).replace(/[._]/g, " ")),
          email: inc.userEmail || `${key}@acme.corp`,
          department: inc.department || "Core Engineering",
          endpointHost: inc.endpointHost || "ws-node",
          endpointIp: inc.endpointIp || "127.0.0.1",
          cases: [],
          totalAttempts: 0,
          hardBlockedCount: 0,
          redactedCount: 0,
          peakRiskScore: 0,
          categories: new Set(),
          aiPlatforms: new Set(),
          lastAttempt: inc.timestamp,
        });
      }

      const entry = userMap.get(key);
      entry.cases.push(inc);
      entry.totalAttempts++;
      if (inc.actionTaken === "hard_block") entry.hardBlockedCount++;
      if (inc.actionTaken === "silent_redact") entry.redactedCount++;
      if ((inc.riskScore || 0) > entry.peakRiskScore) entry.peakRiskScore = inc.riskScore;
      if (inc.aiPlatform) entry.aiPlatforms.add(inc.aiPlatform);

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

    return Array.from(userMap.values()).map((u) => {
      const sortedCases = [...u.cases].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return {
        ...u,
        cases: sortedCases,
        topCategories: Array.from(u.categories),
        aiPlatformsList: Array.from(u.aiPlatforms),
        threatLevel:
          u.peakRiskScore >= 75
            ? "CRITICAL"
            : u.peakRiskScore >= 45
            ? "HIGH"
            : u.peakRiskScore >= 20
            ? "MEDIUM"
            : "LOW",
        status:
          u.hardBlockedCount > 0
            ? "Blocked"
            : u.redactedCount > 0
            ? "Active Redactions"
            : "Monitored",
      };
    }).sort((a, b) => b.peakRiskScore - a.peakRiskScore || b.totalAttempts - a.totalAttempts);
  }, [incidents]);

  const filteredPersons = useMemo(() => {
    return monitoredPersons.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(personSearch.toLowerCase()) ||
        p.email.toLowerCase().includes(personSearch.toLowerCase()) ||
        p.department.toLowerCase().includes(personSearch.toLowerCase()) ||
        p.endpointHost.toLowerCase().includes(personSearch.toLowerCase());
      const matchesThreat = threatFilter === "ALL" || p.threatLevel === threatFilter;
      return matchesSearch && matchesThreat;
    });
  }, [monitoredPersons, personSearch, threatFilter]);

  // Selected Person for Deep Investigation Dossier
  const selectedPerson = useMemo(() => {
    if (!selectedPersonId) return null;
    return monitoredPersons.find((p) => p.id === selectedPersonId) || null;
  }, [selectedPersonId, monitoredPersons]);

  // Selected Person's Risk Timeline Chart (Case #1 -> Case #N)
  const personRiskTimeline = useMemo(() => {
    if (!selectedPerson || selectedPerson.cases.length === 0) return [];
    const chronological = [...selectedPerson.cases].reverse();
    return chronological.map((c, idx) => ({
      caseNum: `Case #${idx + 1}`,
      riskScore: c.riskScore || 0,
      action: c.actionTaken === "hard_block" ? "Blocked" : "Redacted",
      platform: c.aiPlatform || "chatgpt.com",
      time: new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [selectedPerson]);

  // Selected Person's Category Distribution Chart
  const personCategoryChartData = useMemo(() => {
    if (!selectedPerson || selectedPerson.cases.length === 0) return [];
    const counts = {};
    selectedPerson.cases.forEach((c) => {
      const cats = c.categoriesRedacted && c.categoriesRedacted.length > 0
        ? c.categoriesRedacted
        : (c.detections || []).map((d) => d.category);
      cats.forEach((cat) => {
        const clean = (cat || "CONFIDENTIAL").replace(/_/g, " ").toUpperCase();
        counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedPerson]);

  // Filtered cases for the active Person Dossier (supports search across 1 to 100+ cases)
  const filteredDossierCases = useMemo(() => {
    if (!selectedPerson || !selectedPerson.cases) return [];
    return selectedPerson.cases.filter((c) => {
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
  }, [selectedPerson, dossierCaseSearch, dossierPlatformFilter, dossierActionFilter]);

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

  const handleToggleUserAccess = async (userId, currentlyBlocked) => {
    setIsUpdatingUser(true);
    try {
      const endpoint = currentlyBlocked ? `${API_BASE}/api/vantix/user-behavior/reenable` : `${API_BASE}/api/vantix/user-behavior/disable`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: currentlyBlocked ? "Admin re-enabled access" : "Suspended by Security Administrator" }),
      });
      if (res.ok) {
        showToast(currentlyBlocked ? `Access re-enabled for ${userId}` : `AI access suspended for ${userId}`);
        fetchLiveData();
      }
    } catch (e) {
      showToast("Access toggle updated");
    } finally {
      setIsUpdatingUser(false);
    }
  };

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

  const handleExportPersonAudit = (person) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(person, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vantix-audit-${person.userId || person.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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

  // ── Render Dedicated Person Investigation Dashboard ───────────────────────
  if (selectedPerson) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
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

        {/* Top Header & Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              className="apple-btn"
              onClick={() => setSelectedPersonId(null)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 16px" }}
            >
              <ArrowLeft size={16} />
              <span>Back to SOC Overview</span>
            </button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--apple-text-main)", margin: 0, letterSpacing: "-0.02em" }}>
                Forensic Investigation: {selectedPerson.name}
              </h1>
              <p style={{ fontSize: 12.5, color: "var(--apple-text-muted)", margin: "3px 0 0 0" }}>
                Workstation Node: <strong style={{ color: "#ffffff" }}>{selectedPerson.endpointHost}</strong> ({selectedPerson.endpointIp}) • {selectedPerson.department}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className={`apple-btn ${selectedPerson.status === "Blocked" ? "primary" : ""}`}
              onClick={() => handleToggleUserAccess(selectedPerson.userId, selectedPerson.status === "Blocked")}
              disabled={isUpdatingUser}
              style={{ fontSize: 12.5 }}
            >
              {selectedPerson.status === "Blocked" ? (
                <>
                  <UserCheck size={14} />
                  <span>Re-Enable User Access</span>
                </>
              ) : (
                <>
                  <UserX size={14} />
                  <span>Suspend AI Access</span>
                </>
              )}
            </button>

            <button className="apple-btn" onClick={() => handleExportPersonAudit(selectedPerson)} style={{ fontSize: 12.5 }}>
              <Download size={14} />
              <span>Export Dossier</span>
            </button>
          </div>
        </div>

        {/* 4 Square Scorecards for this Person */}
        <div className="kpi-square-grid">
          <KpiSquareStatCard
            label="Total Leakage Cases"
            value={selectedPerson.cases.length}
            icon={<Activity size={24} color="#ff0055" />}
            color="#ff0055"
            borderTopColor="#ff0055"
            bgGradient="linear-gradient(145deg, rgba(255, 0, 85, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
            tooltip="Total exfiltration attempts intercepted and logged for this individual."
          />

          <KpiSquareStatCard
            label="Hard Blocked"
            value={selectedPerson.hardBlockedCount}
            icon={<ShieldAlert size={24} color="#e11d48" />}
            color="#e11d48"
            borderTopColor="#e11d48"
            bgGradient="linear-gradient(145deg, rgba(225, 29, 72, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
            tooltip="Cases immediately blocked and dropped before reaching external AI endpoints."
          />

          <KpiSquareStatCard
            label="Silent Redacted"
            value={selectedPerson.redactedCount}
            icon={<Lock size={24} color="#f43f5e" />}
            color="#f43f5e"
            borderTopColor="#f43f5e"
            bgGradient="linear-gradient(145deg, rgba(244, 63, 94, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
            tooltip="Cases where sensitive keys, PII, or internal tokens were masked with surrogate tokens in-flight."
          />

          <KpiSquareStatCard
            label="Peak Risk Score"
            value={`${selectedPerson.peakRiskScore}/100`}
            icon={<AlertTriangle size={24} color={selectedPerson.threatLevel === "CRITICAL" ? "#ff0055" : "#f59e0b"} />}
            color={selectedPerson.threatLevel === "CRITICAL" ? "#ff0055" : "#f59e0b"}
            borderTopColor={selectedPerson.threatLevel === "CRITICAL" ? "#ff0055" : "#f59e0b"}
            bgGradient="linear-gradient(145deg, rgba(255, 0, 85, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
            tooltip="Highest behavioral risk severity score triggered across all cases."
          />
        </div>

        {/* 2 Analytics Charts for this Person */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 }}>
          {/* Risk Timeline */}
          <div className="apple-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <TrendingUp size={16} color="#ff0055" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--apple-text-main)" }}>
                Risk Progression Timeline ({selectedPerson.cases.length} Sequential Cases)
              </span>
            </div>
            <div style={{ height: 210, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={personRiskTimeline} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="personRiskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff0055" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ff0055" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(225,29,72,0.08)" />
                  <XAxis dataKey="caseNum" stroke="#71717a" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13, 14, 18, 0.95)",
                      border: "1px solid var(--apple-border-strong)",
                      borderRadius: "10px",
                      color: "#ffffff",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="riskScore" stroke="#ff0055" strokeWidth={2.5} fill="url(#personRiskGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaked Categories Distribution */}
          <div className="apple-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Database size={16} color="#38bdf8" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--apple-text-main)" }}>
                Exfiltrated Data Vectors
              </span>
            </div>
            <div style={{ height: 210, width: "100%" }}>
              {personCategoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={personCategoryChartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={68}
                      stroke="#0d0e12"
                      strokeWidth={1.5}
                    >
                      {personCategoryChartData.map((entry, index) => (
                        <Cell key={`pcell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(13, 14, 18, 0.95)",
                        border: "1px solid var(--apple-border-strong)",
                        borderRadius: "10px",
                        color: "#ffffff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--apple-text-muted)", fontSize: 12 }}>
                  No categories recorded
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Cases Investigation Console (All Cases for this Person) ─────────── */}
        <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Fingerprint size={18} color="#ff0055" />
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--apple-text-main)" }}>
                  All Recorded Cases for {selectedPerson.name} ({selectedPerson.cases.length} Total)
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
                Deep forensic inspection: Actual User Input → System Sanitization Payload → Real Output from AI.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* In-dossier Search */}
              <div style={{ position: "relative" }}>
                <Search size={13} color="#71717a" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search prompt, surrogate token, DLP rule..."
                  className="apple-input"
                  style={{ paddingLeft: 30, width: 220, height: 34, fontSize: 12 }}
                  value={dossierCaseSearch}
                  onChange={(e) => setDossierCaseSearch(e.target.value)}
                />
              </div>

              {/* Platform Filter */}
              <select
                className="apple-input"
                style={{ width: 150, height: 34, fontSize: 12 }}
                value={dossierPlatformFilter}
                onChange={(e) => setDossierPlatformFilter(e.target.value)}
              >
                <option value="ALL">All AI Platforms</option>
                <option value="cursor">Cursor AI</option>
                <option value="kiro">Kiro (Amazon Q)</option>
                <option value="antigravity">Antigravity (Gemini)</option>
                <option value="windsurf">Windsurf AI</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
              </select>

              {/* Action Filter */}
              <select
                className="apple-input"
                style={{ width: 140, height: 34, fontSize: 12 }}
                value={dossierActionFilter}
                onChange={(e) => setDossierActionFilter(e.target.value)}
              >
                <option value="ALL">All Actions</option>
                <option value="hard_block">Hard Blocked</option>
                <option value="silent_redact">Silent Redacted</option>
              </select>

              {/* Expand/Collapse All */}
              <button
                className="apple-btn"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => {
                  if (collapsedCaseIds.size === 0) {
                    setCollapsedCaseIds(new Set(selectedPerson.cases.map((c, i) => c.id || i)));
                  } else {
                    setCollapsedCaseIds(new Set());
                  }
                }}
              >
                {collapsedCaseIds.size === 0 ? "Collapse All" : "Expand All"}
              </button>
            </div>
          </div>

          {/* Cases List */}
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredDossierCases.map((c, cIdx) => {
              const caseKey = c.id || cIdx;
              const isCollapsed = collapsedCaseIds.has(caseKey);
              const isBlocked = c.actionTaken === "hard_block";

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
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {/* Case Card Header */}
                  <div
                    style={{
                      padding: "14px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      background: "rgba(255, 255, 255, 0.015)",
                    }}
                    onClick={toggleCase}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "#ffffff" }}>
                        Case #{selectedPerson.cases.length - cIdx}
                      </span>
                      {renderAiPlatformBadge(c.aiPlatform)}
                      <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                        {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: c.riskScore >= 70 ? "#ff0055" : "#f59e0b" }}>
                        Risk: {c.riskScore}/100
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 12, color: "var(--apple-text-muted)" }}>
                        {new Date(c.timestamp).toLocaleString()}
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
                    <div style={{ padding: "18px 20px", borderTop: "1px solid var(--apple-border)" }}>
                      {/* Redacted Categories */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        {(c.categoriesRedacted || ["SENSITIVE_DATA"]).map((cat, catIdx) => (
                          <span
                            key={catIdx}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "3px 10px",
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
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                        {/* 1. Actual Outbound User Input (What user sent) */}
                        <div style={{ background: "rgba(0,0,0,0.45)", borderRadius: 10, padding: 14, border: "1px solid rgba(255, 0, 85, 0.25)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#ff0055", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>
                            1. Actual User Input (What User Sent)
                          </div>
                          <pre style={{ fontSize: 12, color: "#fca5a5", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.5, maxHeight: 220, overflowY: "auto" }}>
                            {c.originalPrompt || "No prompt captured"}
                          </pre>
                        </div>

                        {/* 2. System Sanitized Payload (What system changes it into before giving to AI) */}
                        <div style={{ background: "rgba(0,0,0,0.45)", borderRadius: 10, padding: 14, border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>
                            2. System Sanitized Payload (Sent to AI)
                          </div>
                          <pre style={{ fontSize: 12, color: "#7dd3fc", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.5, maxHeight: 220, overflowY: "auto" }}>
                            {c.sanitizedPrompt || "[SANITIZED]"}
                          </pre>
                        </div>

                        {/* 3. Actual Real Output from AI */}
                        <div style={{ background: "rgba(0,0,0,0.45)", borderRadius: 10, padding: 14, border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#10b981", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>
                            3. Actual Real Output from AI (Restored to User)
                          </div>
                          <pre style={{ fontSize: 12, color: "#6ee7b7", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.5, maxHeight: 220, overflowY: "auto" }}>
                            {c.restoredResponse || (isBlocked ? "🚫 Outbound transmission hard-blocked by Vantix Firewall." : "✓ Sanitized response passed seamlessly.")}
                          </pre>
                        </div>
                      </div>

                      {/* Footer: Telemetry & Cryptographic HMAC */}
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, fontSize: 11.5, color: "var(--apple-text-muted)" }}>
                        <div>
                          Workstation: <strong style={{ color: "#ffffff" }}>{selectedPerson.endpointHost}</strong> ({selectedPerson.endpointIp}) • User ID: <code style={{ color: "#a1a1aa" }}>{c.userId}</code>
                        </div>
                        {c.cryptoSignature && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Shield size={13} color="#10b981" />
                            <span>HMAC-SHA256: <code style={{ color: "#a1a1aa" }}>{c.cryptoSignature}</code></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredDossierCases.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--apple-text-muted)", fontSize: 13 }}>
                No cases match the search or filter criteria. Clear filters to view all {selectedPerson.cases.length} cases.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Render Main SOC Operation Centre Overview Dashboard ───────────────────
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--apple-text-main)", margin: 0, letterSpacing: "-0.02em" }}>
            Operation Centre
          </h1>
          <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
            Real-time Autonomous AI Data Firewall & Insider Risk Intelligence
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="apple-btn" onClick={() => setShowSimModal(true)}>
            <Play size={14} />
            <span>Simulate Exfiltration</span>
          </button>
          <button className="apple-btn" onClick={handleExportAudit}>
            <Download size={14} />
            <span>Export Forensic Logs</span>
          </button>
        </div>
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
          label="Monitored Persons"
          value={monitoredPersons.length}
          icon={<User size={26} color="#38bdf8" />}
          color="#38bdf8"
          borderTopColor="#38bdf8"
          bgGradient="linear-gradient(145deg, rgba(56, 189, 248, 0.08) 0%, rgba(13, 14, 18, 0.85) 100%)"
          tooltip="Unique user identities monitored across enterprise workstations, IDEs, and browser sessions."
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

      {/* ── Monitored Persons & Flagged Identities Directory ────────────────────── */}
      <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <User size={18} color="#ff0055" />
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--apple-text-main)" }}>Monitored Persons & Threat Cases</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
              Identity-correlated behavioral risk tracking. Click <strong>Investigate</strong> on any person to audit all their leakage cases.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Search Filter */}
            <div style={{ position: "relative" }}>
              <Search size={14} color="#71717a" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search person or host..."
                className="apple-input"
                style={{ paddingLeft: 32, width: 190, height: 34, fontSize: 12 }}
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
              />
            </div>

            {/* Severity Filter */}
            <select
              className="apple-input"
              style={{ width: 120, height: 34, fontSize: 12 }}
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value)}
            >
              <option value="ALL">All Threats</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="apple-table">
            <thead>
              <tr>
                <th>Person / Workstation</th>
                <th>Leakage Cases</th>
                <th>Peak Risk Score</th>
                <th>Target AI Platforms</th>
                <th>Last Incident</th>
                <th style={{ textAlign: "right" }}>Forensic Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersons.map((person) => {
                const threatColor =
                  person.threatLevel === "CRITICAL"
                    ? "#ff0055"
                    : person.threatLevel === "HIGH"
                    ? "#f59e0b"
                    : person.threatLevel === "MEDIUM"
                    ? "#38bdf8"
                    : "#10b981";

                return (
                  <tr key={person.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--apple-text-main)", fontSize: 14 }}>{person.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>
                          {person.email} • {person.department} • {person.endpointHost} ({person.endpointIp})
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="apple-pill rose" style={{ fontWeight: 700 }}>
                          {person.cases.length} Case{person.cases.length !== 1 ? "s" : ""}
                        </span>
                        {person.hardBlockedCount > 0 && (
                          <span className="apple-pill red" style={{ fontSize: 10 }}>
                            {person.hardBlockedCount} Blocked
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: threatColor }}>
                          {person.peakRiskScore}/100
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: `${threatColor}18`,
                            color: threatColor,
                            border: `1px solid ${threatColor}40`,
                          }}
                        >
                          {person.threatLevel}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {person.aiPlatformsList.slice(0, 3).map((plat, pIdx) => (
                          <span key={pIdx}>{renderAiPlatformBadge(plat)}</span>
                        ))}
                      </div>
                    </td>

                    <td style={{ fontSize: 12, color: "var(--apple-text-muted)" }}>
                      {new Date(person.lastAttempt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        className="apple-btn primary"
                        style={{ padding: "6px 14px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() => setSelectedPersonId(person.id)}
                      >
                        <Eye size={13} />
                        <span>Investigate ({person.cases.length})</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredPersons.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 48, color: "var(--apple-text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <Activity size={24} color="#ff0055" style={{ animation: "pulse 2s infinite" }} />
                      <span style={{ fontWeight: 600, color: "var(--apple-text-main)", fontSize: 14 }}>No Flagged Threats Detected</span>
                      <span style={{ fontSize: 12, color: "var(--apple-text-muted)" }}>
                        System is actively listening for live telemetry across all workstation endpoints.
                      </span>
                    </div>
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
            style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
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
                    {monitoredPersons.length > 0 ? (
                      monitoredPersons.map((p) => (
                        <option key={p.id} value={p.userId || p.id}>
                          {p.name} ({p.endpointHost || "Workstation"})
                        </option>
                      ))
                    ) : (
                      <option value="mohammed">Mohammed (mohammed-Latitude-5400)</option>
                    )}
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
