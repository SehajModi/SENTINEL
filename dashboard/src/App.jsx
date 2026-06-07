import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("http://127.0.0.1:8000/sensor-data");
      const reading = await res.json();
      setData(prev => [...prev.slice(-20), {
        id: reading.id,
        temperature: parseFloat(reading.temperature.toFixed(2)),
        vibration: parseFloat(reading.vibration.toFixed(2)),
        pressure: parseFloat(reading.pressure.toFixed(2)),
        anomaly: reading.anomaly
      }]);
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const latestAnomaly = data.length > 0 && data[data.length - 1].anomaly;

  return (
    <div style={{ background: "#0f1117", minHeight: "100vh", padding: "2rem", color: "white", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>🛡️ SENTINEL</h1>
      <p style={{ color: "#888", marginBottom: "1rem" }}>Live Predictive Maintenance Dashboard</p>

      {latestAnomaly && (
        <div style={{ background: "#ff4d4d22", border: "1px solid #ff4d4d", borderRadius: "8px", padding: "1rem", color: "#ff4d4d", fontSize: "16px", marginBottom: "1.5rem" }}>
          ⚠️ ANOMALY DETECTED — Check your system immediately
        </div>
      )}

      <h3>Temperature (°C)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="id" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip />
          <Line type="monotone" dataKey="temperature" stroke="#ff4d4d" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <h3 style={{ marginTop: "2rem" }}>Vibration</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="id" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip />
          <Line type="monotone" dataKey="vibration" stroke="#4daaff" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <h3 style={{ marginTop: "2rem" }}>Pressure</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="id" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip />
          <Line type="monotone" dataKey="pressure" stroke="#4dff91" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default App;