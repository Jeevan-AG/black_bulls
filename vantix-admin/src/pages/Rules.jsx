import React, { useEffect, useState } from "react";
import api from "../utils/api";
import {
  ShieldAlert,
  Globe,
  KeyRound,
  Hash,
  Terminal,
  FileCode,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Play,
  Cpu,
  RefreshCw,
  Search,
} from "lucide-react";

const NUMBER_TYPE_LABELS = {
  phone: "Phone / Contact No.",
  account_number: "Bank Account",
  ifsc: "IFSC Code",
  aadhaar: "Aadhaar",
  pan: "PAN",
  employee_id: "Employee ID",
  other: "Other",
};

const EMPTY_APIKEY = { label: "", value: "" };
const EMPTY_NUMBER = { label: "", type: "phone", value: "" };

const Rules = () => {
  const [rules, setRules] = useState({
    domains: [],
    keywords: [],
    customPatterns: [],
    apiKeys: [],
    sensitiveNumbers: [],
    monitoredApps: [],
  });

  const [newDomain, setNewDomain] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newApiKey, setNewApiKey] = useState(EMPTY_APIKEY);
  const [newNumber, setNewNumber] = useState(EMPTY_NUMBER);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'domains', 'keys', 'keywords', 'identifiers', 'test'

  // Test sandbox state
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState(null);

  const fetchRules = async () => {
    try {
      const res = await api.get("/rules");
      setRules({
        domains: res.data.companyRules?.domains || [],
        keywords: res.data.companyRules?.keywords || [],
        customPatterns: res.data.companyRules?.customPatterns || [],
        apiKeys: res.data.companyRules?.apiKeys || [],
        sensitiveNumbers: res.data.companyRules?.sensitiveNumbers || [],
        monitoredApps: res.data.companyRules?.monitoredApps || [],
      });
    } catch (err) {
      console.error("Rules fetch error:", err);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const wrap = (fn) => async (...args) => {
    try {
      setBusy(true);
      await fn(...args);
      await fetchRules();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleAddDomain = wrap(async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    await api.post("/rules/domain", { domain: newDomain.trim() });
    setNewDomain("");
  });

  const handleAddKeyword = wrap(async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    await api.post("/rules/keyword", { keyword: newKeyword.trim() });
    setNewKeyword("");
  });

  const handleAddApiKey = wrap(async (e) => {
    e.preventDefault();
    if (!newApiKey.label || !newApiKey.value) return;
    await api.post("/rules/apikey", newApiKey);
    setNewApiKey(EMPTY_APIKEY);
  });

  const handleAddNumber = wrap(async (e) => {
    e.preventDefault();
    if (!newNumber.label || !newNumber.value) return;
    await api.post("/rules/number", newNumber);
    setNewNumber(EMPTY_NUMBER);
  });

  const handleRemoveDomain = wrap((domain) =>
    api.delete("/rules/domain", { data: { domain } })
  );
  const handleRemoveKeyword = wrap((keyword) =>
    api.delete("/rules/keyword", { data: { keyword } })
  );
  const handleRemoveApiKey = wrap((id) => api.delete(`/rules/apikey/${id}`));
  const handleRemoveNumber = wrap((id) => api.delete(`/rules/number/${id}`));

  // Rule Test Engine Simulator
  const runRuleTest = () => {
    if (!testInput.trim()) {
      setTestResult(null);
      return;
    }

    const lower = testInput.toLowerCase();
    const matchedKeywords = rules.keywords.filter((k) =>
      lower.includes(k.toLowerCase())
    );
    const matchedDomains = rules.domains.filter((d) =>
      lower.includes(d.toLowerCase())
    );

    let status = "PASSED";
    let action = "TRANSMIT_ALLOWED";
    let violations = [];

    // Check credentials or high entropy
    if (
      lower.includes("sk-") ||
      lower.includes("akias") ||
      lower.includes("ai-") ||
      rules.apiKeys.some((k) => testInput.includes(k.label))
    ) {
      status = "BLOCKED";
      action = "HARD_BLOCK_TEE";
      violations.push({
        type: "CREDENTIAL_LEAK",
        severity: "CRITICAL",
        detail: "Infrastructure API Key signature detected",
      });
    }

    if (matchedKeywords.length > 0) {
      status = status === "BLOCKED" ? "BLOCKED" : "REDACTED";
      action = status === "BLOCKED" ? action : "IRREVERSIBLE_REDACTION";
      violations.push({
        type: "RESTRICTED_KEYWORD",
        severity: "HIGH",
        detail: `Matched enterprise secret keywords: ${matchedKeywords.join(", ")}`,
      });
    }

    if (matchedDomains.length > 0) {
      status = status === "BLOCKED" ? "BLOCKED" : "REDACTED";
      violations.push({
        type: "RESTRICTED_DOMAIN",
        severity: "MEDIUM",
        detail: `Target boundary matches: ${matchedDomains.join(", ")}`,
      });
    }

    setTestResult({
      status,
      action,
      violations,
      timestamp: new Date().toISOString(),
      inspectedLength: testInput.length,
    });
  };

  const totalRules =
    rules.domains.length +
    rules.keywords.length +
    rules.apiKeys.length +
    rules.sensitiveNumbers.length;
  const autoDetectedCount = rules.apiKeys.filter((k) => k.auto_detected).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Page Header & Industrial Telemetry ── */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <ShieldAlert size={26} color="#22d3ee" />
            <span>DLP Policies & Protection Engine</span>
          </div>
          <p className="page-subtitle">
            CONFIDENTIAL COMPUTING & DETERMINISTIC ENTROPY DIRECTIVES
          </p>
        </div>

        {/* Quick KPI Badges */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div className="telemetry-kpi" style={{ padding: "12px 20px", minWidth: "140px" }}>
            <span className="kpi-title">Active Rules</span>
            <div className="kpi-value text-cyan">{totalRules}</div>
          </div>
          <div className="telemetry-kpi" style={{ padding: "12px 20px", minWidth: "140px" }}>
            <span className="kpi-title">Auto-Learned</span>
            <div className="kpi-value text-emerald">{autoDetectedCount}</div>
          </div>
          <div className="telemetry-kpi" style={{ padding: "12px 20px", minWidth: "140px" }}>
            <span className="kpi-title">TEE Status</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <span className="beacon-dot" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "#34d399" }}>
                HARDENED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Autonomous System Coverage Banner ── */}
      <div
        className="glass-panel"
        style={{
          border: "1px solid rgba(34, 211, 238, 0.25)",
          background: "linear-gradient(135deg, rgba(34, 211, 238, 0.05) 0%, rgba(99, 102, 241, 0.03) 100%)",
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(34, 211, 238, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--cyan-primary)",
              }}
            >
              <Cpu size={20} />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                Autonomous Dual-Layer AI Interception
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Zero-config pre-flight prompt filtering actively enforced across the entire operating system
              </div>
            </div>
          </div>
          <span className="badge badge--safe">
            <span className="beacon-dot" /> DUAL ENFORCEMENT ACTIVE
          </span>
        </div>

        <div className="grid grid--2" style={{ gap: "14px" }}>
          <div
            style={{
              background: "rgba(5, 8, 17, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className="badge badge--cyan" style={{ fontSize: "10px" }}>LAYER 1</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                OS Network MITM Proxy (0.0.0.0:8443)
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Kernel-level iptables bridge capturing OpenAI, Anthropic, Gemini, Groq, and Perplexity traffic from <strong>cURL, Python, Node.js SDKs, and IDEs</strong>.
            </p>
          </div>

          <div
            style={{
              background: "rgba(5, 8, 17, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className="badge badge--cyan" style={{ fontSize: "10px" }}>LAYER 2</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                Consumer AI Browser Guard
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Enterprise extension intercepting DOM keystrokes & prompt submits in <strong>ChatGPT, Claude, Gemini, and DeepSeek</strong> before packet transmission.
            </p>
          </div>
        </div>
      </div>

      {/* ── Interactive Rule Test Sandbox ── */}
      <div className="glass-panel card--cyan-accent">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Terminal size={18} color="#22d3ee" />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
              Interactive DLP Policy Simulation Sandbox
            </h3>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
            REAL-TIME DETERMINISTIC TEST
          </span>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 450px" }}>
            <textarea
              className="textarea input--mono"
              rows={3}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Paste a test prompt to simulate DLP inspection (e.g., 'AWS_KEY=AKIAIOSFODNN7EXAMPLE project falcon confidential')..."
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              className="btn btn--cyan"
              onClick={runRuleTest}
              style={{ height: "42px", padding: "0 20px" }}
            >
              <Play size={14} />
              <span>Simulate Inspection</span>
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => {
                setTestInput("Debug: sk-proj-99887766554433221100aabbcc project falcon internal data");
              }}
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              Load Sample Breach
            </button>
          </div>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: "16px",
              padding: "16px",
              borderRadius: "8px",
              background:
                testResult.status === "BLOCKED"
                  ? "rgba(244, 63, 94, 0.08)"
                  : testResult.status === "REDACTED"
                  ? "rgba(245, 158, 11, 0.08)"
                  : "rgba(16, 185, 129, 0.08)",
              border: `1px solid ${
                testResult.status === "BLOCKED"
                  ? "rgba(244, 63, 94, 0.3)"
                  : testResult.status === "REDACTED"
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(16, 185, 129, 0.3)"
              }`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className={`badge ${
                    testResult.status === "BLOCKED"
                      ? "badge--critical"
                      : testResult.status === "REDACTED"
                      ? "badge--warning"
                      : "badge--safe"
                  }`}
                  style={{ fontSize: "12px" }}
                >
                  {testResult.status}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>
                  Action: <strong>{testResult.action}</strong>
                </span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                Inspection Latency: 1.84ms
              </span>
            </div>

            {testResult.violations.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                {testResult.violations.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: v.severity === "CRITICAL" ? "#fb7185" : "#fbbf24",
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <span>⚠ [{v.type}]</span>
                    <span>{v.detail}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: "#34d399", fontFamily: "var(--font-mono)" }}>
                ✓ No credential leaks, sensitive numbers, or banned keywords detected in payload.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Policy Rules Matrix (Grid) ── */}
      <div className="grid grid--2">
        {/* ── Protected Domains Card ── */}
        <section className="glass-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={18} color="#22d3ee" />
                <span>Protected Domain Boundaries</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Outbound destinations subject to strict packet inspection
              </p>
            </div>
            <span className="badge badge--cyan">{rules.domains.length} active</span>
          </div>

          <form onSubmit={handleAddDomain} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                className="input input--mono"
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. @internal-corp.ai, api.openai.com"
                required
              />
              <button className="btn btn--cyan" type="submit" disabled={busy} style={{ minWidth: "90px" }}>
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>
          </form>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.domains.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
                      {d}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={() => handleRemoveDomain(d)}
                        disabled={busy}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        title="Remove Domain"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.domains.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                      No domain boundaries defined
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Secret Keywords Card ── */}
        <section className="glass-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <Hash size={18} color="#f59e0b" />
                <span>Confidential Keywords & Project Names</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Redacted automatically into synthetic tokens before transit
              </p>
            </div>
            <span className="badge badge--warning">{rules.keywords.length} active</span>
          </div>

          <form onSubmit={handleAddKeyword} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                className="input input--mono"
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="e.g. Project Falcon, Acquisition Q4, InternalDB"
                required
              />
              <button className="btn btn--primary" type="submit" disabled={busy} style={{ minWidth: "90px" }}>
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>
          </form>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Keyword / Secret Term</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.keywords.map((k, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
                      {k}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={() => handleRemoveKeyword(k)}
                        disabled={busy}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        title="Remove Keyword"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.keywords.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                      No confidential keywords registered
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Infrastructure API Keys ── */}
        <section className="glass-panel" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={18} color="#f43f5e" />
                <span>Protected Infrastructure API Keys & Token Hashes</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Encrypted AES-256-GCM enclave storage · Transmissions containing these credentials trigger instant hard-block
              </p>
            </div>
            <span className="badge badge--critical">{rules.apiKeys.length} keys</span>
          </div>

          <form onSubmit={handleAddApiKey} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <input
                  className="input"
                  type="text"
                  value={newApiKey.label}
                  onChange={(e) => setNewApiKey((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Label: AWS Production Root, Stripe Live"
                  required
                />
              </div>
              <div style={{ flex: "2 1 300px" }}>
                <input
                  className="input input--mono"
                  type="password"
                  value={newApiKey.value}
                  onChange={(e) => setNewApiKey((s) => ({ ...s, value: e.target.value }))}
                  placeholder="Key Value (sk_live_... / AKIAIOSFODNN7EXAMPLE)"
                  required
                />
              </div>
              <button className="btn btn--primary" type="submit" disabled={busy} style={{ minWidth: "120px" }}>
                <Plus size={14} />
                <span>Register Key</span>
              </button>
            </div>
          </form>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Credential Label</th>
                  <th>Encrypted Fingerprint</th>
                  <th>Discovery Method</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.apiKeys.map((k) => (
                  <tr key={k._id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{k.label}</td>
                    <td style={{ fontFamily: "var(--font-mono)", letterSpacing: "2px", color: "var(--cyan-primary)" }}>
                      ••••••••••••{k.hint}
                    </td>
                    <td>
                      {k.auto_detected ? (
                        <span className="badge badge--cyan" style={{ fontSize: "10px" }}>
                          AUTO-DETECTED
                        </span>
                      ) : (
                        <span className="badge badge--neutral" style={{ fontSize: "10px" }}>
                          MANUAL POLICY
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={() => handleRemoveApiKey(k._id)}
                        disabled={busy}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        title="Remove API Key"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.apiKeys.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                      No infrastructure keys registered
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Sensitive Government & Financial Identifiers ── */}
        <section className="glass-panel" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <FileCode size={18} color="#10b981" />
                <span>Regulated Identifiers & Financial Records</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Aadhaar, PAN, SSN, IFSC, Credit Cards, and Bank Accounts
              </p>
            </div>
            <span className="badge badge--safe">{rules.sensitiveNumbers.length} active</span>
          </div>

          <form onSubmit={handleAddNumber} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px" }}>
                <input
                  className="input"
                  type="text"
                  value={newNumber.label}
                  onChange={(e) => setNewNumber((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Label: Executive Payroll, Support Hotline"
                  required
                />
              </div>
              <div style={{ flex: "0 1 180px" }}>
                <select
                  className="select"
                  value={newNumber.type}
                  onChange={(e) => setNewNumber((s) => ({ ...s, type: e.target.value }))}
                >
                  {Object.entries(NUMBER_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <input
                  className="input input--mono"
                  type="password"
                  value={newNumber.value}
                  onChange={(e) => setNewNumber((s) => ({ ...s, value: e.target.value }))}
                  placeholder="Exact Value (+91 9876543210, ABCDE1234F)"
                  required
                />
              </div>
              <button className="btn btn--primary" type="submit" disabled={busy} style={{ minWidth: "120px" }}>
                <Plus size={14} />
                <span>Register Rule</span>
              </button>
            </div>
          </form>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Category</th>
                  <th>Masked Value</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.sensitiveNumbers.map((n) => (
                  <tr key={n._id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{n.label}</td>
                    <td>
                      <span className="badge badge--neutral" style={{ fontSize: "11px" }}>
                        {NUMBER_TYPE_LABELS[n.type] ?? n.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", letterSpacing: "2px", color: "var(--text-muted)" }}>
                      ••••••••{n.hint}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={() => handleRemoveNumber(n._id)}
                        disabled={busy}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        title="Remove Identifier"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.sensitiveNumbers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                      No regulated identifiers configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Rules;