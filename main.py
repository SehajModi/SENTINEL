from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, SensorReading, init_db
import random
import time

app = FastAPI()
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
    return reading

@app.get("/readings")
def get_all_readings(db: Session = Depends(get_db)):
    return db.query(SensorReading).all()