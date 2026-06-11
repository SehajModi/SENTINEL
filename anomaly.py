import numpy as np
from sklearn.ensemble import IsolationForest

model = IsolationForest(contamination=0.05, random_state=42)
is_trained = False

def train_model(readings):
    global is_trained
    data = [[r.temperature, r.vibration, r.pressure] for r in readings]
    model.fit(data)
    is_trained = True

def detect_anomaly(temperature, vibration, pressure):
    if not is_trained:
        return False
    prediction = model.predict([[temperature, vibration, pressure]])
    return prediction[0] == -1