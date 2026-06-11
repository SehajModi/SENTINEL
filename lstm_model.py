import numpy as np
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.callbacks import EarlyStopping
import pickle
import os

SEQUENCE_LENGTH = 10
FEATURES = 3  # temperature, vibration, pressure

DATA_DIR   = "/app/data"
MODEL_PATH  = os.path.join(DATA_DIR, "lstm_model.keras")
SCALER_PATH = os.path.join(DATA_DIR, "lstm_scaler.pkl")
STATS_PATH  = os.path.join(DATA_DIR, "lstm_stats.pkl")  # stores loss baseline


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
        sequences.append(data_scaled[i:i + SEQUENCE_LENGTH])
    X = np.array(sequences)

    model = build_lstm_autoencoder()
    early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
    model.fit(X, X, epochs=50, batch_size=32, validation_split=0.1,
              callbacks=[early_stop], verbose=1)

    model.save(MODEL_PATH)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)

    # ── Compute and save loss baseline on training data ────────────────────
    # Run every training sequence through the model and record losses.
    # This gives us a distribution of "normal" loss to compare live readings against.
    reconstructions = model.predict(X, verbose=0)
    losses = np.mean(np.abs(reconstructions - X), axis=(1, 2))
    stats = {
        "mean": float(np.mean(losses)),
        "std":  float(np.std(losses)),
        "p95":  float(np.percentile(losses, 95)),  # 95th percentile of normal loss
        "p99":  float(np.percentile(losses, 99)),
        "n":    len(losses),
    }
    with open(STATS_PATH, "wb") as f:
        pickle.dump(stats, f)

    print(f"LSTM model saved. Loss baseline — mean: {stats['mean']:.4f}, std: {stats['std']:.4f}, p95: {stats['p95']:.4f}")


def predict_anomaly(sequence: np.ndarray, threshold=0.15):
    model = load_model(MODEL_PATH)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)

    seq_scaled  = scaler.transform(sequence)
    seq_input   = seq_scaled.reshape(1, SEQUENCE_LENGTH, FEATURES)
    reconstruction = model.predict(seq_input, verbose=0)
    loss = float(np.mean(np.abs(reconstruction - seq_input)))

    # ── Attach z-score if baseline stats exist ─────────────────────────────
    z_score = None
    if os.path.exists(STATS_PATH):
        with open(STATS_PATH, "rb") as f:
            stats = pickle.load(f)
        if stats["std"] > 0:
            z_score = round((loss - stats["mean"]) / stats["std"], 2)

    return {
        "lstm_anomaly":       bool(loss > threshold),
        "reconstruction_loss": loss,
        "loss_z_score":        z_score,
    }


def get_model_stats():
    """Return the loss baseline computed at training time."""
    if not os.path.exists(STATS_PATH):
        return None
    with open(STATS_PATH, "rb") as f:
        return pickle.load(f)