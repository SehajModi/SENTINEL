import numpy as np
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed
from sklearn.preprocessing import MinMaxScaler
import pickle
import os
from tensorflow.keras.callbacks import EarlyStopping

def train(data: np.ndarray):
    os.makedirs(DATA_DIR, exist_ok=True)
    scaler = MinMaxScaler()
    data_scaled = scaler.fit_transform(data)

    sequences = []
    for i in range(len(data_scaled) - SEQUENCE_LENGTH):
        sequences.append(data_scaled[i:i+SEQUENCE_LENGTH])
    X = np.array(sequences)

    model = build_lstm_autoencoder()
    early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
    model.fit(X, X, epochs=50, batch_size=32, validation_split=0.1, 
              callbacks=[early_stop], verbose=1)

    model.save(MODEL_PATH)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    print("LSTM model saved.")

SEQUENCE_LENGTH = 10
FEATURES = 3  # temperature, vibration, pressure

DATA_DIR = "/app/data"
MODEL_PATH = os.path.join(DATA_DIR, "lstm_model.keras")
SCALER_PATH = os.path.join(DATA_DIR, "lstm_scaler.pkl")

def build_lstm_autoencoder():
    model = Sequential([
        LSTM(32, input_shape=(SEQUENCE_LENGTH, FEATURES), return_sequences=False),
        RepeatVector(SEQUENCE_LENGTH),
        LSTM(16, return_sequences=True),
        TimeDistributed(Dense(FEATURES))
    ])
    model.compile(optimizer='adam', loss='mae')
    return model


def train(data: np.ndarray):
    os.makedirs(DATA_DIR, exist_ok=True)
    scaler = MinMaxScaler()
    data_scaled = scaler.fit_transform(data)

    sequences = []
    for i in range(len(data_scaled) - SEQUENCE_LENGTH):
        sequences.append(data_scaled[i:i+SEQUENCE_LENGTH])
    X = np.array(sequences)

    model = build_lstm_autoencoder()
    model.fit(X, X, epochs=20, batch_size=32, validation_split=0.1, verbose=1)

    model.save(MODEL_PATH)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    print("LSTM model saved.")

def predict_anomaly(sequence: np.ndarray, threshold=0.10):
    model = load_model(MODEL_PATH)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)

    seq_scaled = scaler.transform(sequence)
    seq_input = seq_scaled.reshape(1, SEQUENCE_LENGTH, FEATURES)
    reconstruction = model.predict(seq_input, verbose=0)
    loss = np.mean(np.abs(reconstruction - seq_input))
    return {"lstm_anomaly": bool(loss > threshold), "reconstruction_loss": float(loss)}