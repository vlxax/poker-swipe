#!/usr/bin/env python3
"""Conservative WEBP matrix color extraction for Batch 2 trainer charts.

Does NOT invent action semantics. Maps only high-confidence colors calibrated
from UO SOURCE_NOTES. Everything else → rawColor + NEEDS_CLARIFICATION.
"""
from __future__ import annotations

import json
import os
import sys
import zipfile
from collections import Counter
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("PIL required", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[2]
CHARTS_ZIP_DIR = ROOT / "data/trainer/charts"
EXTRACT_DIR = ROOT / "data/trainer/built/chart-images"
OUTPUT = ROOT / "data/trainer/built/batch2-parsed-hands.json"

RANKS = list("AKQJT98765432")

# Calibrated from UO + batch2 sampling — tolerance bucket step
def quantize(rgb, step=16):
    return tuple((int(c) // step) * step for c in rgb[:3])

# High-confidence mappings only
CONFIDENT_COLOR_ACTION = {
    (64, 0, 128): ("AI", "HIGH"),
    (80, 0, 160): ("AI", "HIGH"),
    (48, 0, 96): ("AI", "MEDIUM"),
}

UNSELECTED_BUCKETS = {
    (48, 48, 48),
    (48, 48, 64),
    (32, 32, 32),
    (32, 32, 48),
    (64, 64, 64),
    (64, 64, 80),
}

HAND_ORDER = []
for i, r1 in enumerate(RANKS):
    for j, r2 in enumerate(RANKS):
        if i < j:
            HAND_ORDER.append(f"{r1}{r2}s")
        elif i > j:
            HAND_ORDER.append(f"{r2}{r1}o")
        else:
            HAND_ORDER.append(f"{r1}{r2}")


def ensure_extracted():
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    existing = list(EXTRACT_DIR.glob("*.webp"))
    if len(existing) >= 1570:
        return
    for zf in sorted(CHARTS_ZIP_DIR.glob("charts_*.zip")):
        with zipfile.ZipFile(zf) as z:
            z.extractall(EXTRACT_DIR)


def classify_color(rgb):
    q = quantize(rgb, 16)
    for ref, (action, conf) in CONFIDENT_COLOR_ACTION.items():
        if all(abs(q[i] - ref[i]) <= 20 for i in range(3)):
            return action, conf, q
    if q in UNSELECTED_BUCKETS or (40 <= q[0] <= 72 and abs(q[0]-q[1]) < 8 and abs(q[1]-q[2]) < 16):
        return "UNSELECTED", "MEDIUM", q
    return None, "LOW", q


def extract_grid(path, x0=45, y0=95, cell=28):
    im = Image.open(path).convert("RGB")
    hands = {}
    for r in range(13):
        for c in range(13):
            cx = x0 + c * cell + cell // 2
            cy = y0 + r * cell + cell // 2
            if cx >= im.width or cy >= im.height:
                continue
            rgb = im.getpixel((cx, cy))
            action, conf, bucket = classify_color(rgb)
            hand = HAND_ORDER[r * 13 + c]
            if action:
                status = "EXACT_TRAINER_DATA" if action == "AI" and conf == "HIGH" else "NEEDS_CLARIFICATION"
                hands[hand] = {
                    "actionRaw": action,
                    "dataStatus": status,
                    "colorConfidence": conf,
                    "colorBucket": list(bucket),
                    "parserStatus": "WEBP_COLOR_EXTRACT"
                }
            else:
                hands[hand] = {
                    "actionRaw": None,
                    "rawColor": list(bucket),
                    "dataStatus": "NEEDS_CLARIFICATION",
                    "colorConfidence": conf,
                    "parserStatus": "WEBP_COLOR_UNMAPPED"
                }
    return hands


def main():
    ensure_extracted()
    manifest_path = ROOT / "data/trainer/source/RANGE_CHART_MANIFEST.csv"
    import csv

    rows = list(csv.DictReader(open(manifest_path)))
    parsed = {}
    stats = Counter()

    for row in rows:
        chart_num = row["compressed_file"].split("/")[-1].replace(".webp", "")
        img = EXTRACT_DIR / f"{chart_num}.webp"
        if not img.exists():
            stats["missing_image"] += 1
            continue
        hands = extract_grid(str(img))
        exact = sum(1 for h in hands.values() if h.get("dataStatus") == "EXACT_TRAINER_DATA")
        partial = sum(1 for h in hands.values() if h.get("parserStatus") == "WEBP_COLOR_EXTRACT")
        unclear = sum(1 for h in hands.values() if h.get("dataStatus") == "NEEDS_CLARIFICATION")
        parsed[row["chart_id"]] = {
            "chartId": row["chart_id"],
            "hands": hands,
            "parseStats": {"exact": exact, "partial": partial, "needsClarification": unclear}
        }
        stats["charts"] += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump({"charts": parsed, "stats": dict(stats)}, f)
    print(json.dumps({"output": str(OUTPUT), "stats": dict(stats)}, indent=2))


if __name__ == "__main__":
    main()
