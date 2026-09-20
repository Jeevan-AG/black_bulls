import React, { useMemo } from "react";

// ─── Combination Risk Graph ──────────────────────────────────────────────────
// Visual node graph showing how individual low-risk values combine to produce
// a high risk score. Nodes = detected categories, edges = co-occurrence.

const NODE_COLORS = {
  REGISTER_ADDR: "#22d3ee",
  ELECTRICAL_PARAM: "#f59e0b",
  DEVICE_TYPE: "#a78bfa",
  LOCATION: "#f472b6",
  NETWORK_ADDR: "#4ade80",
  CREDENTIAL: "#ef4444",
  PII: "#94a3b8",
  SENSOR_DATA: "#fb923c",
};

const NODE_POSITIONS = {
  REGISTER_ADDR:    { x: 140, y: 50 },
  ELECTRICAL_PARAM: { x: 260, y: 50 },
  DEVICE_TYPE:      { x: 80, y: 140 },
  LOCATION:         { x: 320, y: 140 },
  NETWORK_ADDR:     { x: 140, y: 220 },
  CREDENTIAL:       { x: 260, y: 220 },
  PII:              { x: 200, y: 280 },
  SENSOR_DATA:      { x: 50, y: 220 },
};

export default function CombinationGraph({ detections = [], combinations = [], riskScore = 0 }) {
  const activeCategories = useMemo(() => {
    const cats = new Set();
    detections.forEach((d) => cats.add(d.category));
    return cats;
  }, [detections]);

  const activeEdges = useMemo(() => {
    const edges = [];
    combinations.forEach((combo) => {
      if (!combo.categories) return;
      for (let i = 0; i < combo.categories.length; i++) {
        for (let j = i + 1; j < combo.categories.length; j++) {
          edges.push({
            from: combo.categories[i],
            to: combo.categories[j],
            multiplier: combo.multiplier,
          });
        }
      }
    });
    return edges;
  }, [combinations]);

  return (
    <div className="demo-panel combination-graph">
      <div className="demo-panel-header">
        <span className="demo-panel-dot" style={{ background: "#a78bfa" }} />
        <span>COMBINATION RISK</span>
        {riskScore > 0 && (
          <span className="demo-panel-count" style={{
            background: riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f59e0b" : "#22d3ee",
            color: "#000"
          }}>
            {riskScore}
          </span>
        )}
      </div>
      <div className="demo-panel-body" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <svg width="400" height="310" viewBox="0 0 400 310">
          {/* Edges */}
          {activeEdges.map((edge, i) => {
            const from = NODE_POSITIONS[edge.from];
            const to = NODE_POSITIONS[edge.to];
            if (!from || !to) return null;
            const intensity = Math.min(edge.multiplier / 3.5, 1);
            return (
              <line
                key={`edge-${i}`}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={`rgba(239, 68, 68, ${0.3 + intensity * 0.7})`}
                strokeWidth={1 + intensity * 3}
                strokeDasharray={intensity > 0.5 ? "none" : "6 3"}
                className="combo-edge-animate"
              />
            );
          })}

          {/* Nodes */}
          {Object.entries(NODE_POSITIONS).map(([cat, pos]) => {
            const isActive = activeCategories.has(cat);
            const color = NODE_COLORS[cat] || "#94a3b8";
            const r = isActive ? 22 : 14;
            return (
              <g key={cat}>
                {/* Glow */}
                {isActive && (
                  <circle cx={pos.x} cy={pos.y} r={r + 8} fill={color} opacity={0.15} className="combo-glow" />
                )}
                {/* Node */}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={isActive ? color : "#1e293b"}
                  stroke={color}
                  strokeWidth={isActive ? 2 : 1}
                  opacity={isActive ? 1 : 0.3}
                />
                {/* Label */}
                <text
                  x={pos.x} y={pos.y + r + 14}
                  textAnchor="middle"
                  fill={isActive ? "#f8fafc" : "#64748b"}
                  fontSize="9"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={isActive ? "600" : "400"}
                >
                  {cat.replace(/_/g, " ")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
