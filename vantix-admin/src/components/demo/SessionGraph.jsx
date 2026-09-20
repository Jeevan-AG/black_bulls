import React, { useMemo } from "react";

// ─── Session Graph (Force-Directed Topic Visualization) ──────────────────────
// Growing visualization of semantic topic clusters covered across prompts.
// Nodes = topic categories, size grows with coverage, red when > threshold.
// Edges = co-occurrence between topics.

const TOPIC_POSITIONS = {
  OT_ARCHITECTURE:      { x: 200, y: 60 },
  CREDENTIALS:          { x: 340, y: 100 },
  NETWORK_TOPOLOGY:     { x: 320, y: 220 },
  OPERATIONAL_PROCEDURES: { x: 200, y: 280 },
  DEVICE_CONFIG:        { x: 80, y: 220 },
  PHYSICAL_LOCATION:    { x: 60, y: 100 },
  CONTROL_LOGIC:        { x: 140, y: 160 },
  SENSOR_DATA:          { x: 260, y: 160 },
};

const TOPIC_LABELS = {
  OT_ARCHITECTURE:      "OT Architecture",
  CREDENTIALS:          "Credentials",
  NETWORK_TOPOLOGY:     "Network Topology",
  OPERATIONAL_PROCEDURES: "Procedures",
  DEVICE_CONFIG:        "Device Config",
  PHYSICAL_LOCATION:    "Location",
  CONTROL_LOGIC:        "Control Logic",
  SENSOR_DATA:          "Sensor Data",
};

function nodeColor(coverage) {
  if (coverage > 0.6) return "#ef4444";
  if (coverage > 0.3) return "#f59e0b";
  if (coverage > 0.1) return "#22d3ee";
  return "#334155";
}

export default function SessionGraphViz({ graphData }) {
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const nodeMap = useMemo(() => {
    const m = {};
    nodes.forEach((n) => { m[n.id] = n; });
    return m;
  }, [nodes]);

  return (
    <div className="demo-panel session-graph">
      <div className="demo-panel-header">
        <span className="demo-panel-dot" style={{ background: "#4ade80" }} />
        <span>SESSION GRAPH</span>
      </div>
      <div className="demo-panel-body" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <svg width="400" height="320" viewBox="0 0 400 320">
          {/* Edges */}
          {edges.map((edge, i) => {
            const from = TOPIC_POSITIONS[edge.source];
            const to = TOPIC_POSITIONS[edge.target];
            if (!from || !to) return null;
            return (
              <line
                key={`sg-edge-${i}`}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="rgba(34, 211, 238, 0.25)"
                strokeWidth={1 + Math.min(edge.weight, 5) * 0.6}
                className="sg-edge-animate"
              />
            );
          })}

          {/* Nodes */}
          {Object.entries(TOPIC_POSITIONS).map(([topicId, pos]) => {
            const node = nodeMap[topicId];
            const coverage = node?.coverage || 0;
            const r = 12 + coverage * 28;
            const color = nodeColor(coverage);
            const label = TOPIC_LABELS[topicId] || topicId;

            return (
              <g key={topicId}>
                {/* Outer glow for active nodes */}
                {coverage > 0.1 && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r + 10}
                    fill={color} opacity={0.1}
                    className="sg-glow"
                  />
                )}
                {/* Pulse ring for critical */}
                {coverage > 0.5 && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r + 6}
                    fill="none" stroke={color} strokeWidth="1"
                    opacity={0.4}
                    className="sg-pulse"
                  />
                )}
                {/* Main node */}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={coverage > 0.1 ? color : "#1e293b"}
                  stroke={color}
                  strokeWidth={coverage > 0.1 ? 2 : 1}
                  opacity={coverage > 0.1 ? 0.9 : 0.3}
                />
                {/* Coverage % inside node */}
                {coverage > 0.1 && (
                  <text
                    x={pos.x} y={pos.y + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="700"
                  >
                    {Math.round(coverage * 100)}%
                  </text>
                )}
                {/* Label below */}
                <text
                  x={pos.x} y={pos.y + r + 14}
                  textAnchor="middle"
                  fill={coverage > 0.1 ? "#f8fafc" : "#64748b"}
                  fontSize="9"
                  fontFamily="'Inter', sans-serif"
                  fontWeight="500"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
