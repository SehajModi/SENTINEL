from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, SensorReading, init_db
import random
import time
from anomaly import train_model, detect_anomaly
from lstm_model import predict_anomaly
import numpy as np

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://sentinel-three-lyart.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)
init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Realistic sensor simulation ────────────────────────────────────────────
# Normal operating baselines with small Gaussian noise.
# 5% chance of an anomaly spike on any reading — a sudden jump outside
# normal range that both IF and LSTM should catch.
NORMAL = {
    "temperature": (75.0, 4.0),   # mean, std  →  ~67–83°C normal band
    "vibration":   (0.6,  0.1),   # mean, std  →  ~0.4–0.8g normal band
    "pressure":    (65.0, 5.0),   # mean, std  →  ~55–75 kPa normal band
}

ANOMALY_SPIKE = {
    "temperature": (110.0, 5.0),  # sudden heat spike
    "vibration":   (2.2,   0.2),  # sudden vibration spike
    "pressure":    (28.0,  3.0),  # sudden pressure drop
}

def generate_reading():
    """
    Returns (temperature, vibration, pressure, is_injected_anomaly).
    5% of the time, spikes one or more sensors into anomaly territory.
    The rest of the time, stays tightly clustered around normal baselines.
    """
    is_anomaly = random.random() < 0.05  # 5% chance

    if is_anomaly:
        # Randomly spike 1–3 sensors
        sensors = random.sample(["temperature", "vibration", "pressure"],
                                k=random.randint(1, 3))
        temp  = random.gauss(*ANOMALY_SPIKE["temperature"]) if "temperature" in sensors else random.gauss(*NORMAL["temperature"])
        vib   = random.gauss(*ANOMALY_SPIKE["vibration"])   if "vibration"   in sensors else random.gauss(*NORMAL["vibration"])
        pres  = random.gauss(*ANOMALY_SPIKE["pressure"])    if "pressure"    in sensors else random.gauss(*NORMAL["pressure"])
    else:
        temp  = random.gauss(*NORMAL["temperature"])
        vib   = random.gauss(*NORMAL["vibration"])
        pres  = random.gauss(*NORMAL["pressure"])

    # Clamp to physical bounds
    temp = max(50.0, min(130.0, temp))
    vib  = max(0.1,  min(3.0,   vib))
    pres = max(20.0, min(110.0, pres))

    return temp, vib, pres

# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "SENTINEL is alive"}

@app.get("/sensor-data")
def get_sensor_data(db: Session = Depends(get_db)):
    temp, vib, pres = generate_reading()

    reading = SensorReading(
        timestamp=time.time(),
        temperature=temp,
        vibration=vib,
        pressure=pres,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    all_readings = db.query(SensorReading).all()
    if len(all_readings) >= 10:
        train_model(all_readings)

    is_anomaly = detect_anomaly(reading.temperature, reading.vibration, reading.pressure)

    return {
        "id":          reading.id,
        "timestamp":   reading.timestamp,
        "temperature": reading.temperature,
        "vibration":   reading.vibration,
        "pressure":    reading.pressure,
        "anomaly":     bool(is_anomaly),
    }

@app.get("/readings")
def get_all_readings(db: Session = Depends(get_db)):
    return db.query(SensorReading).all()

@app.get("/retrain")
def retrain():
    from lstm_model import train
    db = SessionLocal()
    readings = db.query(SensorReading).all()
    db.close()
    if len(readings) < 50:
        return {"error": f"Not enough data. Have {len(readings)}, need 50+."}
    sequence = np.array([[r.temperature, r.vibration, r.pressure] for r in readings])
    train(sequence)
    return {"status": "retrained", "readings_used": len(readings)}

@app.get("/predict/lstm")
def lstm_predict():
    db = SessionLocal()
    readings = db.query(SensorReading)\
        .order_by(SensorReading.timestamp.desc())\
        .limit(10).all()
    db.close()

    if len(readings) < 10:
        return {"error": "Not enough data for LSTM prediction. Need 10 readings."}

    readings.reverse()
    sequence = np.array([[r.temperature, r.vibration, r.pressure] for r in readings])
    return predict_anomaly(sequence)