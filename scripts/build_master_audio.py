#!/usr/bin/env python3
import json
import math
import subprocess
import wave
from pathlib import Path
import numpy as np

VIDEO_DIR = Path("/home/user/workspace/supercharge-card-shop/video")
AUDIO_DIR = VIDEO_DIR / "audio"
MANIFEST = json.loads((VIDEO_DIR / "scenes.json").read_text())
TOTAL_DUR = MANIFEST["total_duration"]
SR = 48000
N_SAMPLES = int(math.ceil(TOTAL_DUR * SR)) + SR  # +1s tail fade

# Stereo buffer [N, 2]
mix = np.zeros((N_SAMPLES, 2), dtype=np.float32)

def add_mono(buf_mono, start_sec, gain=1.0, pan=0.0):
    idx0 = int(start_sec * SR)
    if idx0 < 0 or idx0 >= N_SAMPLES:
        return
    n = min(len(buf_mono), N_SAMPLES - idx0)
    if n <= 0:
        return
    left_gain = gain * math.cos((pan + 1.0) * math.pi / 4.0)
    right_gain = gain * math.sin((pan + 1.0) * math.pi / 4.0)
    mix[idx0:idx0 + n, 0] += buf_mono[:n] * left_gain
    mix[idx0:idx0 + n, 1] += buf_mono[:n] * right_gain

# 1. Warm vintage collector's lounge ambient pad (very subtle, -29 dB)
t_full = np.arange(N_SAMPLES, dtype=np.float32) / SR
chords = [
    [174.61, 220.00, 261.63, 329.63, 392.00],  # Fmaj9
    [164.81, 196.00, 246.94, 293.66, 392.00],  # Em7
    [146.83, 174.61, 220.00, 261.63, 329.63],  # Dm9
    [130.81, 164.81, 196.00, 246.94, 293.66],  # Cmaj9
]
bar_len = 8.0
pad_l = np.zeros(N_SAMPLES, dtype=np.float32)
pad_r = np.zeros(N_SAMPLES, dtype=np.float32)
for i in range(int(TOTAL_DUR / bar_len) + 2):
    c = chords[i % len(chords)]
    s0 = int(i * bar_len * SR)
    s1 = min(N_SAMPLES, int((i + 1.15) * bar_len * SR))
    if s0 >= N_SAMPLES or s1 <= s0:
        continue
    seg_t = np.arange(s1 - s0, dtype=np.float32) / SR
    seg_dur = (s1 - s0) / SR
    env = np.sin(np.pi * np.clip(seg_t / seg_dur, 0, 1)) ** 1.4
    chord_l = np.zeros_like(seg_t)
    chord_r = np.zeros_like(seg_t)
    for k, freq in enumerate(c):
        detune = 1.0 + (k - 2) * 0.0008
        chord_l += np.sin(2 * np.pi * freq * seg_t) * (0.22 / (1 + 0.25 * k))
        chord_r += np.sin(2 * np.pi * freq * detune * seg_t + 0.4) * (0.22 / (1 + 0.25 * k))
    pad_l[s0:s1] += chord_l * env * 0.028
    pad_r[s0:s1] += chord_r * env * 0.028

mix[:, 0] += pad_l
mix[:, 1] += pad_r

# 2. Synthesized SFX generators
rng = np.random.default_rng(48)

def synth_foil_crinkle(dur=0.11, intensity=0.5):
    n = int(dur * SR)
    t = np.linspace(0, dur, n, dtype=np.float32)
    env = np.sin(np.pi * (t / dur))
    noise = rng.uniform(-1, 1, n).astype(np.float32)
    spikes = (rng.uniform(0, 1, n) > 0.88).astype(np.float32) * 2.2 + 0.35
    carrier = np.sin(2 * np.pi * 3800 * t + np.sin(2 * np.pi * 190 * t) * 4.0)
    return noise * spikes * carrier * env * (0.08 * intensity)

def synth_pack_rip():
    # 0.42s metallic foil tear + 0.65s holographic chord chime
    n = int(1.05 * SR)
    out = np.zeros(n, dtype=np.float32)
    n_tear = int(0.42 * SR)
    t_tear = np.linspace(0, 0.42, n_tear, dtype=np.float32)
    env_tear = np.clip(np.sin(np.pi * (t_tear / 0.42)), 0.0, 1.0) ** 0.7
    noise = rng.uniform(-1, 1, n_tear).astype(np.float32)
    sweep_f = np.linspace(1400, 5600, n_tear, dtype=np.float32)
    mod = np.sin(2 * np.pi * np.cumsum(sweep_f) / SR)
    out[:n_tear] += noise * mod * env_tear * 0.14

    # Shimmering arpeggio chord
    arp_freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]
    for i, f in enumerate(arp_freqs):
        st = int((0.18 + i * 0.055) * SR)
        nd = min(n, st + int(0.55 * SR))
        tt = np.arange(nd - st, dtype=np.float32) / SR
        env = np.exp(-tt * 6.5) * np.minimum(1.0, tt / 0.012)
        tone = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.0 * tt)) * env * 0.055
        out[st:nd] += tone
    return out

def synth_holo_shimmer(pitch_mult=1.0):
    dur = 0.48
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    freqs = [587.33 * pitch_mult, 880.0 * pitch_mult, 1174.66 * pitch_mult, 1760.0 * pitch_mult]
    for i, f in enumerate(freqs):
        st = int(i * 0.04 * SR)
        tt = np.arange(n - st, dtype=np.float32) / SR
        env = np.exp(-tt * 8.0) * np.minimum(1.0, tt / 0.01)
        out[st:] += np.sin(2 * np.pi * f * tt) * env * 0.038
    return out

def synth_card_flip():
    dur = 0.24
    n = int(dur * SR)
    t = np.linspace(0, dur, n, dtype=np.float32)
    env = np.clip(np.sin(np.pi * (t / dur)), 0.0, 1.0) ** 1.3
    noise = rng.uniform(-1, 1, n).astype(np.float32)
    f = np.linspace(450, 1400, n, dtype=np.float32)
    return noise * np.sin(2 * np.pi * np.cumsum(f) / SR) * env * 0.075

def synth_brass_click():
    dur = 0.06
    n = int(dur * SR)
    t = np.linspace(0, dur, n, dtype=np.float32)
    env = np.exp(-t * 65.0)
    return (np.sin(2 * np.pi * 1120 * t) + 0.5 * np.sin(2 * np.pi * 2240 * t)) * env * 0.05

# Schedule SFX synced to scene events
# s01 & s02 foil crinkles
for ts in [2.4, 5.2, 10.5, 12.6, 14.8]:
    add_mono(synth_foil_crinkle(0.12, 0.55), ts, gain=0.85)

# Booster pack rips at s03, s07, s08, s09, s10
rip_times = [
    MANIFEST["scenes"][2]["start_time"] + 1.15,  # s03 Wall Street
    MANIFEST["scenes"][6]["start_time"] + 1.25,  # s07 Auteur
    MANIFEST["scenes"][7]["start_time"] + 1.25,  # s08 Design Craft
    MANIFEST["scenes"][8]["start_time"] + 1.25,  # s09 Systems
    MANIFEST["scenes"][9]["start_time"] + 1.25,  # s10 Deal Desk
]
for rt in rip_times:
    add_mono(synth_pack_rip(), rt, gain=0.95)

# s04 5-card fan hover shimmers
s04_t = MANIFEST["scenes"][3]["start_time"]
for idx in range(5):
    add_mono(synth_holo_shimmer(0.92 + idx * 0.07), s04_t + 1.1 + idx * 1.45, gain=0.75, pan=(idx - 2) * 0.25)

# s05 modal open + s06 card flips
s05_t = MANIFEST["scenes"][4]["start_time"]
add_mono(synth_holo_shimmer(1.15), s05_t + 0.85, gain=0.85)
s06_t = MANIFEST["scenes"][5]["start_time"]
add_mono(synth_card_flip(), s06_t + 1.4, gain=0.95)
add_mono(synth_card_flip(), s06_t + 4.8, gain=0.95)

# Room transitions & filter clicks (s11, s12, s13, s14, s15, s16)
for sc_idx in [10, 11, 12, 13, 14, 15]:
    st = MANIFEST["scenes"][sc_idx]["start_time"]
    add_mono(synth_brass_click(), st + 0.35, gain=0.9)
    add_mono(synth_brass_click(), st + 2.8, gain=0.75)
    add_mono(synth_holo_shimmer(1.0 + (sc_idx % 3) * 0.08), st + 3.0, gain=0.55)

# 3. Decode & place each ElevenLabs Chris narration clip at scene.start_time + 0.16s
for sc in MANIFEST["scenes"]:
    mp3_path = Path(sc["audio_path"])
    wav_tmp = AUDIO_DIR / f"{sc['id']}_48k.wav"
    subprocess.run([
        "ffmpeg", "-y", "-i", str(mp3_path),
        "-af", "highpass=f=75,acompressor=threshold=-18dB:ratio=2.5:attack=10:release=120,loudnorm=I=-15:TP=-1.5:LRA=9",
        "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", str(wav_tmp)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    with wave.open(str(wav_tmp), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
        vo = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    add_mono(vo, sc["start_time"] + 0.16, gain=1.0, pan=0.0)

# Trim to exact TOTAL_DUR and apply gentle 0.6s fade-out at the very end
exact_samples = int(round(TOTAL_DUR * SR))
mix = mix[:exact_samples]
fade_n = int(0.6 * SR)
fade_curve = np.linspace(1.0, 0.0, fade_n, dtype=np.float32)[:, None]
mix[-fade_n:] *= fade_curve

# Soft-clip limiter
mix = np.tanh(mix * 1.08) * 0.92
pcm16 = np.clip(mix * 32767.0, -32768, 32767).astype(np.int16)

out_wav = VIDEO_DIR / "master_audio.wav"
with wave.open(str(out_wav), "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm16.tobytes())

print(f"Wrote {out_wav} ({TOTAL_DUR:.2f}s, {out_wav.stat().st_size / 1e6:.2f} MB)")
