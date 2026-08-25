"""Central trainer color legend for Batch 2 WEBP matrix parsing.

Only maps colors with established trainer semantics (SOURCE_NOTES + legend sampling).
Unknown saturated colors remain NEEDS_CLARIFICATION — never inferred as FOLD.
"""

from __future__ import annotations

import math
from typing import Optional, Tuple

# Canonical hand order: upper triangle suited, diagonal pairs, lower offsuit
RANKS = list("AKQJT98765432")

HAND_ORDER: list[str] = []
for i, r1 in enumerate(RANKS):
    for j, r2 in enumerate(RANKS):
        if i < j:
            HAND_ORDER.append(f"{r1}{r2}s")
        elif i > j:
            HAND_ORDER.append(f"{r2}{r1}o")
        else:
            HAND_ORDER.append(f"{r1}{r2}")

# Grid geometry — validated on 434×600 WEBP charts
GRID_X0 = 35
GRID_Y0 = 85
GRID_CELL = 26
GRID_MARGIN = 5

# Legend entries: refs are representative RGB centroids from trainer charts
LEGEND_ENTRIES = [
    {
        "id": "AI",
        "rawAction": "AI",
        "refs": [(64, 0, 144), (48, 0, 120), (48, 0, 96), (72, 0, 120), (48, 16, 80), (72, 48, 72)],
        "tolerance": 42,
        "gradingAllowed": True,
        "dataStatus": "EXACT_TRAINER_DATA",
    },
    {
        "id": "LOW_PLAYABILITY",
        "rawAction": "LOW_PLAYABILITY",
        "refs": [(48, 224, 240), (64, 208, 224), (48, 224, 224)],
        "tolerance": 45,
        "gradingAllowed": False,
        "dataStatus": "NEEDS_CLARIFICATION",
    },
    {
        "id": "GREEN",
        "rawAction": None,  # resolved via stack → nAI or RAISE
        "refs": [
            (64, 160, 0), (80, 160, 16), (80, 144, 16), (64, 160, 16),
            (80, 144, 32), (96, 240, 0), (96, 240, 16), (112, 240, 64), (112, 240, 80),
        ],
        "tolerance": 50,
        "gradingAllowed": None,
        "dataStatus": None,
        "stackResolve": True,
    },
    {
        "id": "UNSELECTED",
        "rawAction": "UNSELECTED",
        "refs": [
            (55, 54, 61), (54, 52, 60), (52, 51, 58), (56, 55, 62), (51, 50, 57),
            (38, 37, 44), (48, 48, 48), (64, 64, 64), (40, 38, 46), (72, 72, 96),
        ],
        "tolerance": 22,
        "gradingAllowed": False,
        "dataStatus": "NEEDS_CLARIFICATION",
        "gray": True,
    },
]

# Orange/yellow families seen in legends — semantics NOT confirmed → store bucket only
UNKNOWN_COLOR_FAMILIES = [
    {"bucket": "ORANGE_208_160_32", "refs": [(208, 160, 32), (208, 160, 48), (208, 144, 32), (192, 144, 24), (216, 144, 48)], "tolerance": 40},
    {"bucket": "YELLOW_240_240_48", "refs": [(240, 240, 48), (224, 240, 48), (208, 160, 64)], "tolerance": 40},
]


def color_dist(a: Tuple[int, int, int], b: Tuple[int, int, int]) -> float:
    return math.sqrt(sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)))


from stackParser import green_action_for_stack, parse_stack_bb, parse_trainer_stack


def match_legend(
    rgb: Tuple[int, int, int],
    stack_raw: Optional[str] = None,
    stack_bb: Optional[float] = None,
) -> Optional[dict]:
    _ = stack_bb  # legacy arg
    r, g, b = rgb
    best = None
    best_d = 1e9

    for entry in LEGEND_ENTRIES:
        for ref in entry["refs"]:
            d = color_dist(rgb, ref)
            if d <= entry["tolerance"] and d < best_d:
                best = (entry, d)
                best_d = d

    if best:
        entry, d = best
        if entry.get("stackResolve"):
            raw, gradable, status, _note = green_action_for_stack(stack_raw)
            return {
                "legendId": entry["id"],
                "rawAction": raw,
                "gradingAllowed": gradable,
                "dataStatus": status,
                "confidence": "HIGH" if d < 20 else "MEDIUM",
                "colorDistance": round(d, 1),
            }
        return {
            "legendId": entry["id"],
            "rawAction": entry["rawAction"],
            "gradingAllowed": bool(entry["gradingAllowed"]),
            "dataStatus": entry["dataStatus"],
            "confidence": "HIGH" if d < 20 else "MEDIUM",
            "colorDistance": round(d, 1),
        }

    for fam in UNKNOWN_COLOR_FAMILIES:
        for ref in fam["refs"]:
            if color_dist(rgb, ref) <= fam["tolerance"]:
                return {
                    "legendId": "UNKNOWN_COLOR",
                    "rawAction": fam["bucket"],
                    "gradingAllowed": False,
                    "dataStatus": "NEEDS_CLARIFICATION",
                    "confidence": "LOW",
                    "colorDistance": round(color_dist(rgb, ref), 1),
                    "unknownColor": True,
                }

    # Saturated but unmapped
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn > 25 and mx > 60:
        bucket = f"COLOR_{r // 16 * 16}_{g // 16 * 16}_{b // 16 * 16}"
        return {
            "legendId": "UNKNOWN_COLOR",
            "rawAction": bucket,
            "gradingAllowed": False,
            "dataStatus": "NEEDS_CLARIFICATION",
            "confidence": "LOW",
            "unknownColor": True,
            "colorBucket": [r // 16 * 16, g // 16 * 16, b // 16 * 16],
        }

    return None
