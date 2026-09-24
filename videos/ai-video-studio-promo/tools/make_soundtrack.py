"""Procedural soundtrack for the promo: music bed + SFX synced to index.html's timeline.

Deterministic (seeded noise), no network, no model. Output: assets/audio/soundtrack.mp3 (via ffmpeg)
Run: python3 tools/make_soundtrack.py
"""
import os
import subprocess
import wave

import numpy as np

SR = 44100
DUR = 24.0
BPM = 120
BEAT = 60 / BPM  # 0.5s — scene cuts at 4 / 9 / 14.5 / 19.5 all land on beats
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

# Must match index.html
PROMPT = "שקיעה מעל תל אביב, צילום רחפן קולנועי"
TYPE_START, TYPE_STEP = 4.8, 0.07
TYPED_END = TYPE_START + len(PROMPT) * TYPE_STEP
CUTS = [4.0, 9.0, 14.5, 19.5]


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(length, attack, release):
    n = int(length * SR)
    e = np.ones(n)
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def place(buf, sig, start):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def lowpass_fft(sig, cutoff):
    spec = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(len(sig), 1 / SR)
    spec *= 1 / (1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec, len(sig))


def bandpass_fft(sig, lo, hi):
    spec = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(len(sig), 1 / SR)
    spec *= (freqs > lo) & (freqs < hi)
    return np.fft.irfft(spec, len(sig))


# Section gains over time (intro → build → full → outro)
def ramp(points):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


music = np.zeros(N)
sfx = np.zeros(N)

# --- Pad: Am – F – C – G, one chord per bar (2s) ---
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
bar = 4 * BEAT
for b in range(int(DUR / bar)):
    notes = CHORDS[b % 4]
    seg_t = np.arange(int(bar * SR)) / SR
    chord = np.zeros_like(seg_t)
    for n in notes:
        for detune in (-0.12, 0.12):
            f = midi(n + detune)
            chord += np.sin(2 * np.pi * f * seg_t) + 0.3 * np.sin(4 * np.pi * f * seg_t)
    chord *= env(bar, 0.35, 0.45) / (len(notes) * 2)
    place(music, 0.22 * chord, b * bar)
music *= ramp([(0, 0.0), (0.6, 1.0), (21.5, 1.0), (24, 0.0)])

# --- Bass: root per bar, eighth-note pulse from 9s ---
bass = np.zeros(N)
for k in range(int(DUR / (BEAT / 2))):
    st = k * BEAT / 2
    if st < 9.0 or st >= 22.0:
        continue
    root = CHORDS[int(st / bar) % 4][0] - 12
    L = BEAT / 2
    seg_t = np.arange(int(L * SR)) / SR
    tone = np.tanh(2.2 * np.sin(2 * np.pi * midi(root) * seg_t))
    place(bass, 0.16 * tone * env(L, 0.005, 0.12), st)
music += lowpass_fft(bass, 900)

# --- Drums ---
def kick():
    L = 0.35
    kt = np.arange(int(L * SR)) / SR
    f = 50 + 110 * np.exp(-kt * 28)
    return 0.85 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-kt * 9)


def hat(level=0.08):
    L = 0.06
    n = bandpass_fft(rng.standard_normal(int(L * SR)), 7000, 16000)
    return level * n / (np.abs(n).max() + 1e-9) * np.exp(-np.arange(len(n)) / SR * 70)


def clap():
    L = 0.2
    n = bandpass_fft(rng.standard_normal(int(L * SR)), 900, 5000)
    return 0.22 * n / (np.abs(n).max() + 1e-9) * np.exp(-np.arange(len(n)) / SR * 22)


for k in range(int(DUR / BEAT)):
    st = k * BEAT
    if 9.0 <= st < 22.0:
        place(music, kick(), st)
        if k % 2 == 1:
            place(music, clap(), st)
    if 4.0 <= st < 22.0:
        place(music, hat(0.05), st + BEAT / 2)
    if 14.5 <= st < 22.0:
        place(music, hat(0.035), st)

# --- Pluck arpeggio in the features section ---
for k in range(int(DUR / (BEAT / 2))):
    st = k * BEAT / 2
    if not (14.5 <= st < 21.5):
        continue
    notes = CHORDS[int(st / bar) % 4]
    n = notes[k % 4] + 12
    L = 0.3
    pt = np.arange(int(L * SR)) / SR
    tone = np.sin(2 * np.pi * midi(n) * pt) + 0.4 * np.sin(4 * np.pi * midi(n) * pt)
    place(music, 0.07 * tone * np.exp(-pt * 12), st)

# --- SFX ---
def whoosh(end, length=0.9, level=0.35):
    n = rng.standard_normal(int(length * SR))
    wt = np.linspace(0, 1, len(n))
    n = bandpass_fft(n, 300, 6000) * wt ** 2.5
    n *= np.minimum(1, (1 - wt) * 12)
    place(sfx, level * n / (np.abs(n).max() + 1e-9), end - length + 0.05)


def click(at, level=0.10):
    L = 0.025
    n = bandpass_fft(rng.standard_normal(int(L * SR)), 2000, 9000)
    place(sfx, level * n / (np.abs(n).max() + 1e-9) * np.exp(-np.arange(len(n)) / SR * 220), at)


def ding(at, notes=(88, 95), level=0.16):
    L = 1.4
    dt = np.arange(int(L * SR)) / SR
    s = sum(np.sin(2 * np.pi * midi(n) * dt) for n in notes)
    place(sfx, level * s * np.exp(-dt * 3.2) * env(L, 0.004, 0.2), at)


def impact(at, level=0.7):
    L = 1.6
    it = np.arange(int(L * SR)) / SR
    boom = np.sin(2 * np.pi * (40 + 60 * np.exp(-it * 10)) * it) * np.exp(-it * 2.5)
    place(sfx, level * boom, at)


for c in CUTS:
    whoosh(c)
for i in range(len(PROMPT)):
    if PROMPT[i] != " ":
        click(TYPE_START + i * TYPE_STEP, 0.06 + 0.03 * ((i * 7) % 3) / 2)
click(TYPED_END + 0.3, 0.22)            # button press
ding(TYPED_END + 0.32, (81, 88), 0.10)  # button confirm
ding(12.6)                               # "ready ✓"
for at in (15.1, 15.45, 15.8):          # feature cards pop in
    ding(at, (76 + int((at - 15.1) / 0.35) * 3,), 0.07)
impact(19.6)                             # logo lands
ding(19.6, (69, 76, 81, 88), 0.08)

mix = music + sfx
mix *= ramp([(0, 1), (23.0, 1), (24, 0)])
mix = np.tanh(mix * 1.1)
mix /= np.abs(mix).max() / 0.89

# Light stereo widening: tiny delay on the right channel
right = np.concatenate([np.zeros(int(0.012 * SR)), mix])[:N]
stereo = np.stack([mix, 0.7 * mix + 0.3 * right], axis=1)

out = os.path.join(os.path.dirname(__file__), "..", "assets", "audio", "soundtrack.wav")
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
mp3 = out[:-4] + ".mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out, "-b:a", "192k", mp3], check=True)
os.remove(out)
print("wrote", os.path.normpath(mp3))
