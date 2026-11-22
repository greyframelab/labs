# Noche completa → partitura binaria compacta para la app (2 Hz, 6 bandas × 5 canales, uint8)
import mne, numpy as np, json, sys
# Uso (desde cortex/): python3 tools/eeg_night.py n16.edf  ·  n16.edf = CAP Sleep Database (PhysioNet), sujeto sano n16
from scipy import signal
r = mne.io.read_raw_edf(sys.argv[1], preload=True, verbose=False)
X = r.get_data() * 1e6; fs = r.info['sfreq']
bands = [('delta',(0.5,4)),('theta',(4,8)),('alpha',(8,12)),('sigma',(12,15)),('beta',(15,30)),('gamma',(30,45))]
HZ = 2; step = int(fs / HZ); n = X.shape[1] // step
out = np.zeros((n, len(bands), X.shape[0]), np.uint8)
for bi, (k, (lo, hi)) in enumerate(bands):
    b, a = signal.butter(3, [lo/(fs/2), hi/(fs/2)], 'band'); y = signal.filtfilt(b, a, X, axis=1)
    e = np.abs(signal.hilbert(y, axis=1)); b2, a2 = signal.butter(2, 1.0/(fs/2)); e = signal.filtfilt(b2, a2, e, axis=1)
    lo5, hi99 = np.percentile(e, 5, axis=1, keepdims=True), np.percentile(e, 99, axis=1, keepdims=True)
    v = np.clip((e - lo5) / (hi99 - lo5), 0, 1.5)[:, :n*step:step]
    out[:, bi, :] = np.round(v.T / 1.5 * 255)
art = np.abs(X[:, :n*step]).reshape(X.shape[0], n, step).max(axis=(0, 2)) > 350
out.tofile('noche.bin')
# ventanas válidas de 32 s (sin artefactos)
W = 32 * HZ
valid = [i for i in range(0, n - W, 8) if not art[i:i+W].any()]
json.dump({'hz': HZ, 'n': int(n), 'bandas': [k for k, _ in bands], 'canales': r.ch_names, 'ventanas': valid,
           'fuente': 'CAP Sleep Database n16 (PhysioNet, ODC-BY)'}, open('noche.json', 'w'))
print(out.shape, len(valid), 'ventanas válidas', out.nbytes/1e6, 'MB')
