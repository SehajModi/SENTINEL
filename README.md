# 🛡️ SENTINEL
### Real-Time Predictive Maintenance System

> An IoT-inspired edge intelligence system that monitors machine health in real-time, detects anomalies using machine learning, and alerts operators before failures occur.

---

## 🔥 Live Demo
- **Dashboard:** https://sentinel-three-lyart.vercel.app
- **API:** https://sentinel-production-4d8e.up.railway.app
---

## 🧠 How It Works

1. **Sensor Layer** — Simulates ESP32 sensor readings (temperature, vibration, pressure) at 2-second intervals
2. **Backend API** — FastAPI server receives, stores, and processes incoming telemetry data
3. **ML Engine** — IsolationForest model trains on live data and flags anomalies in real-time
4. **Dashboard** — React frontend visualizes all three sensor streams with live anomaly alerts

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python |
| Database | SQLite + SQLAlchemy |
| ML | scikit-learn (IsolationForest) |
| Frontend | React + Recharts |

---

## 🚀 Run Locally

```bash
# Backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd dashboard
npm install
npm run dev
```

---

## 📍 Roadmap
- [x] Live sensor data API
- [x] Database persistence
- [x] IsolationForest anomaly detection
- [x] Real-time React dashboard
- [ ] LSTM sequence-based prediction
- [ ] ESP32 hardware integration
- [ ] Cloud deployment