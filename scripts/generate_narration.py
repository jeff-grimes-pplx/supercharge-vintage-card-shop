#!/usr/bin/env python3
import json
import os
import subprocess
from pathlib import Path
import requests

OUT_DIR = Path("/home/user/workspace/supercharge-card-shop/video/audio")
OUT_DIR.mkdir(parents=True, exist_ok=True)

VOICE_ID = "iP95p4xoKVk53GoZ742B"  # Chris
MODEL_ID = "eleven_v3"

SCENES = [
    {
        "id": "s01",
        "zoom": 1.0,
        "caption": "Perplexity Computer connects to 72 skills, plugin bundles, and live data feeds inside one 3D vintage card shop.",
        "narration": "Perplexity Computer connects to seventy-two specialized skills, plugins, and live data feeds, so we built a 3D card shop to explore them all."
    },
    {
        "id": "s02",
        "zoom": 1.0,
        "caption": "Step up to a brass and mahogany counter stocked with six collectible first-edition booster packs.",
        "narration": "Instead of scrolling through a flat settings list, you step up to a brass and mahogany counter stocked with six collectible first-edition booster packs."
    },
    {
        "id": "s03",
        "zoom": 1.0,
        "caption": "Slice across the top foil seam to peel back the wrapper in Three.js and fan out five holographic cards.",
        "narration": "When you slice across the top foil seam, the wrapper peels back in Three.js and fans out five holographic cards from the Wall Street and Alpha series."
    },
    {
        "id": "s04",
        "zoom": 1.16,
        "caption": "Custom GLSL diffraction shaders shift rainbow specular bands and cosmos starfields across the artwork as you tilt.",
        "narration": "Every card runs a custom GLSL diffraction shader that shifts rainbow specular bands and cosmos starfields across the artwork as you tilt your cursor."
    },
    {
        "id": "s05",
        "zoom": 1.0,
        "caption": "Click any card to open the 3D inspector with its exact load command, trigger phrases, and flagship prompt.",
        "narration": "Clicking any card opens the 3D inspector with its exact load command, trigger phrases, and a flagship prompt ready for Perplexity Computer."
    },
    {
        "id": "s06",
        "zoom": 1.14,
        "caption": "Flip the card to inspect its 1st-Edition astrolabe backplate, or click straight through to install on Perplexity.",
        "narration": "You can flip the card to inspect its first-edition astrolabe backplate, or click straight through to the live skill and connector pages on Perplexity."
    },
    {
        "id": "s07",
        "zoom": 1.0,
        "caption": "Pack 02 — Auteur & 3D Studio: Lemo-Opuscar code cinema, 5-minute science documentaries, and Brickify 3D LEGO.",
        "narration": "The Auteur and 3D Studio pack pulls Lemo-Opuscar code cinema, science documentaries, and the Brickify LEGO compiler."
    },
    {
        "id": "s08",
        "zoom": 1.0,
        "caption": "Pack 03 — Design Craft & Web Atelier: Website Building, Scroll-Story Landings, Taste-Skill, and Impeccable QA.",
        "narration": "The Design Craft pack pairs website building and scroll-story pages with Taste-Skill art direction and Impeccable QA."
    },
    {
        "id": "s09",
        "zoom": 1.0,
        "caption": "Pack 04 — Systems, Silicon & Red-Team: Security Audits, Graphify architecture maps, Datadog, and Advance-PR.",
        "narration": "For engineers, the Systems pack bundles security audits, Graphify knowledge graphs, Datadog telemetry, and autonomous PR shipping."
    },
    {
        "id": "s10",
        "zoom": 1.0,
        "caption": "Packs 05 & 06 — Deal Desk, Legal & Core Superpowers: Contract redlining, supplier risk scans, and live browser control.",
        "narration": "The Deal Desk and Core Superpowers packs cover contract redlining, supplier risk scans, and live browser control."
    },
    {
        "id": "s11",
        "zoom": 1.0,
        "caption": "Room 02 — Illuminated Glass Display Cases: Browse flagship cards shelf by shelf under warm tungsten cabinet lamps.",
        "narration": "Moving into the Illuminated Glass Display Cases lets you browse flagship cards shelf by shelf under warm tungsten cabinet lights."
    },
    {
        "id": "s12",
        "zoom": 1.15,
        "caption": "Filter display cabinets by foil tier to isolate Mythic plugin bundles or Gold connectors like FactSet and Daloopa.",
        "narration": "Filter the display cabinets by foil tier to isolate Mythic plugin bundles or Gold connectors from FactSet, Daloopa, and Carbon Arc."
    },
    {
        "id": "s13",
        "zoom": 1.0,
        "caption": "Room 03 — Complete 72-Card Collector Binder across global, organization, individual, and project scopes.",
        "narration": "The Collector Binder holds all seventy-two verified entries across every scope, with one-click JSON and CSV exports."
    },
    {
        "id": "s14",
        "zoom": 1.12,
        "caption": "Instant search and type filters narrow by trigger phrase, publisher, or capability type with direct Perplexity routing.",
        "narration": "Instant search and type filters let you narrow by trigger phrase, publisher, or capability type and jump directly to its install page."
    },
    {
        "id": "s15",
        "zoom": 1.0,
        "caption": "Room 04 — Loadout Deck Builder: Equip up to six cards or load curated presets like the Wall Street Deal Team.",
        "narration": "Finally, the Loadout Deck Builder lets you equip up to six cards at once, or load curated presets like the Wall Street Deal Team."
    },
    {
        "id": "s16",
        "zoom": 1.0,
        "caption": "Synthesize a chained multi-skill master prompt in one click. Explore the full 3D card shop and 72-card catalog now.",
        "narration": "It synthesizes a chained multi-skill master prompt ready to paste into Perplexity Computer. Explore the full 3D card shop and catalog now."
    }
]

CHANGED_IDS = {"s07", "s08", "s09", "s10", "s13"}

def get_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ]).decode().strip()
    return float(out)

manifest = []
total_dur = 0.0

for s in SCENES:
    mp3_path = OUT_DIR / f"{s['id']}.mp3"
    if s["id"] in CHANGED_IDS or not mp3_path.exists() or mp3_path.stat().st_size < 1000:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
        resp = requests.post(
            url,
            headers={"Accept": "audio/mpeg", "Content-Type": "application/json"},
            json={
                "text": s["narration"],
                "model_id": MODEL_ID,
                "voice_settings": {
                    "stability": 0.55,
                    "similarity_boost": 0.78
                }
            },
            timeout=60
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Failed {s['id']}: {resp.status_code} {resp.text[:200]}")
        mp3_path.write_bytes(resp.content)
    voice_dur = get_duration(mp3_path)
    scene_dur = max(6.8, round(voice_dur + 0.45, 2))
    manifest.append({
        **s,
        "audio_path": str(mp3_path),
        "voice_duration": round(voice_dur, 2),
        "scene_duration": scene_dur,
        "start_time": round(total_dur, 2),
        "end_time": round(total_dur + scene_dur, 2)
    })
    total_dur += scene_dur
    print(f"{s['id']}: voice={voice_dur:.2f}s -> scene={scene_dur:.2f}s (cum={total_dur:.2f}s)")

manifest_path = Path("/home/user/workspace/supercharge-card-shop/video/scenes.json")
manifest_path.write_text(json.dumps({"total_duration": round(total_dur, 2), "scenes": manifest}, indent=2))
print(f"Total video duration: {total_dur:.2f}s")
