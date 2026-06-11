import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const API = "https://sentinel-production-4d8e.up.railway.app";

const C = {
  bg:        "#080b12",
  surface:   "#0f1420",
  card:      "#131929",
  border:    "#1e2740",
  borderHot: "#ff4d4d",
  temp:      "#ff6b6b",
  vib:       "#4da6ff",
  pres:      "#4dff91",
  warn:      "#ffaa4d",
  muted:     "#4a5568",
  label:     "#8892a4",
  lstm:      "#c084fc",
};

if (!document.getElementById("sentinel-styles")) {
  const style = document.createElement("style");
  style.id = "sentinel-styles";
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,77,77,0.4); }
      50%       { opacity: 0.85; box-shadow: 0 0 0 8px rgba(255,77,77,0); }
    }
    @keyframes ringPulse {
      0%, 100% { filter: drop-shadow(0 0 4px #ff4d4d); }
      50%       { filter: drop-shadow(0 0 12px #ff4d4d); }
    }
  `;
  document.head.appendChild(style);
}

const fmt = (v, d = 2) => (v != null ? Number(v).toFixed(d) : "--");
const ts  = () => new Date().toLocaleTimeString("en-IN", { hour12: false });

function anomalySeverity(ifAnomaly, lstmAnomaly, reconstructionLoss) {
  if (ifAnomaly && lstmAnomaly) return "CRITICAL";
  if (ifAnomaly || lstmAnomaly) {
    return (reconstructionLoss ?? 0) > 0.15 ? "HIGH" : "LOW";
  }
  return null;
}

const TEMP_MAX = 120;
const VIB_MAX  = 2.5;
const MAX_LOSS = 0.5;

function computeHealth(point, lstmResult) {
  if (!point) return null;
  const tempScore = 100 - ((point.temperature - 60) / (TEMP_MAX - 60)) * 100;
  const vibScore  = 100 - (point.vibration / VIB_MAX) * 100;
  const presScore = 100 - Math.abs((point.pressure - 65) / 35) * 100;
  const sensorAvg = (tempScore + vibScore + presScore) / 3;
  const ifPenalty        = point.anomaly ? 25 : 0;
  const lstmPenalty      = lstmResult?.lstm_anomaly
    ? Math.min(25, Math.round((lstmResult.reconstruction_loss / MAX_LOSS) * 25))
    : 0;
  const agreementPenalty = (point.anomaly && lstmResult?.lstm_anomaly) ? 20 : 0;
  return Math.max(0, Math.min(100, Math.round(sensorAvg - ifPenalty - lstmPenalty - agreementPenalty)));
}

function healthColor(score) {
  if (score == null) return C.muted;
  if (score >= 75) return "#4dff91";
  if (score >= 50) return C.warn;
  return C.borderHot;
}

function healthLabel(score) {
  if (score == null) return "INITIALISING";
  if (score >= 75) return "HEALTHY";
  if (score >= 50) return "DEGRADED";
  return "CRITICAL";
}

// ── Health ring ────────────────────────────────────────────────────────────
const HealthRing = ({ score, isCritical }) => {
  const color  = healthColor(score);
  const label  = healthLabel(score);
  const radius = 38;
  const circ   = 2 * Math.PI * radius;
  const dash   = score != null ? (score / 100) * circ : 0;
  return (
    <div style={{
      background: C.card, border: `1px solid ${isCritical ? C.borderHot : C.border}`,
      borderRadius: 12, padding: "1.1rem 1.5rem", display: "flex", alignItems: "center",
      gap: 20, transition: "border-color 0.3s",
      animation: isCritical ? "pulse 1.2s ease-in-out infinite" : "none",
    }}>
      <svg width={96} height={96} style={{ flexShrink: 0, animation: isCritical ? "ringPulse 1.2s ease-in-out infinite" : "none" }}>
        <circle cx={48} cy={48} r={radius} fill="none" stroke={C.border} strokeWidth={7} />
        <circle cx={48} cy={48} r={radius} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }} />
        <text x={48} y={44} textAnchor="middle" fill={color} fontSize={22} fontWeight={700} fontFamily="Inter, system-ui">{score ?? "--"}</text>
        <text x={48} y={60} textAnchor="middle" fill={C.muted} fontSize={9} fontFamily="Inter, system-ui" letterSpacing={1}>/ 100</text>
      </svg>
      <div>
        <div style={{ fontSize: 11, color: C.label, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Machine Health</div>
        <div style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: "-0.02em", marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Sensor range · IF · LSTM loss<br />composite score</div>
      </div>
    </div>
  );
};

// ── Confidence bar ─────────────────────────────────────────────────────────
const MAX_ERR = 0.5;
const toConfidence = (err) =>
  err != null ? Math.min(100, Math.round((err / MAX_ERR) * 100)) : null;

const ConfidenceBar = ({ value }) => {
  if (value == null) return <span style={{ color: C.muted, fontSize: 11 }}>—</span>;
  const color = value > 70 ? C.borderHot : value > 40 ? C.warn : "#4dff91";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#1e2740", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 11, color, minWidth: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}%</span>
    </div>
  );
};

// ── Model eye ──────────────────────────────────────────────────────────────
const ModelEye = ({ label, active, sub }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${active ? C.borderHot : C.border}`, borderRadius: 10, padding: "10px 18px", minWidth: 100, transition: "border-color 0.3s" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? C.borderHot : "#4dff91", boxShadow: `0 0 8px ${active ? C.borderHot : "#4dff91"}`, transition: "background 0.3s, box-shadow 0.3s" }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: active ? C.borderHot : "#4dff91" }}>{label}</span>
    </div>
    <span style={{ fontSize: 10, color: C.muted }}>{sub}</span>
  </div>
);

// ── Stat card ──────────────────────────────────────────────────────────────
const StatCard = ({ title, value, unit, color, anomaly, lstmConf }) => (
  <div style={{ background: C.card, border: `1px solid ${anomaly ? C.borderHot : C.border}`, borderRadius: 12, padding: "1.1rem 1.25rem", flex: 1, transition: "border-color 0.3s" }}>
    <div style={{ fontSize: 11, color: C.label, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", marginBottom: lstmConf != null ? 10 : 0 }}>
      {value}<span style={{ fontSize: 13, color: C.muted, marginLeft: 4 }}>{unit}</span>
    </div>
    {lstmConf != null && (
      <div>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>LSTM ANOMALY CONF.</div>
        <ConfidenceBar value={lstmConf} />
      </div>
    )}
  </div>
);

// ── Model stats strip ──────────────────────────────────────────────────────
const ModelStatsStrip = ({ stats, currentLoss, lossZScore }) => {
  if (!stats) return null;
  const zColor = lossZScore == null ? C.muted
    : lossZScore > 5 ? C.borderHot
    : lossZScore > 2 ? C.warn
    : "#4dff91";
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: "8px 14px", marginTop: 10,
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 10, color: C.label, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>
        Model Baseline
      </span>
      {[
        ["mean", stats.loss_mean],
        ["std",  stats.loss_std],
        ["p95",  stats.loss_p95],
        ["p99",  stats.loss_p99],
      ].map(([label, val]) => (
        <div key={label} style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
          <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
          <span style={{ fontSize: 11, color: C.lstm, fontVariantNumeric: "tabular-nums" }}>{Number(val).toFixed(4)}</span>
        </div>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: C.muted }}>current z-score</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: zColor, fontVariantNumeric: "tabular-nums" }}>
          {lossZScore != null ? `${lossZScore > 0 ? "+" : ""}${lossZScore}σ` : "--"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: C.muted }}>trained on</span>
        <span style={{ fontSize: 11, color: C.label }}>{stats.trained_on_n_sequences?.toLocaleString()} sequences</span>
      </div>
    </div>
  );
};

// ── Chart tooltip ──────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: d.color, fontWeight: 600 }}>{fmt(d.value)}</div>
      <div style={{ color: C.muted }}>reading #{d.payload.id}</div>
      {d.payload.anomaly && <div style={{ color: C.borderHot, marginTop: 2 }}>⚠ anomaly</div>}
    </div>
  );
};

// ── Sensor chart ───────────────────────────────────────────────────────────
const SensorChart = ({ title, dataKey, color, data }) => {
  const anomalyIds = data.filter(d => d.anomaly).map(d => d.id);
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "1.1rem 1.25rem", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.label, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>{title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="id" stroke={C.muted} tick={{ fontSize: 10 }} />
          <YAxis stroke={C.muted} tick={{ fontSize: 10 }} width={36} />
          <Tooltip content={<ChartTooltip />} />
          {anomalyIds.map(id => (
            <ReferenceLine key={id} x={id} stroke={C.borderHot} strokeOpacity={0.35} strokeWidth={1} />
          ))}
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} activeDot={{ r: 4, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── LSTM loss chart ────────────────────────────────────────────────────────
const LSTM_THRESHOLD = 0.15;

const LossTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: C.lstm, fontWeight: 600 }}>loss: {val != null ? Number(val).toFixed(4) : "--"}</div>
      <div style={{ color: C.muted }}>reading #{payload[0]?.payload?.id}</div>
      <div style={{ color: val > LSTM_THRESHOLD ? C.borderHot : "#4dff91", marginTop: 2 }}>
        {val > LSTM_THRESHOLD ? "⚠ above threshold" : "✓ normal"}
      </div>
    </div>
  );
};

const LossChart = ({ data, modelStats, currentLossZScore }) => {
  const lossData = data.filter(d => d.reconstruction_loss != null);
  const currentLoss = lossData[lossData.length - 1]?.reconstruction_loss;
  const aboveThreshold = currentLoss > LSTM_THRESHOLD;
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "1.1rem 1.25rem", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: C.label, textTransform: "uppercase", letterSpacing: "0.07em" }}>LSTM Reconstruction Loss</span>
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 10 }}>threshold: {LSTM_THRESHOLD}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: aboveThreshold ? C.borderHot : "#4dff91" }} />
          <span style={{ fontSize: 11, color: aboveThreshold ? C.borderHot : "#4dff91" }}>
            {currentLoss != null ? Number(currentLoss).toFixed(4) : "--"}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={lossData}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="id" stroke={C.muted} tick={{ fontSize: 10 }} />
          <YAxis stroke={C.muted} tick={{ fontSize: 10 }} width={44} tickFormatter={v => v.toFixed(2)} domain={[0, 0.25]} />
          <Tooltip content={<LossTooltip />} />
          <ReferenceLine y={LSTM_THRESHOLD} stroke={C.borderHot} strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: "threshold", position: "insideTopRight", fill: C.borderHot, fontSize: 10 }} />
          {modelStats && (
            <ReferenceLine y={modelStats.loss_mean} stroke={C.lstm} strokeDasharray="4 4" strokeOpacity={0.5} strokeWidth={1}
              label={{ value: "baseline mean", position: "insideBottomRight", fill: C.lstm, fontSize: 9 }} />
          )}
          <Line type="monotone" dataKey="reconstruction_loss" stroke={C.lstm} dot={false} strokeWidth={1.5} activeDot={{ r: 4, fill: C.lstm }} />
        </LineChart>
      </ResponsiveContainer>
      <ModelStatsStrip stats={modelStats} currentLoss={currentLoss} lossZScore={currentLossZScore} />
    </div>
  );
};

// ── Anomaly rate chart ─────────────────────────────────────────────────────
const AnomalyRateChart = ({ data }) => {
  const buckets = [];
  for (let i = 0; i < data.length; i += 10) {
    const slice = data.slice(i, i + 10);
    const rate = Math.round((slice.filter(d => d.anomaly).length / slice.length) * 100);
    buckets.push({ bucket: `#${slice[0]?.id}`, rate });
  }
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "1.1rem 1.25rem", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.label, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
        Anomaly Rate Trend <span style={{ color: C.muted, marginLeft: 8 }}>% per 10 readings</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={buckets}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="bucket" stroke={C.muted} tick={{ fontSize: 10 }} />
          <YAxis stroke={C.muted} tick={{ fontSize: 10 }} width={36} domain={[0, 100]} tickFormatter={v => `${v}%`} />
          <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v}%`, "Anomaly Rate"]} />
          <ReferenceLine y={5} stroke={C.warn} strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: "5% baseline", position: "insideTopRight", fill: C.warn, fontSize: 10 }} />
          <Line type="monotone" dataKey="rate" stroke={C.warn} dot={{ r: 3, fill: C.warn }} strokeWidth={2} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── CSV export ─────────────────────────────────────────────────────────────
function exportCSV(events) {
  const headers = ["id", "time", "temperature", "vibration", "pressure", "reconstruction_loss", "if_anomaly", "lstm_anomaly", "severity", "explanation"];
  const rows = events.map(e => {
    const sev = anomalySeverity(e.if_anomaly, e.lstm_anomaly, e.reconstruction_loss);
    return [e.id, e.time, e.temperature, e.vibration, e.pressure,
      e.reconstruction_loss ?? "", e.if_anomaly ? "1" : "0", e.lstm_anomaly ? "1" : "0",
      sev ?? "", e.explanation ?? ""].join(",");
  });
  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `sentinel-anomalies-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Anomaly timeline ───────────────────────────────────────────────────────
const AnomalyTimeline = ({ events }) => (
  <div style={{ background: C.card, borderRadius: 12, padding: "1.1rem 1.25rem", marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: C.label, textTransform: "uppercase", letterSpacing: "0.07em" }}>Anomaly Log</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: C.muted }}>{events.length} events</span>
        {events.length > 0 && (
          <button onClick={() => exportCSV(events)} style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 5,
            background: "#1e2740", border: `1px solid ${C.border}`,
            color: C.label, cursor: "pointer", letterSpacing: "0.05em",
            transition: "border-color 0.2s, color 0.2s",
          }}
            onMouseEnter={e => { e.target.style.borderColor = C.lstm; e.target.style.color = C.lstm; }}
            onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.label; }}
          >↓ EXPORT CSV</button>
        )}
      </div>
    </div>
    {events.length === 0 ? (
      <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "1.5rem 0" }}>No anomalies detected this session</div>
    ) : (
      <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {[...events].reverse().map((e, i) => {
          const sev = anomalySeverity(e.if_anomaly, e.lstm_anomaly, e.reconstruction_loss);
          const sevColor = sev === "CRITICAL" ? C.borderHot : sev === "HIGH" ? C.warn : C.lstm;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, background: C.surface,
              borderRadius: 8, padding: "9px 12px",
              border: `1px solid ${sev === "CRITICAL" ? C.borderHot : C.border}`, fontSize: 12,
            }}>
              <div style={{ minWidth: 64, color: C.muted, fontSize: 10, lineHeight: 1.5 }}>
                <div style={{ fontVariantNumeric: "tabular-nums" }}>{e.time}</div>
                <div>#{e.id}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ color: C.temp }}>{fmt(e.temperature)} °C</span>
                  <span style={{ color: C.vib }}>{fmt(e.vibration)} g</span>
                  <span style={{ color: C.pres }}>{fmt(e.pressure)} kPa</span>
                </div>
                {e.explanation && (
                  <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>↳ {e.explanation}</div>
                )}
              </div>
              {e.reconstruction_loss != null && (
                <span style={{ fontSize: 10, color: C.lstm, fontVariantNumeric: "tabular-nums" }}>
                  loss {Number(e.reconstruction_loss).toFixed(3)}
                </span>
              )}
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {sev && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${sevColor}22`, color: sevColor, fontWeight: 700, letterSpacing: "0.05em" }}>{sev}</span>}
                {e.if_anomaly && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#ff4d4d22", color: C.borderHot, fontWeight: 600 }}>IF</span>}
                {e.lstm_anomaly && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#c084fc22", color: C.lstm, fontWeight: 600 }}>LSTM</span>}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ── Main app ───────────────────────────────────────────────────────────────
function App() {
  const [data,          setData]          = useState([]);
  const [latest,        setLatest]        = useState(null);
  const [lstmResult,    setLstmResult]    = useState(null);
  const [anomalyLog,    setAnomalyLog]    = useState([]);
  const [totalReadings, setTotalReadings] = useState(0);
  const [explanation,   setExplanation]   = useState(null);
  const [modelStats,    setModelStats]    = useState(null);

  const lstmConf    = toConfidence(lstmResult?.reconstruction_loss);
  const ifAnomaly   = latest?.anomaly          ?? false;
  const lstmAnomaly = lstmResult?.lstm_anomaly ?? false;
  const anyAnomaly  = ifAnomaly || lstmAnomaly;
  const severity    = anomalySeverity(ifAnomaly, lstmAnomaly, lstmResult?.reconstruction_loss);
  const isCritical  = severity === "CRITICAL";
  const healthScore = computeHealth(latest, lstmResult);

  // Fetch model stats once on mount
  useEffect(() => {
    fetch(`${API}/model-stats`)
      .then(r => r.json())
      .then(d => { if (!d.error) setModelStats(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res     = await fetch(`${API}/sensor-data`);
        const reading = await res.json();
        const point   = {
          id:          reading.id,
          temperature: parseFloat(reading.temperature.toFixed(2)),
          vibration:   parseFloat(reading.vibration.toFixed(2)),
          pressure:    parseFloat(reading.pressure.toFixed(2)),
          anomaly:     reading.anomaly,
        };

        let lstm = null;
        try {
          const lstmRes = await fetch(`${API}/predict/lstm`);
          lstm = await lstmRes.json();
        } catch { /* degrade gracefully */ }

        if (lstm?.reconstruction_loss != null) {
          point.reconstruction_loss = parseFloat(lstm.reconstruction_loss.toFixed(4));
        }

        let explainText = null;
        try {
          const explainRes  = await fetch(`${API}/explain`);
          const explainData = await explainRes.json();
          explainText = explainData.explanation ?? null;
        } catch { /* degrade gracefully */ }

        setLatest(point);
        setLstmResult(lstm);
        setExplanation(explainText);
        setTotalReadings(r => r + 1);
        setData(prev => [...prev.slice(-40), point]);

        const ifFlag   = point.anomaly;
        const lstmFlag = lstm?.lstm_anomaly ?? false;
        if (ifFlag || lstmFlag) {
          setAnomalyLog(prev => [...prev.slice(-99), {
            id: point.id, time: ts(),
            temperature: point.temperature, vibration: point.vibration, pressure: point.pressure,
            reconstruction_loss: lstm?.reconstruction_loss ?? null,
            if_anomaly: ifFlag, lstm_anomaly: lstmFlag, explanation: explainText,
          }]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const bannerConfig = {
    CRITICAL: { bg: "#ff4d4d22", border: C.borderHot, color: C.borderHot, icon: "🚨" },
    HIGH:     { bg: "#ffaa4d18", border: C.warn,       color: C.warn,      icon: "⚠️" },
    LOW:      { bg: "#ff4d4d12", border: C.borderHot,  color: C.borderHot, icon: "⚠️" },
  };
  const banner = severity ? bannerConfig[severity] : null;

  const lossZScore = lstmResult?.loss_z_score ?? null;

  const bannerMsg = (() => {
    const parts = [];
    if (explanation) parts.push(explanation);
    if (lossZScore != null && Math.abs(lossZScore) > 2)
      parts.push(`LSTM loss is ${lossZScore > 0 ? "+" : ""}${lossZScore}σ from model baseline`);
    if (parts.length) return parts.join(" · ");
    if (severity === "CRITICAL") return "Both models confirm anomaly — immediate inspection required.";
    if (ifAnomaly) return "IsolationForest flagged a point outlier.";
    return "LSTM detected a sequential deviation.";
  })();

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "1.75rem 2rem", color: "white", fontFamily: "'Inter', 'SF Pro Text', system-ui, sans-serif", maxWidth: 1140, margin: "0 auto" }}>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "#e8eaf0" }}>🛡️ SENTINEL</h1>
          <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 12 }}>Real-Time Predictive Maintenance · {totalReadings} readings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ModelEye label="ISOLATION FOREST" active={ifAnomaly}   sub="point anomaly" />
          <ModelEye label="LSTM AUTOENCODER" active={lstmAnomaly} sub="sequence anomaly" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <HealthRing score={healthScore} isCritical={isCritical} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
          <div style={{ display: "flex", gap: 10, flex: 1 }}>
            <StatCard title="Temperature" value={fmt(latest?.temperature)} unit="°C"  color={C.temp} anomaly={anyAnomaly} lstmConf={lstmConf} />
            <StatCard title="Vibration"   value={fmt(latest?.vibration)}   unit="g"   color={C.vib}  anomaly={anyAnomaly} lstmConf={lstmConf} />
          </div>
          <div style={{ display: "flex", gap: 10, flex: 1 }}>
            <StatCard title="Pressure"  value={fmt(latest?.pressure)} unit="kPa"    color={C.pres} anomaly={anyAnomaly} lstmConf={lstmConf} />
            <StatCard title="Anomalies" value={anomalyLog.length}     unit="flagged" color={C.warn} anomaly={anyAnomaly} />
          </div>
        </div>
      </div>

      {anyAnomaly && banner && (
        <div style={{
          background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 10,
          padding: "11px 16px", marginBottom: "1.25rem", color: banner.color, fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
          animation: isCritical ? "pulse 1.2s ease-in-out infinite" : "none",
        }}>
          {banner.icon}
          <strong>[{severity}]</strong>&nbsp;{bannerMsg}
          {lstmResult?.reconstruction_loss != null && (
            <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.8 }}>
              loss: {Number(lstmResult.reconstruction_loss).toFixed(4)}
            </span>
          )}
        </div>
      )}

      <SensorChart title="Temperature (°C)" dataKey="temperature" color={C.temp} data={data} />
      <SensorChart title="Vibration (g)"    dataKey="vibration"   color={C.vib}  data={data} />
      <SensorChart title="Pressure (kPa)"   dataKey="pressure"    color={C.pres} data={data} />
      <LossChart data={data} modelStats={modelStats} currentLossZScore={lossZScore} />
      <AnomalyRateChart data={data} />
      <AnomalyTimeline events={anomalyLog} />

      <div style={{ textAlign: "center", color: "#2a2d3a", fontSize: 11, marginTop: "0.75rem" }}>
        SENTINEL v0.8 · Sehaj Modi · IsolationForest + LSTM Autoencoder
      </div>

    </div>
  );
}

export default App;