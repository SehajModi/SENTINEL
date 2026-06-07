from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, SensorReading, init_db
import random
import time
from anomaly import train_model, detect_anomaly

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

@app.get("/")
def read_root():
    return {"message": "SENTINEL is alive"}

@app.get("/sensor-data")
def get_sensor_data(db: Session = Depends(get_db)):
    reading = SensorReading(
        timestamp=time.time(),
        temperature=random.uniform(60, 120),
        vibration=random.uniform(0.1, 2.5),
        pressure=random.uniform(30, 100)
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    all_readings = db.query(SensorReading).all()
    if len(all_readings) >= 10:
        train_model(all_readings)

    is_anomaly = detect_anomaly(reading.temperature, reading.vibration, reading.pressure)

    return {
        "id": reading.id,
        "timestamp": reading.timestamp,
        "temperature": reading.temperature,
        "vibration": reading.vibration,
        "pressure": reading.pressure,
        "anomaly": bool(is_anomaly)
    }

@app.get("/readings")
def get_all_readings(db: Session = Depends(get_db)):
    return db.query(SensorReading).all()