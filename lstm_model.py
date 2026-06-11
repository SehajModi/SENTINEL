import numpy as np
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed
from sklearn.preprocessing import MinMaxScaler
import pickle

SEQUENCE_LENGTH = 10
FEATURES = 3  # temperature, vibration, pressure

def build_lstm_autoencoder():
    model = Sequential([
        LSTM(64, input_shape=(SEQUENCE_LENGTH, FEATURES), return_sequences=False),
        RepeatVector(SEQUENCE_LENGTH),
        LSTM(64, return_sequences=True),
        TimeDistributed(Dense(FEATURES))
    ])
    model.compile(optimizer='adam', loss='mae')
    return model

def train(data: np.ndarray):
    scaler = MinMaxScaler()
    data_scaled = scaler.fit_transform(data)

    sequences = []
    for i in range(len(data_scaled) - SEQUENCE_LENGTH):
        sequences.append(data_scaled[i:i+SEQUENCE_LENGTH])
    X = np.array(sequences)

    model = build_lstm_autoencoder()
    model.fit(X, X, epochs=20, batch_size=32, validation_split=0.1, verbose=1)

    model.save("lstm_model.keras")
    with open("lstm_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    print("LSTM model saved.")

def predict_anomaly(sequence: np.ndarray, threshold=0.08):
    model = load_model("lstm_model.keras")
    with open("lstm_scaler.pkl", "rb") as f:
        scaler = pickle.load(f)

    seq_scaled = scaler.transform(sequence)
    seq_input = seq_scaled.reshape(1, SEQUENCE_LENGTH, FEATURES)
    reconstruction = model.predict(seq_input, verbose=0)
    loss = np.mean(np.abs(reconstruction - seq_input))
    return {"lstm_anomaly": bool(loss > threshold), "reconstruction_loss": float(loss)}