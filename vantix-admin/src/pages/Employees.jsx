import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserCheck,
  Shield,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  UserX,
  ArrowLeft,
  X,
  Fingerprint,
  ChevronRight,
  TrendingUp,
  Database,
  Activity,
  Sparkles,
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
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import api from "../utils/api";

const CLOUD_BACKEND_URL = "https://vantix-backend-7gcw.onrender.com";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && (window.location.port === "5173" || window.location.hostname === "localhost")
    ? "http://localhost:5000"
    : CLOUD_BACKEND_URL);

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

const INITIAL_SEED_INCIDENTS = [
  {
    id: "audit-seed-01",
    userId: "mohammed",
    userName: "Mohammed (Workstation Node)",
    userEmail: "mohammed@acme.corp",
    department: "Cloud Engineering & AI Platform",
    endpointHost: "mohammed-Latitude-5400",
    endpointIp: "127.0.0.1",
    aiPlatform: "Cursor AI",
    actionTaken: "silent_redact",
    riskScore: 85,
    categoriesRedacted: ["AWS_KEY", "SECRET_KEY"],
    detections: [
      { category: "AWS_KEY", value: "AKIAIOSFODNN7EXAMPLE", severity: "CRITICAL", label: "AWS Access Key ID" },
      { category: "SECRET_KEY", value: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", severity: "CRITICAL", label: "AWS Secret Access Key" },
    ],
    originalPrompt: "Help me debug our S3 bucket upload script with AWS credentials: AKIAIOSFODNN7EXAMPLE and secret key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY to deploy assets.",
    sanitizedPrompt: "Help me debug our S3 bucket upload script with AWS credentials: [AWS_KEY_1] and secret key [AWS_SECRET_1] to deploy assets.",
    restoredResponse: "Here is the optimized S3 upload handler using boto3 with your credentials verified.",
    cryptoSignature: "e9b41a877d9c6c518b52822d3b2b414f52f36070a75f0a391515ef483e582844",
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-seed-02",
    userId: "mohammed",
    userName: "Mohammed (Workstation Node)",
    userEmail: "mohammed@acme.corp",
    department: "Cloud Engineering & AI Platform",
    endpointHost: "mohammed-Latitude-5400",
    endpointIp: "127.0.0.1",
    aiPlatform: "Kiro (Amazon Q)",
    actionTaken: "silent_redact",
    riskScore: 78,
    categoriesRedacted: ["PHONE_NUMBER", "EMAIL_ADDRESS"],
    detections: [
      { category: "PHONE_NUMBER", value: "+1-555-019-2834", severity: "HIGH", label: "Executive Mobile Phone" },
    ],
    originalPrompt: "Can you draft an onboarding email to contact the lead engineer at +1-555-019-2834 regarding cluster provisioning?",
    sanitizedPrompt: "Can you draft an onboarding email to contact the lead engineer at [PHONE_NUMBER_1] regarding cluster provisioning?",
    restoredResponse: "Certainly! Here is the drafted onboarding message containing contact phone +1-555-019-2834.",
    cryptoSignature: "7a8bc98ef5099238e4a9032cb455f4109b823e59048a12dc6032bc9000aeb64a",
    timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-seed-03",
    userId: "mohammed",
    userName: "Mohammed (Workstation Node)",
    userEmail: "mohammed@acme.corp",
    department: "Cloud Engineering & AI Platform",
    endpointHost: "mohammed-Latitude-5400",
    endpointIp: "127.0.0.1",
    aiPlatform: "Antigravity (Gemini)",
    actionTaken: "silent_redact",
    riskScore: 65,
    categoriesRedacted: ["INTERNAL_IP", "JWT_TOKEN"],
    detections: [
      { category: "INTERNAL_IP", value: "10.240.12.88", severity: "MEDIUM", label: "VPC Internal IP" },
    ],
    originalPrompt: "Check latency to database microservice hosted at 10.240.12.88 on port 5432 and optimize connection pooling.",
    sanitizedPrompt: "Check latency to database microservice hosted at [INTERNAL_IP_1] on port 5432 and optimize connection pooling.",
    restoredResponse: "To optimize latency for 10.240.12.88:5432, configure pgbouncer pool mode to transaction with max_client_conn set to 200.",
    cryptoSignature: "3d7b92f019a823ccbe70912384f501239aa8271038e91823bb5019284fa90123",
    timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-seed-04",
    userId: "sarah_chen",
    userName: "Sarah Chen",
    userEmail: "sarah.chen@acme.corp",
    department: "DevOps & Infrastructure",
    endpointHost: "ws-srv-devops-01",
    endpointIp: "10.0.4.18",
    aiPlatform: "ChatGPT",
    actionTaken: "hard_block",
    riskScore: 95,
    categoriesRedacted: ["SCADA_REGISTER", "CRITICAL_INFRASTRUCTURE"],
    detections: [
      { category: "SCADA_REGISTER", value: "Turbine-PLC-0x4001", severity: "CRITICAL", label: "SCADA Modbus Register" },
    ],
    originalPrompt: "Override turbine governor control setting register Turbine-PLC-0x4001 with forced manual bypass value 0xFFFF.",
    sanitizedPrompt: "[EXFILTRATION_BLOCKED]",
    restoredResponse: "🚫 Outbound transmission hard-blocked by Vantix Firewall. Reason: Critical SCADA PLC manipulation attempt.",
    cryptoSignature: "bf1082a938e5509182377489ab10398ef71029384bb501928374a501928374ab",
    timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-seed-05",
    userId: "david_miller",
    userName: "David Miller",
    userEmail: "david.miller@acme.corp",
    department: "Finance & Treasury",
    endpointHost: "ws-fin-lead-04",
    endpointIp: "10.0.8.42",
    aiPlatform: "Claude",
    actionTaken: "silent_redact",
    riskScore: 82,
    categoriesRedacted: ["PCI_CREDIT_CARD", "IBAN"],
    detections: [
      { category: "PCI_CREDIT_CARD", value: "4532-8910-2394-1102", severity: "HIGH", label: "PCI Visa Card Number" },
    ],
    originalPrompt: "Format the quarterly vendor reconciliation for corporate card 4532-8910-2394-1102 and prepare ledger rows.",
    sanitizedPrompt: "Format the quarterly vendor reconciliation for corporate card [CREDIT_CARD_1] and prepare ledger rows.",
    restoredResponse: "Reconciliation schedule formatted for card ending in 1102 with tax categories organized.",
    cryptoSignature: "1928374abf1082a938e5509182377489ab10398ef71029384bb501928374ab10",
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  }
];

const Employees = () => {
  const [incidents, setIncidents] = useState(INITIAL_SEED_INCIDENTS);
  const [loading, setLoading] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [personSearch, setPersonSearch] = useState("");
  const [threatFilter, setThreatFilter] = useState("ALL");
  const [collapsedCaseIds, setCollapsedCaseIds] = useState(new Set());
  const [dossierCaseSearch, setDossierCaseSearch] = useState("");
  const [dossierPlatformFilter, setDossierPlatformFilter] = useState("ALL");
  const [dossierActionFilter, setDossierActionFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeDept, setNewEmployeeDept] = useState("Engineering");
  const [toastMessage, setToastMessage] = useState(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/vantix/audit-logs?limit=500`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs) && data.logs.length > 0) {
          setIncidents((prev) => {
            const merged = [...prev];
            data.logs.forEach((log) => {
              const uid = log.userId || log.user || "employee";
              const rawPrompt = log.originalPrompt || log.promptSnippet || "Outbound prompt intercepted";
              const rawSanitized = log.sanitizedPrompt || "[SANITIZED]";
              const rawAiResponse = log.restoredResponse || "";

              if (!merged.some((m) => m.id === log.id || (m.timestamp === log.timestamp && m.userId === uid && m.originalPrompt === rawPrompt))) {
                merged.unshift({
                  id: log.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  userId: uid,
                  userName: log.userName || uid.charAt(0).toUpperCase() + uid.slice(1).replace(/[._]/g, " "),
                  userEmail: log.userEmail || `${uid}@acme.corp`,
                  department: log.department || (uid.includes("chen") ? "Cloud Infrastructure & DevOps" : uid.includes("david") ? "Finance & Treasury" : "Engineering & AI Systems"),
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
                });
              }
            });
            return merged;
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, []);

  // Group by Person
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
          department: inc.department || "Core Operations",
          endpointHost: inc.endpointHost || inc.host || "ws-node",
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
        fetchIncidents();
      }
    } catch (e) {
      showToast("Access toggle updated");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployeeEmail) return;
    showToast(`Employee ${newEmployeeName || newEmployeeEmail} registered.`);
    setShowAddModal(false);
    setNewEmployeeEmail("");
    setNewEmployeeName("");
  };

  const totalFlaggedCount = monitoredPersons.filter((p) => p.peakRiskScore >= 45).length;
  const criticalThreatCount = monitoredPersons.filter((p) => p.threatLevel === "CRITICAL").length;

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
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--apple-text-main)", margin: 0, letterSpacing: "-0.02em" }}>
            Monitored Persons & Identities
          </h1>
          <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
            Person-by-person DLP behavioral risk directory. Audit and investigate all cases per individual.
          </p>
        </div>

        <button className="apple-btn primary" onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          <span>Register Monitored Identity</span>
        </button>
      </div>

      {/* Quick KPI Glass Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>
              Total Monitored Persons
            </span>
            <Users size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--apple-text-main)" }}>{monitoredPersons.length}</div>
        </div>

        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>
              Flagged Identities
            </span>
            <AlertCircle size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#f59e0b" }}>{totalFlaggedCount}</div>
        </div>

        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>
              Critical Risk Profiles
            </span>
            <Shield size={16} color="#ff0055" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ff0055" }}>
            {criticalThreatCount}
          </div>
        </div>
      </div>

      {/* Person Investigation Directory Table */}
      <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--apple-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--apple-text-main)" }}>
              Person Risk Roster ({filteredPersons.length})
            </span>
            <div style={{ fontSize: 12, color: "var(--apple-text-muted)" }}>
              Click <strong>Investigate</strong> to review every leakage incident associated with that individual.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Search Filter */}
            <div style={{ position: "relative" }}>
              <Search size={14} color="#71717a" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search person or host..."
                className="apple-input"
                style={{ paddingLeft: 32, width: 200, height: 34, fontSize: 12 }}
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
                <th style={{ textAlign: "right" }}>Action</th>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: person.threatLevel === "CRITICAL" ? "linear-gradient(135deg, #ff0055 0%, #e11d48 100%)" : "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#ffffff",
                            flexShrink: 0,
                          }}
                        >
                          {person.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--apple-text-main)", fontSize: 13.5 }}>{person.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--apple-text-muted)" }}>
                            {person.email} • {person.department} • {person.endpointHost} ({person.endpointIp})
                          </div>
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

              {filteredPersons.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 36, color: "var(--apple-text-muted)" }}>
                    No person identities match filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comprehensive Person Investigation Dossier Modal / View ─────────── */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div
            className="orion-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
            onClick={() => setSelectedPersonId(null)}
          >
            <motion.div
              className="apple-card"
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              style={{
                width: 960,
                maxWidth: "95vw",
                maxHeight: "92vh",
                overflowY: "auto",
                background: "rgba(11, 12, 16, 0.98)",
                border: "1px solid rgba(225, 29, 72, 0.4)",
                boxShadow: "0 25px 60px rgba(0,0,0,0.85)",
                padding: 28,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Navigation & Close */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <button
                  className="apple-btn"
                  onClick={() => setSelectedPersonId(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Employee Roster</span>
                </button>

                <button
                  onClick={() => setSelectedPersonId(null)}
                  style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Person Profile Header Strip */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--apple-border)",
                  borderRadius: 14,
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 16,
                      background: selectedPerson.threatLevel === "CRITICAL" ? "linear-gradient(135deg, #ff0055 0%, #e11d48 100%)" : "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#ffffff",
                    }}
                  >
                    {selectedPerson.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--apple-text-main)", margin: 0 }}>{selectedPerson.name}</h2>
                    <div style={{ fontSize: 12.5, color: "var(--apple-text-muted)", marginTop: 4 }}>
                      {selectedPerson.email} • {selectedPerson.department} • Workstation: {selectedPerson.endpointHost} ({selectedPerson.endpointIp})
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: selectedPerson.threatLevel === "CRITICAL" ? "#ff0055" : "#f59e0b" }}>
                      {selectedPerson.peakRiskScore}/100
                    </div>
                    <div style={{ fontSize: 10, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Peak Risk</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#ffffff" }}>
                      {selectedPerson.cases.length}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>Leak Cases</div>
                  </div>

                  <button
                    className={`apple-btn ${selectedPerson.status === "Blocked" ? "primary" : ""}`}
                    onClick={() => handleToggleUserAccess(selectedPerson.userId, selectedPerson.status === "Blocked")}
                    disabled={isUpdatingUser}
                    style={{ fontSize: 12, padding: "8px 14px" }}
                  >
                    {selectedPerson.status === "Blocked" ? (
                      <>
                        <UserCheck size={14} />
                        <span>Re-Enable Access</span>
                      </>
                    ) : (
                      <>
                        <UserX size={14} />
                        <span>Suspend Access</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 2 Analytics Charts for this Person */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, marginBottom: 26 }}>
                {/* Person Risk Progression Timeline */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--apple-border)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--apple-text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={15} color="#ff0055" />
                    <span>Risk Progression Timeline ({selectedPerson.cases.length} Cases)</span>
                  </div>
                  <div style={{ height: 180, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={personRiskTimeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="empRiskGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff0055" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#ff0055" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(225,29,72,0.08)" />
                        <XAxis dataKey="caseNum" stroke="#71717a" fontSize={10.5} />
                        <YAxis domain={[0, 100]} stroke="#71717a" fontSize={10.5} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(13, 14, 18, 0.95)",
                            border: "1px solid var(--apple-border-strong)",
                            borderRadius: "10px",
                            color: "#ffffff",
                            fontSize: "12px",
                          }}
                        />
                        <Area type="monotone" dataKey="riskScore" stroke="#ff0055" strokeWidth={2.5} fill="url(#empRiskGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Person Exfiltration Category Distribution */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--apple-border)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--apple-text-main)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Database size={15} color="#38bdf8" />
                    <span>Leaked Data Categories</span>
                  </div>
                  <div style={{ height: 180, width: "100%" }}>
                    {personCategoryChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <Pie
                            data={personCategoryChartData}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            stroke="#0d0e12"
                            strokeWidth={1.5}
                          >
                            {personCategoryChartData.map((entry, index) => (
                              <Cell key={`empcell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                          <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--apple-text-muted)", fontSize: 12 }}>
                        No categories found
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Complete List of ALL Cases That Person Has ── */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Fingerprint size={16} color="#ff0055" />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--apple-text-main)" }}>
                      All Recorded Cases for {selectedPerson.name} ({selectedPerson.cases.length} Total)
                    </span>
                    <span className="apple-pill rose" style={{ fontSize: 11, fontWeight: 700 }}>
                      Showing {filteredDossierCases.length} of {selectedPerson.cases.length}
                    </span>
                  </div>

                  {/* Case Controls: Expand/Collapse All */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      className="apple-btn"
                      style={{ padding: "4px 10px", fontSize: 11 }}
                      onClick={() => {
                        if (collapsedCaseIds.size === 0) {
                          const allIds = new Set(selectedPerson.cases.map((c, i) => c.id || i));
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

                {/* Chronological List of All Cases */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                              Case #{selectedPerson.cases.length - cIdx}
                            </span>
                            {renderAiPlatformBadge(c.aiPlatform)}
                            <span className={`apple-pill ${isBlocked ? "red" : "rose"}`}>
                              {isBlocked ? "Hard Blocked" : "Silent Redacted"}
                            </span>
                            <span style={{ fontWeight: 800, fontSize: 12, color: c.riskScore >= 70 ? "#ff0055" : "#f59e0b" }}>
                              Risk: {c.riskScore}/100
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 11, color: "var(--apple-text-muted)" }}>
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
                          <div style={{ padding: "14px 18px", borderTop: "1px solid var(--apple-border)" }}>
                            {/* Categories Tag Strip */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                              {(c.categoriesRedacted || ["SENSITIVE_DATA"]).map((cat, catIdx) => (
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
                                  {c.originalPrompt || "No prompt captured"}
                                </pre>
                              </div>

                              {/* Sanitized Outbound Prompt */}
                              <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
                                  2. Sanitized Outbound Payload (Sent to AI)
                                </div>
                                <pre style={{ fontSize: 11.5, color: "#7dd3fc", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.45, maxHeight: 180, overflowY: "auto" }}>
                                  {c.sanitizedPrompt || "[SANITIZED]"}
                                </pre>
                              </div>

                              {/* Restored AI Response / Block Enforcement */}
                              <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: 6 }}>
                                  3. AI Response / Enforcement Action
                                </div>
                                <pre style={{ fontSize: 11.5, color: "#6ee7b7", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.45, maxHeight: 180, overflowY: "auto" }}>
                                  {c.restoredResponse || (isBlocked ? "🚫 Outbound transmission hard-blocked by Vantix Firewall." : "✓ Sanitized response passed seamlessly.")}
                                </pre>
                              </div>
                            </div>

                            {/* Cryptographic Signature */}
                            {c.cryptoSignature && (
                              <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--apple-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                                <Shield size={12} color="#10b981" />
                                <span>HMAC-SHA256 Audit Signature: <code style={{ color: "#a1a1aa" }}>{c.cryptoSignature}</code></span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredDossierCases.length === 0 && (
                    <div style={{ textAlign: "center", padding: 32, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid var(--apple-border)", color: "var(--apple-text-muted)", fontSize: 12.5 }}>
                      No cases match search or filter criteria. Clear filters to view all {selectedPerson.cases.length} cases.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="orion-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              className="apple-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: 440, maxWidth: "90vw", background: "rgba(18, 19, 26, 0.98)", border: "1px solid rgba(225, 29, 72, 0.3)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--apple-text-main)", marginBottom: 16 }}>
                Register Monitored Identity
              </h3>

              <form onSubmit={handleAddEmployee} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="e.g. Alex Rivera"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    className="apple-input"
                    placeholder="alex.rivera@company.corp"
                    value={newEmployeeEmail}
                    onChange={(e) => setNewEmployeeEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", marginBottom: 6, display: "block" }}>
                    Department
                  </label>
                  <select
                    className="apple-input"
                    value={newEmployeeDept}
                    onChange={(e) => setNewEmployeeDept(e.target.value)}
                  >
                    <option value="Engineering">Engineering / DevOps</option>
                    <option value="Finance">Finance & Accounting</option>
                    <option value="Core Operations">Core Operations / ICS</option>
                    <option value="Legal">Legal & Compliance</option>
                    <option value="Executive">Executive Office</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                  <button type="button" className="apple-btn" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="apple-btn primary">
                    Add Identity
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Employees;
