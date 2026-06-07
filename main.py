from fastapi import FastAPI
import random
import time

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "SENTINEL is alive"}

@app.get("/sensor-data")
def get_sensor_data():
    return {
        "timestamp": time.time(),
        "temperature": random.uniform(60, 120),
        "vibration": random.uniform(0.1, 2.5),
        "pressure": random.uniform(30, 100)
    }