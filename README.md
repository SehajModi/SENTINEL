# 🛡️ SENTINEL
### Real-Time Predictive Maintenance System

> An IoT-inspired edge intelligence system that monitors machine health in real-time, detects anomalies using dual ML models, and alerts operators before failures occur.

---

## 🔥 Live Demo
- **Dashboard:** https://sentinel-three-lyart.vercel.app
- **API:** https://sentinel-production-4d8e.up.railway.app

---

## 🧠 How It Works

1. **Sensor Layer** — Simulates ESP32 sensor readings (temperature, vibration, pressure) at 2-second intervals
2. **Backend API** — FastAPI server receives, stores, and processes incoming telemetry data
3. **ML Engine (Dual)** — IsolationForest for point anomaly detection + LSTM Autoencoder for sequence-based temporal anomaly detection
4. **Dashboard** — React frontend visualizes all three sensor streams with live anomaly alerts

---

## 🤖 Anomaly Detection

| Model | Approach | Endpoint |
|-------|----------|----------|
| IsolationForest | Point-based outlier detection | `/predict` |
| LSTM Autoencoder | Sequence-based temporal detection | `/predict/lstm` |

The LSTM autoencoder learns normal sensor patterns over time and flags deviations based on reconstruction loss — catching gradual failures that point-based models miss.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python |
| Database | SQLite + SQLAlchemy |
| ML | scikit-learn, TensorFlow/Keras |
| Frontend | React + Recharts |
| Deployment | Railway (API), Vercel (Dashboard) |

---

## 🚀 Run Locally

```bash
# Backend
pip install -r requirements.txt
python train_lstm.py        # train LSTM on existing data
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
- [x] LSTM Autoencoder sequence detection
- [x] Dual ML endpoint architecture
- [x] Cloud deployment (Railway + Vercel)
- [ ] ESP32 hardware integration
- [ ] Edge deployment (Raspberry Pi / STM32)