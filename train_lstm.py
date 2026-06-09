from database import SessionLocal
from database import SessionLocal, SensorReading
from lstm_model import train
import numpy as np

db = SessionLocal()
readings = db.query(SensorReading).order_by(SensorReading.timestamp).all()
db.close()

if len(readings) < 20:
    print("Not enough data. Let SENTINEL collect more readings first.")
else:
    data = np.array([[r.temperature, r.vibration, r.pressure] for r in readings])
    train(data)