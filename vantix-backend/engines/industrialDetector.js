// ─── Vantix — 3-Sublayer Industrial Detection Engine ─────────────────────────
// Sublayer A: Rule-based regex pattern detection (OT/ICS/SCADA + credentials)
// Sublayer B: Contextual NLP scoring (industrial terminology clusters)
// Sublayer C: Combination risk scoring (isolation vs. combined risk)
//
// Returns: { overallRisk, detections[], combinations[], riskBreakdown }
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ─── Sublayer A: Rule-Based Industrial Pattern Detection ─────────────────────
// Fast deterministic regex matching — runs in microseconds.

const INDUSTRIAL_PATTERNS = {
  // OT / ICS / SCADA
  REGISTER_ADDR: {
    patterns: [
      /\b0x[0-9A-Fa-f]{4,}\b/g,                          // Hex register: 0x4001
      /\b(?:modbus|holding|input|scada)\s+(?:register\s+)?(?:address\s*)?[:=]?\s*[34][0-9]{4}\b/gi, // Modbus register with context
      /\b(?:holding\s+register|register\s+number)\s+[34][0-9]{4}\b/gi,
      /\bregister\s+(?:address\s+)?(?:0x)?[0-9A-Fa-f]{3,}/gi, // "register 0x4001"
    ],
    category: "REGISTER_ADDR",
    label: "Register Address",
    baseRisk: 25,
  },
  DNP3_IDENTIFIER: {
    patterns: [
      /\bdnp3[:\s]+[0-9.]+/gi,
      /\bdnp3\s+(?:address|point|index)\s*[:=]?\s*\d+/gi,
    ],
    category: "REGISTER_ADDR",
    label: "DNP3 Identifier",
    baseRisk: 30,
  },
  OPC_UA: {
    patterns: [
      /\bopc[:\s]*ua[:\s]+[^\s]+/gi,
      /\bns=\d+;[si]=.+/g,                                // OPC-UA node ID
    ],
    category: "REGISTER_ADDR",
    label: "OPC-UA Identifier",
    baseRisk: 30,
  },

  // Electrical / Physical parameters
  ELECTRICAL_PARAM: {
    patterns: [
      /\b\d+\.?\d*\s*(?:kV|mV|V|kA|mA|A|MW|kW|W|Hz|kHz|MHz|GHz|Ohm|Ω)\b/gi,
      /\b(?:voltage|current|frequency|impedance|resistance)\s*[:=]?\s*\d+\.?\d*/gi,
      /\bthreshold\s*[:=]?\s*\d+\.?\d*\s*(?:V|A|W|Hz)?/gi,
      /\bsetpoint\s*[:=]?\s*\d+\.?\d*/gi,
    ],
    category: "ELECTRICAL_PARAM",
    label: "Electrical Parameter",
    baseRisk: 20,
  },
  PRESSURE_PARAM: {
    patterns: [
      /\b\d+\.?\d*\s*(?:PSI|psi|bar|kPa|MPa|atm)\b/g,
      /\b(?:pressure)\s*[:=]?\s*\d+\.?\d*/gi,
    ],
    category: "ELECTRICAL_PARAM",
    label: "Pressure Parameter",
    baseRisk: 20,
  },
  TEMPERATURE_PARAM: {
    patterns: [
      /\b\d+\.?\d*\s*°?[CF]\b/g,
      /\b(?:temperature|temp)\s*[:=]?\s*\d+\.?\d*/gi,
    ],
    category: "ELECTRICAL_PARAM",
    label: "Temperature Parameter",
    baseRisk: 15,
  },

  // Device identifiers
  DEVICE_TYPE: {
    patterns: [
      /\b(?:turbine|generator|transformer|breaker|relay|pump|compressor|valve|actuator|motor|controller|PLC|RTU|HMI|DCS|SCADA)\s*(?:controller|unit|system|module|panel)?/gi,
      /\b(?:heat\s+exchanger|steam\s+line|cooling\s+tower|boiler|condenser)\b/gi,
    ],
    category: "DEVICE_TYPE",
    label: "Device Type",
    baseRisk: 15,
  },
  FIRMWARE_VERSION: {
    patterns: [
      /\b(?:firmware|fw|software|sw)\s*(?:version|ver|v)\s*[:=]?\s*[\d.]+/gi,
      /\bv\d+\.\d+\.\d+(?:-[a-z0-9]+)?\b/gi,
    ],
    category: "DEVICE_TYPE",
    label: "Firmware Version",
    baseRisk: 25,
  },
  SERIAL_NUMBER: {
    patterns: [
      /\b(?:serial|sn|s\/n)\s*[:=]?\s*[A-Z0-9\-]{6,}/gi,
    ],
    category: "DEVICE_TYPE",
    label: "Serial Number",
    baseRisk: 30,
  },

  // Location identifiers
  LOCATION: {
    patterns: [
      /\b(?:plant|site|facility|station|substation|unit|zone|area|building|floor)\s+(?:[A-Z0-9][\w\-]*)/gi,
      /\b(?:site|plant)\s+[A-Z]\b/gi,                     // "site B", "plant A"
    ],
    category: "LOCATION",
    label: "Physical Location",
    baseRisk: 20,
  },
  GPS_COORD: {
    patterns: [
      /[-+]?\d{1,3}\.\d{4,}\s*,\s*[-+]?\d{1,3}\.\d{4,}/g,
    ],
    category: "LOCATION",
    label: "GPS Coordinates",
    baseRisk: 40,
  },

  // Network / Infrastructure
  NETWORK_ADDR: {
    patterns: [
      /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g,
      /\b(?:subnet|vlan|gateway)\s*[:=]?\s*[\d.\/]+/gi,
    ],
    category: "NETWORK_ADDR",
    label: "Internal Network Address",
    baseRisk: 35,
  },

  // Credentials
  NATURAL_LANGUAGE_CREDENTIAL: {
    patterns: [
      /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:aws|openai|anthropic|api|secret|access|private)\s*(?:access\s*)?(?:key|id|secret|token)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:password|token|secret|credential|api_key)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      /\b(?:aws_key|aws_id|secret_key|api_key|access_key)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    ],
    category: "CREDENTIAL",
    label: "Exposed Credential",
    baseRisk: 90,
  },
  API_KEY: {
    patterns: [
      /\b(?:sk-[A-Za-z0-9_\-]{20,})/g,                   // OpenAI legacy, Anthropic
      /\b(?:sk-proj-[A-Za-z0-9_\-]{30,})/g,              // OpenAI Project API Key
      /\b(?:sk_(?:live|test)_[A-Za-z0-9_\-]{24,})/g,     // Stripe
      /\b(?:AIza[A-Za-z0-9_\-]{35})/g,                    // Google Cloud / Gemini
      /\b(?:AKIA[A-Z0-9]{16})/g,                          // AWS Access Key
      /\b(?:ghp_[A-Za-z0-9]{36,})/g,                      // GitHub Personal Access Token
      /\b(?:xox[baprs]-[A-Za-z0-9\-]{10,})/g,            // Slack Bot / User Token
      /\b(?:hf_[A-Za-z0-9]{34,})/g,                       // HuggingFace Token
    ],
    category: "CREDENTIAL",
    label: "API Key",
    baseRisk: 90,
  },
  PASSWORD_SECRET: {
    patterns: [
      /(?:password|passwd|secret_key|client_secret|auth_token|secret_access_key|api_secret|aws_secret_access_key)\s*[:=]\s*(?:['"][^'"]{4,}['"]|[A-Za-z0-9\/+=_\-@#$!%*?&]{6,})/gi,
      /(?:aws_secret_access_key|aws_secret|secret_key)\s*[:=]\s*[A-Za-z0-9\/+=]{20,}/gi,
    ],
    category: "CREDENTIAL",
    label: "Secret Assignment",
    baseRisk: 90,
  },
  PRIVATE_KEY: {
    patterns: [
      /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|PUBLIC)\s+KEY-----/g,
      /-----BEGIN\s+CERTIFICATE-----/g,
    ],
    category: "CREDENTIAL",
    label: "Private Key / Certificate",
    baseRisk: 95,
  },
  CONNECTION_STRING: {
    patterns: [
      /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    ],
    category: "CREDENTIAL",
    label: "Database Connection String",
    baseRisk: 90,
  },
  JWT_TOKEN: {
    patterns: [
      /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    ],
    category: "CREDENTIAL",
    label: "JWT Token",
    baseRisk: 85,
  },

  // Financial & Banking
  CREDIT_CARD: {
    patterns: [
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
      /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2})[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b/g,
    ],
    category: "FINANCIAL",
    label: "Credit Card Number",
    baseRisk: 85,
  },
  IBAN: {
    patterns: [
      /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g,
    ],
    category: "FINANCIAL",
    label: "IBAN Bank Account",
    baseRisk: 75,
  },

  // PII
  EMAIL: {
    patterns: [
      /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,
    ],
    category: "PII",
    label: "Email Address",
    baseRisk: 45,
  },
  PHONE: {
    patterns: [
      /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
      /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g,
      /(?:\+\d{1,3}[\s-]?)?\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g,
    ],
    category: "PII",
    label: "Phone Number",
    baseRisk: 45,
  },
  PERSONAL_IDENTIFIER: {
    patterns: [
      /(?:patient|customer|employee|client|user)\s+(?:name|fullname|full\s+name)\s*[:=]\s*['"]?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})['"]?/gi,
      /(?:passport|driver'?s?\s+license|national\s+id)\s*(?:number|no|#)?\s*[:=]?\s*[A-Z0-9]{6,12}\b/gi,
      /\b(?:dob|date\s+of\s+birth)\s*[:=]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    ],
    category: "PII",
    label: "Personal Identifier",
    baseRisk: 50,
  },
  SSN: {
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/g,
    ],
    category: "CRITICAL_PII",
    label: "US Social Security Number",
    baseRisk: 85,
  },
  AADHAAR: {
    patterns: [
      /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g,
    ],
    category: "CRITICAL_PII",
    label: "Aadhaar Number",
    baseRisk: 75,
  },
  PAN: {
    patterns: [
      /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    ],
    category: "CRITICAL_PII",
    label: "PAN Number",
    baseRisk: 70,
  },

  // Adversarial AI / Prompt Injection
  PROMPT_INJECTION: {
    patterns: [
      /(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt\s+override|disregard\s+all\s+prior\s+prompts|DAN\s+mode|jailbreak|unrestricted\s+developer\s+mode|simulate\s+unfiltered|bypass\s+(?:all\s+)?safety\s+filters)/gi,
    ],
    category: "PROMPT_INJECTION",
    label: "Prompt Injection Attack",
    baseRisk: 95,
  },
};


// ─── Sublayer B: Contextual Industrial NLP Scoring ───────────────────────────
// Weighted keyword-cluster recognizer for industrial terminology.
// When industrial terms co-occur, the context score rises.

const INDUSTRIAL_CONTEXT_CLUSTERS = {
  OT_ARCHITECTURE: {
    keywords: [
      "scada", "plc", "rtu", "hmi", "dcs", "ics", "ot network",
      "control loop", "cascade control", "pid controller", "feedback loop",
      "supervisory control", "data acquisition", "modbus", "dnp3", "opc",
      "profinet", "ethernet/ip", "fieldbus",
    ],
    weight: 1.5,
  },
  CONTROL_LOGIC: {
    keywords: [
      "setpoint", "threshold", "tripping", "trip", "interlock",
      "cascade", "primary loop", "secondary loop", "control valve",
      "dead band", "hysteresis", "ramp rate", "alarm limit",
      "override", "failsafe", "shutdown sequence",
    ],
    weight: 1.3,
  },
  PHYSICAL_PROCESS: {
    keywords: [
      "turbine", "generator", "transformer", "boiler", "condenser",
      "heat exchanger", "cooling tower", "steam line", "compressor",
      "pump station", "valve actuator", "pressure vessel",
      "combustion", "distillation", "refinery", "reactor",
    ],
    weight: 1.2,
  },
  NETWORK_TOPOLOGY: {
    keywords: [
      "subnet", "vlan", "gateway", "firewall rule", "dmz",
      "network segment", "air gap", "jump host", "bastion",
      "historian server", "engineering workstation",
    ],
    weight: 1.4,
  },
  OPERATIONAL_PROCEDURE: {
    keywords: [
      "maintenance schedule", "startup sequence", "shutdown procedure",
      "calibration", "commissioning", "decommission",
      "emergency procedure", "incident response", "changeover",
      "lockout tagout", "safety instrumented",
    ],
    weight: 1.1,
  },
  SENSOR_DATA: {
    keywords: [
      "sensor reading", "measurement", "analog input", "digital input",
      "4-20ma", "0-10v", "thermocouple", "rtd", "strain gauge",
      "flow meter", "level transmitter", "pressure transmitter",
    ],
    weight: 1.2,
  },
};


// ─── Sublayer C: Combination Risk Scoring ────────────────────────────────────
// The core innovation — individual values scored in isolation, then re-scored
// based on what other categories appear alongside them.

const COMBINATION_MATRIX = {
  // [categoryA, categoryB] → risk multiplier
  "REGISTER_ADDR+ELECTRICAL_PARAM":  1.8,
  "REGISTER_ADDR+DEVICE_TYPE":       1.6,
  "REGISTER_ADDR+LOCATION":          1.9,
  "ELECTRICAL_PARAM+DEVICE_TYPE":    1.5,
  "ELECTRICAL_PARAM+LOCATION":       1.7,
  "DEVICE_TYPE+LOCATION":            1.6,
  "NETWORK_ADDR+LOCATION":           2.0,
  "NETWORK_ADDR+CREDENTIAL":         2.5,
  "CREDENTIAL+LOCATION":             2.2,
  "REGISTER_ADDR+NETWORK_ADDR":      2.0,
  "FINANCIAL+CREDENTIAL":            2.5,
  "FINANCIAL+PII":                   2.0,
  "PII+NETWORK_ADDR":                1.8,
  "PII+CREDENTIAL":                  2.4,
  "PII+LOCATION":                    1.7,
  "PROMPT_INJECTION+CREDENTIAL":     3.2,
  "PROMPT_INJECTION+NETWORK_ADDR":   2.8,
  "PROMPT_INJECTION+REGISTER_ADDR":  2.8,

  // Triple+ combinations get maximum escalation
  "REGISTER_ADDR+ELECTRICAL_PARAM+DEVICE_TYPE":           2.5,
  "REGISTER_ADDR+ELECTRICAL_PARAM+LOCATION":              2.8,
  "REGISTER_ADDR+ELECTRICAL_PARAM+DEVICE_TYPE+LOCATION":  3.5,   // CRITICAL fingerprint
  "REGISTER_ADDR+DEVICE_TYPE+LOCATION":                   2.6,
  "NETWORK_ADDR+CREDENTIAL+LOCATION":                     3.0,
  "FINANCIAL+CREDENTIAL+PII":                             3.2,
  "FINANCIAL+CREDENTIAL+CRITICAL_PII":                    3.5,
  "FINANCIAL+CRITICAL_PII":                               2.5,
  "CREDENTIAL+CRITICAL_PII":                              2.8,
};


// ─── Main Detection Function ─────────────────────────────────────────────────

/**
 * Analyze text through all 3 sublayers.
 *
 * @param {string} text — The raw prompt text
 * @returns {{ overallRisk: number, detections: object[], combinations: object[], contextScore: number, riskBreakdown: object, categoriesFound: string[] }}
 */
function analyzePrompt(text) {
  if (!text || typeof text !== "string") {
    return { overallRisk: 0, detections: [], combinations: [], contextScore: 0, riskBreakdown: {}, categoriesFound: [] };
  }

  // ── Sublayer A: Pattern matching ──────────────────────────────────────────
  const rawDetections = [];
  const seen = new Set();

  for (const [patternName, config] of Object.entries(INDUSTRIAL_PATTERNS)) {
    for (const regex of config.patterns) {
      // Reset regex state
      const re = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = re.exec(text)) !== null) {
        const matchedStr = match[0];

        // Skip sanitized placeholder tokens like [REGISTER_ADDR], [SCADA_REG_01], [AWS_KEY_01], [SANITIZED], etc.
        if (/^['"]?\[[A-Z0-9_]+\]['"]?$/.test(matchedStr.trim())) {
          continue;
        }

        // Check if value is a secret assignment whose assigned RHS is purely a placeholder token
        if (config.category === "CREDENTIAL" && /[:=]\s*['"]?\[[A-Z0-9_]+\]['"]?\s*$/.test(matchedStr.trim())) {
          continue;
        }

        // Also check if match is enclosed within a bracketed placeholder token like [SCADA_REG_01]
        const matchStart = match.index;
        const matchEnd = match.index + matchedStr.length;
        const prevBracket = text.lastIndexOf("[", matchStart);
        const nextBracket = text.indexOf("]", matchEnd - 1);
        if (prevBracket !== -1 && nextBracket !== -1 && prevBracket < matchStart && nextBracket >= matchEnd - 1) {
          const enclosed = text.slice(prevBracket, nextBracket + 1);
          if (/^\[[A-Z0-9_]+\]$/.test(enclosed)) {
            continue; // The match is part of an already sanitized placeholder token!
          }
        }

        let value = matchedStr;
        let valStart = match.index;
        let valEnd = match.index + matchedStr.length;

        // If pattern is a credential assignment with capture group, extract the actual secret token
        if (config.category === "CREDENTIAL" && match[1] && match[1].length >= 4) {
          const captured = match[1];
          const offsetInMatch = match[0].indexOf(captured);
          if (offsetInMatch !== -1) {
            value = captured;
            valStart = match.index + offsetInMatch;
            valEnd = valStart + captured.length;
          }
        }

        const key = `${config.category}:${value}`;
        if (!seen.has(key)) {
          seen.add(key);
          rawDetections.push({
            patternName,
            category: config.category,
            label: config.label,
            value,
            start: valStart,
            end: valEnd,
            isolationRisk: config.baseRisk,
          });
        }
      }
    }
  }

  // Deduplicate overlapping detections: keep longer span or higher risk
  const deduped = [];
  rawDetections.sort((a, b) => (b.end - b.start) - (a.end - a.start) || b.isolationRisk - a.isolationRisk);
  for (const det of rawDetections) {
    const overlaps = deduped.some((existing) => (det.start >= existing.start && det.end <= existing.end));
    if (!overlaps) {
      deduped.push(det);
    }
  }
  deduped.sort((a, b) => a.start - b.start);
  const detections = deduped;

  // ── Sublayer B: Contextual NLP scoring ────────────────────────────────────
  const lowerText = text.toLowerCase();
  let contextScore = 0;
  const triggeredClusters = [];

  for (const [clusterName, cluster] of Object.entries(INDUSTRIAL_CONTEXT_CLUSTERS)) {
    let clusterHits = 0;
    for (const keyword of cluster.keywords) {
      if (lowerText.includes(keyword)) {
        clusterHits++;
      }
    }
    if (clusterHits > 0) {
      const clusterScore = Math.min(clusterHits * 8, 40) * cluster.weight;
      contextScore += clusterScore;
      triggeredClusters.push({ cluster: clusterName, hits: clusterHits, score: Math.round(clusterScore) });
    }
  }
  contextScore = Math.min(Math.round(contextScore), 100);

  // ── Sublayer C: Combination risk scoring ──────────────────────────────────
  const categoriesFound = [...new Set(detections.map((d) => d.category))];
  const combinations = [];
  let maxCombinationMultiplier = 1.0;

  // Sort categories for consistent key generation
  const sortedCategories = [...categoriesFound].sort();

  // Check all pair and triple+ combinations
  for (const [comboKey, multiplier] of Object.entries(COMBINATION_MATRIX)) {
    const comboCategories = comboKey.split("+");
    const allPresent = comboCategories.every((cat) => categoriesFound.includes(cat));
    if (allPresent) {
      combinations.push({
        categories: comboCategories,
        multiplier,
        label: comboCategories.map((c) => c.replace(/_/g, " ")).join(" + "),
      });
      if (multiplier > maxCombinationMultiplier) {
        maxCombinationMultiplier = multiplier;
      }
    }
  }

  // ── Calculate final risk score ────────────────────────────────────────────
  // Categories that constitute genuine confidential data, credentials, or dangerous exfiltration:
  const activeConfidentialCategories = new Set([
    "CREDENTIAL",
    "FINANCIAL",
    "CRITICAL_PII",
    "PII",
    "REGISTER_ADDR",
    "PROMPT_INJECTION",
  ]);

  // Internal network addresses are confidential ONLY when paired with industrial equipment,
  // register addresses, credentials, or explicit corporate endpoints
  const hasInfrastructureContext = detections.some((d) =>
    ["CREDENTIAL", "FINANCIAL", "CRITICAL_PII", "REGISTER_ADDR", "DEVICE_TYPE"].includes(d.category)
  ) || lowerText.includes(".internal") || lowerText.includes(".corp");

  if (hasInfrastructureContext) {
    activeConfidentialCategories.add("NETWORK_ADDR");
  }

  const hasConfidentialData = detections.some((d) => activeConfidentialCategories.has(d.category));

  // If NO confidential data or credentials were tried to be leaked (e.g. harmless prompt,
  // normal generic technical words like "pump", "turbine", or "voltage", or already sanitized prompt),
  // DO NOT raise risk! Return overallRisk = 0.
  if (!hasConfidentialData) {
    return {
      overallRisk: 0,
      detections,
      combinations: [],
      contextScore,
      triggeredClusters,
      riskBreakdown: {},
      categoriesFound,
    };
  }

  // Base = max isolation risk among confidential detections ONLY
  const confidentialDetections = detections.filter((d) => activeConfidentialCategories.has(d.category));
  const maxIsolationRisk = Math.max(...confidentialDetections.map((d) => d.isolationRisk));

  // Combined risk = base * combination multiplier
  let combinedRisk = maxIsolationRisk * maxCombinationMultiplier;

  // Multi-factor boost for Section 06 spec (register + electrical + device + location)
  if (maxCombinationMultiplier >= 3.0 && contextScore > 0) {
    combinedRisk += Math.min(contextScore * 0.2, 12);
  } else if (contextScore > 0 && maxIsolationRisk >= 50) {
    combinedRisk += Math.min(contextScore * 0.08, 8);
  }

  const overallRisk = Math.min(Math.round(combinedRisk), 100);

  // Build risk breakdown
  const riskBreakdown = {};
  for (const det of detections) {
    if (!riskBreakdown[det.category]) {
      riskBreakdown[det.category] = {
        isolationRisk: det.isolationRisk,
        combinedRisk: Math.min(Math.round(det.isolationRisk * maxCombinationMultiplier), 100),
        values: [],
      };
    }
    riskBreakdown[det.category].values.push(det.value);
  }

  return {
    overallRisk,
    detections,
    combinations,
    contextScore,
    triggeredClusters,
    riskBreakdown,
    categoriesFound,
  };
}


// ─── Semantic Category Mapping ───────────────────────────────────────────────
// Maps categories and patterns to their exact, accurate semantic placeholder tags.

const PATTERN_PLACEHOLDERS = {
  PHONE: "PHONE_NUMBER",
  EMAIL: "EMAIL_ADDRESS",
  AADHAAR: "AADHAAR_NUMBER",
  PAN: "PAN_NUMBER",
  SSN: "SSN_NUMBER",
  CREDIT_CARD: "CREDIT_DEBIT_CARD",
  IBAN: "BANK_ACCOUNT_IBAN",
  PASSWORD_SECRET: "PASSWORD",
  PRIVATE_KEY: "PRIVATE_KEY",
  CONNECTION_STRING: "DB_CONNECTION_STRING",
  JWT_TOKEN: "JWT_AUTH_TOKEN",
  REGISTER_ADDR: "REGISTER_ADDR",
  DNP3_IDENTIFIER: "DNP3_IDENTIFIER",
  OPC_UA: "OPC_UA_NODE",
  NETWORK_ADDR: "IP_ADDRESS",
  ELECTRICAL_PARAM: "ELECTRICAL_PARAM",
  PRESSURE_PARAM: "PRESSURE_PARAM",
  TEMPERATURE_PARAM: "TEMPERATURE_PARAM",
  DEVICE_TYPE: "DEVICE_TYPE",
  FIRMWARE_VERSION: "FIRMWARE_VERSION",
  SERIAL_NUMBER: "SERIAL_NUMBER",
  LOCATION: "LOCATION",
  GPS_COORD: "GPS_COORDINATES",
  PERSONAL_IDENTIFIER: "PERSONAL_NAME",
};

const CATEGORY_PLACEHOLDERS = {
  REGISTER_ADDR:    "REGISTER_ADDR",
  ELECTRICAL_PARAM: "ELECTRICAL_PARAM",
  DEVICE_TYPE:      "DEVICE_TYPE",
  LOCATION:         "LOCATION",
  NETWORK_ADDR:     "IP_ADDRESS",
  CREDENTIAL:       "API_KEY",
  CRITICAL_PII:     "AADHAAR_NUMBER",
  PII:              "PERSONAL_DATA",
  FINANCIAL:        "CREDIT_DEBIT_CARD",
  PROMPT_INJECTION: "PROMPT_INJECTION_FLAG",
  SENSOR_DATA:      "SENSOR_DATA",
};

function resolvePlaceholderForDetection(det, fullText = "") {
  if (!det) return "CONFIDENTIAL_DATA";

  // Dynamic context for natural language credentials
  if (det.patternName === "NATURAL_LANGUAGE_CREDENTIAL") {
    const start = Math.max(0, (det.start || 0) - 50);
    const end = Math.min((fullText || "").length, (det.end || 0) + 25);
    const ctx = (fullText || "").slice(start, end).toLowerCase();

    if (ctx.includes("aws")) return "AWS_KEY";
    if (ctx.includes("openai")) return "OPENAI_API_KEY";
    if (ctx.includes("anthropic") || ctx.includes("claude")) return "ANTHROPIC_API_KEY";
    if (ctx.includes("password") || ctx.includes("passwd")) return "PASSWORD";
    if (ctx.includes("token")) return "AUTH_TOKEN";
    if (ctx.includes("secret")) return "SECRET_KEY";
    if (ctx.includes("api")) return "API_KEY";
    return "API_KEY";
  }

  if (det.patternName === "API_KEY") {
    const val = det.value || "";
    if (val.startsWith("AKIA")) return "AWS_ACCESS_KEY";
    if (val.startsWith("sk-proj-") || val.startsWith("sk-")) return "OPENAI_API_KEY";
    if (val.startsWith("ghp_")) return "GITHUB_TOKEN";
    if (val.startsWith("AIza")) return "GOOGLE_API_KEY";
    return "API_KEY";
  }

  if (PATTERN_PLACEHOLDERS[det.patternName]) {
    return PATTERN_PLACEHOLDERS[det.patternName];
  }

  if (CATEGORY_PLACEHOLDERS[det.category]) {
    return CATEGORY_PLACEHOLDERS[det.category];
  }

  return det.category || "CONFIDENTIAL_DATA";
}


module.exports = {
  analyzePrompt,
  INDUSTRIAL_PATTERNS,
  INDUSTRIAL_CONTEXT_CLUSTERS,
  COMBINATION_MATRIX,
  CATEGORY_PLACEHOLDERS,
  PATTERN_PLACEHOLDERS,
  resolvePlaceholderForDetection,
};
