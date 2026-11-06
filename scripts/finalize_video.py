#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
import numpy as np

VIDEO_DIR = Path("/home/user/workspace/supercharge-card-shop/video")
MANIFEST = json.loads((VIDEO_DIR / "scenes.json").read_text())
TOTAL_DUR = MANIFEST["total_duration"]

raw_webm = Path((VIDEO_DIR / "latest_raw_webm.txt").read_text().strip())
print(f"Inspecting raw WebM: {raw_webm}")

# Scan first 25 seconds of top-left 16x16 pixels at 50fps to find exact frame where #FF00FF curtain disappears
scan_fps = 50
cmd = [
    "ffmpeg", "-v", "error", "-t", "25", "-i", str(raw_webm),
    "-vf", f"fps={scan_fps},crop=16:16:10:10",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"
]
raw_bytes = subprocess.check_output(cmd)
frame_size = 16 * 16 * 3
n_frames = len(raw_bytes) // frame_size
frames = np.frombuffer(raw_bytes[:n_frames * frame_size], dtype=np.uint8).reshape((n_frames, 16, 16, 3))

# Find the last frame that is predominantly magenta (R > 200, G < 50, B > 200)
mean_rgb = frames.mean(axis=(1, 2))
is_magenta = (mean_rgb[:, 0] > 190) & (mean_rgb[:, 1] < 60) & (mean_rgb[:, 2] > 190)
magenta_indices = np.where(is_magenta)[0]

if len(magenta_indices) > 0:
    first_clean_frame = int(magenta_indices[-1]) + 2
    t_trim = round(first_clean_frame / scan_fps, 3)
else:
    t_trim = 0.0

print(f"Detected warmup curtain removal at t_trim = {t_trim:.3f}s")

out_mp4 = Path("/home/user/workspace/supercharge-card-shop/supercharge_vintage_card_shop_showcase.mp4")
master_wav = VIDEO_DIR / "master_audio.wav"

ffmpeg_cmd = [
    "ffmpeg", "-y",
    "-ss", f"{t_trim:.3f}",
    "-i", str(raw_webm),
    "-i", str(master_wav),
    "-t", f"{TOTAL_DUR:.2f}",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "17",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-movflags", "+faststart",
    str(out_mp4)
]
print("Encoding final 1080p30 H.264 MP4...")
subprocess.run(ffmpeg_cmd, check=True)

# Verify output streams
probe = subprocess.check_output([
    "ffprobe", "-v", "error",
    "-show_entries", "format=duration,size:stream=codec_name,width,height,r_frame_rate",
    "-of", "json", str(out_mp4)
]).decode()
print("FFprobe verification:", probe)

# Extract 16 midpoint QA frames (one per scene)
qa_dir = VIDEO_DIR / "qa_frames"
qa_dir.mkdir(parents=True, exist_ok=True)
for idx, sc in enumerate(MANIFEST["scenes"], start=1):
    mid_t = round((sc["start_time"] + sc["end_time"]) / 2.0, 2)
    out_jpg = qa_dir / f"scene_{idx:02d}_{sc['id']}.jpg"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        "-ss", f"{mid_t:.2f}",
        "-i", str(out_mp4),
        "-frames:v", "1",
        "-q:v", "2",
        str(out_jpg)
    ], check=True)
print(f"Extracted 16 QA frames to {qa_dir}")
