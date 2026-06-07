import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const StatCard = ({ title, value, unit, color, anomaly }) => (
  <div style={{
    background: "#1a1d27",
    border: `1px solid ${anomaly ? '#ff4d4d' : '#2a2d3a'}`,
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    flex: 1,
    transition: "border-color 0.3s"
  }}>
    <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>{title}</div>
    <div style={{ fontSize: "32px", fontWeight: "600", color: color }}>{value}<span style={{ fontSize: "14px", color: "#666", marginLeft: "4px" }}>{unit}</span></div>
  </div>
);

const SectionChart = ({ title, dataKey, color, data }) => (
  <div style={{ background: "#1a1d27", borderRadius: "12px", padding: "1.25rem", marginBottom: "16px" }}>
    <div style={{ fontSize: "13px", color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>{title}</div>
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis dataKey="id" stroke="#444" tick={{ fontSize: 11 }} />
        <YAxis stroke="#444" tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: "8px", color: "#fff" }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

function App() {
  const [data, setData] = useState([]);
  const [latest, setLatest] = useState(null);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("http://127.0.0.1:8000/sensor-data");
      const reading = await res.json();
      const point = {
        id: reading.id,
        temperature: parseFloat(reading.temperature.toFixed(2)),
        vibration: parseFloat(reading.vibration.toFixed(2)),
        pressure: parseFloat(reading.pressure.toFixed(2)),
        anomaly: reading.anomaly
      };
      setLatest(point);
      if (reading.anomaly) setAnomalyCount(p => p + 1);
      setData(prev => [...prev.slice(-30), point]);
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const isAnomaly = latest?.anomaly;

  return (
    <div style={{ background: "#0f1117", minHeight: "100vh", padding: "2rem", color: "white", fontFamily: "'Inter', sans-serif", maxWidth: "1100px", margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", letterSpacing: "-0.02em" }}>🛡️ SENTINEL</h1>
          <p style={{ margin: "4px 0 0", color: "#555", fontSize: "13px" }}>Real-Time Predictive Maintenance Dashboard</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1a1d27", padding: "8px 16px", borderRadius: "20px", border: "1px solid #2a2d3a" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isAnomaly ? "#ff4d4d" : "#4dff91", boxShadow: `0 0 8px ${isAnomaly ? "#ff4d4d" : "#4dff91"}` }}></div>
          <span style={{ fontSize: "13px", color: isAnomaly ? "#ff4d4d" : "#4dff91" }}>{isAnomaly ? "ANOMALY DETECTED" : "SYSTEM NOMINAL"}</span>
        </div>
      </div>

      {/* Anomaly Banner */}
      {isAnomaly && (
        <div style={{ background: "#ff4d4d15", border: "1px solid #ff4d4d", borderRadius: "10px", padding: "12px 16px", marginBottom: "1.5rem", color: "#ff4d4d", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          ⚠️ <strong>Anomaly detected</strong> — Unusual sensor pattern identified. Inspect system immediately.
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "1.5rem" }}>
        <StatCard title="Temperature" value={latest?.temperature ?? "--"} unit="°C" color="#ff6b6b" anomaly={isAnomaly} />
        <StatCard title="Vibration" value={latest?.vibration ?? "--"} unit="g" color="#4da6ff" anomaly={isAnomaly} />
        <StatCard title="Pressure" value={latest?.pressure ?? "--"} unit="kPa" color="#4dff91" anomaly={isAnomaly} />
        <StatCard title="Anomalies" value={anomalyCount} unit="flagged" color="#ffaa4d" anomaly={isAnomaly} />
      </div>

      {/* Charts */}
      <SectionChart title="Temperature (°C)" dataKey="temperature" color="#ff6b6b" data={data} />
      <SectionChart title="Vibration (g)" dataKey="vibration" color="#4da6ff" data={data} />
      <SectionChart title="Pressure (kPa)" dataKey="pressure" color="#4dff91" data={data} />

      {/* Footer */}
      <div style={{ textAlign: "center", color: "#333", fontSize: "12px", marginTop: "1rem" }}>
        SENTINEL v0.1 · Built by Sehaj Modi · {data.length} readings this session
      </div>
    </div>
  );
}

export default App;