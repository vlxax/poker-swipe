#!/usr/bin/env python3
"""Batch 2 WEBP 13×13 matrix parser — hand-level strategy extraction.

Parses all 1,578 trainer WEBP charts into structured hand records with:
- 169 canonical cells per chart
- mixed-cell strategy components (no collapse)
- conservative legend mapping (no gray→fold)
- per-chart validation

Output: data/trainer/built/batch2-parsed-hands.json
        data/trainer/built/batch2-hand-records.json (compact flat index)
        data/trainer/built/batch2-parse-report.json
"""
from __future__ import annotations

import csv
import json
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from PIL import Image
except ImportError:
    print("PIL required: pip install pillow", file=sys.stderr)
    sys.exit(1)

from batch2ColorLegend import (
    GRID_CELL,
    GRID_MARGIN,
    GRID_X0,
    GRID_Y0,
    HAND_ORDER,
    LEGEND_ENTRIES,
    UNKNOWN_COLOR_FAMILIES,
    match_legend,
)
from stackParser import parse_trainer_stack

ROOT = Path(__file__).resolve().parents[2]
CHARTS_ZIP_DIR = ROOT / "data/trainer/charts"
EXTRACT_DIR = ROOT / "data/trainer/built/chart-images"
MANIFEST = ROOT / "data/trainer/source/RANGE_CHART_MANIFEST.csv"
OUTPUT_PARSED = ROOT / "data/trainer/built/batch2-parsed-hands.json"
OUTPUT_FLAT = ROOT / "data/trainer/built/batch2-hand-records.json"
OUTPUT_REPORT = ROOT / "data/trainer/built/batch2-parse-report.json"

MIXED_THRESHOLD = 0.12  # min share for secondary action in mixed cell
DOMINANT_THRESHOLD = 0.85  # single-action dominance


def ensure_extracted() -> None:
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    existing = list(EXTRACT_DIR.glob("*.webp"))
    if len(existing) >= 1570:
        return
    for zf in sorted(CHARTS_ZIP_DIR.glob("charts_*.zip")):
        with zipfile.ZipFile(zf) as z:
            z.extractall(EXTRACT_DIR)


def sample_cell_pixels(im: Image.Image, r: int, c: int) -> List[Tuple[int, int, int]]:
    x0 = GRID_X0 + c * GRID_CELL + GRID_MARGIN
    y0 = GRID_Y0 + r * GRID_CELL + GRID_MARGIN
    x1 = GRID_X0 + (c + 1) * GRID_CELL - GRID_MARGIN
    y1 = GRID_Y0 + (r + 1) * GRID_CELL - GRID_MARGIN
    pixels = []
    for x in range(x0, x1, 2):
        for y in range(y0, y1, 2):
            if x < im.width and y < im.height:
                pixels.append(im.getpixel((x, y)))
    return pixels


def aggregate_cell_strategies(
    pixels: List[Tuple[int, int, int]], stack_raw: Optional[str]
) -> Dict[str, Any]:
    action_counts: Counter = Counter()
    unmapped = 0
    raw_colors: List[List[int]] = []

    for rgb in pixels:
        m = match_legend(rgb, stack_raw)
        if not m:
            unmapped += 1
            continue
        key = m["rawAction"] or "UNMAPPED"
        action_counts[key] += 1
        if m.get("unknownColor"):
            raw_colors.append(list(rgb))

    mapped_total = sum(action_counts.values())
    if mapped_total == 0:
        return {
            "strategies": [
                {
                    "rawAction": "UNSELECTED",
                    "frequency": 100.0,
                    "frequencyType": "VISUAL_APPROX",
                    "gradingAllowed": False,
                    "dataStatus": "NEEDS_CLARIFICATION",
                }
            ],
            "actionRaw": "UNSELECTED",
            "dataStatus": "NEEDS_CLARIFICATION",
            "gradingAllowed": False,
            "parsingStatus": "UNMAPPED_CELL",
            "isMixed": False,
        }

    strategies: List[Dict[str, Any]] = []
    for action, cnt in action_counts.most_common():
        share = cnt / mapped_total
        if share < MIXED_THRESHOLD and len(action_counts) > 1:
            continue
        if action == "AI":
            status, gradable = "EXACT_TRAINER_DATA", True
        elif action == "RAISE":
            status, gradable = "EXACT_TRAINER_DATA", True
        elif action in ("nAI", "UNSELECTED", "LOW_PLAYABILITY") or action.startswith("COLOR_") or action.startswith("ORANGE_") or action.startswith("YELLOW_"):
            status, gradable = "NEEDS_CLARIFICATION", False
        else:
            status, gradable = "NEEDS_CLARIFICATION", False

        freq_pct = round(100.0 * share, 1)
        freq_type = "EXACT" if len(action_counts) == 1 and share >= DOMINANT_THRESHOLD else "VISUAL_APPROX"
        strategies.append(
            {
                "rawAction": action,
                "frequency": freq_pct,
                "frequencyType": freq_type,
                "gradingAllowed": gradable,
                "dataStatus": status,
            }
        )

    if not strategies and action_counts:
        action, cnt = action_counts.most_common(1)[0]
        share = cnt / mapped_total
        if action == "AI":
            status, gradable = "EXACT_TRAINER_DATA", True
        elif action == "RAISE":
            status, gradable = "EXACT_TRAINER_DATA", True
        else:
            status, gradable = "NEEDS_CLARIFICATION", False
        strategies.append(
            {
                "rawAction": action,
                "frequency": round(100.0 * share, 1),
                "frequencyType": "VISUAL_APPROX",
                "gradingAllowed": gradable,
                "dataStatus": status,
            }
        )

    # Normalize frequencies to ~100 when multiple strategies
    if len(strategies) > 1:
        total_freq = sum(s["frequency"] for s in strategies)
        if total_freq > 0:
            for s in strategies:
                s["frequency"] = round(100.0 * s["frequency"] / total_freq, 1)

    primary = strategies[0]
    is_mixed = len(strategies) > 1
    parsing_status = "MIXED" if is_mixed else "PARSED"
    if primary["rawAction"].startswith("COLOR_") or primary["rawAction"].startswith("ORANGE_") or primary["rawAction"].startswith("YELLOW_"):
        parsing_status = "NEEDS_CLARIFICATION"

    out: Dict[str, Any] = {
        "strategies": strategies,
        "actionRaw": primary["rawAction"],
        "dataStatus": primary["dataStatus"],
        "gradingAllowed": primary["gradingAllowed"] and not is_mixed,
        "parsingStatus": parsing_status,
        "isMixed": is_mixed,
    }
    if raw_colors:
        out["rawColors"] = raw_colors[:3]
    if unmapped > len(pixels) * 0.5:
        out["parsingStatus"] = "LOW_CONFIDENCE"
        out["gradingAllowed"] = False
    return out


def validate_chart(chart_id: str, hands: Dict[str, Any]) -> List[str]:
    errors = []
    if len(hands) != 169:
        errors.append(f"hand_count:{len(hands)}!=169")
    hands_set = set(hands.keys())
    expected = set(HAND_ORDER)
    missing = expected - hands_set
    extra = hands_set - expected
    if missing:
        errors.append(f"missing_hands:{len(missing)}")
    if extra:
        errors.append(f"extra_hands:{len(extra)}")
  # duplicate check implicit in dict keys
    for hand, rec in hands.items():
        strats = rec.get("strategies") or []
        total = sum(s.get("frequency", 0) for s in strats)
        if strats and total > 105:
            errors.append(f"freq_overflow:{hand}:{total}")
        if rec.get("gradingAllowed") and rec.get("actionRaw") in ("UNSELECTED", "nAI", "LOW_PLAYABILITY", None):
            errors.append(f"invalid_grading:{hand}")
        if not rec.get("actionRaw") and rec.get("parsingStatus") != "UNMAPPED_CELL":
            errors.append(f"null_action:{hand}")
    return errors


def parse_chart_image(path: Path, stack_raw: Optional[str]) -> Dict[str, Any]:
    im = Image.open(path).convert("RGB")
    hands: Dict[str, Any] = {}
    mixed_count = 0
    gradable_count = 0
    clarify_count = 0
    unselected_count = 0

    for idx, hand in enumerate(HAND_ORDER):
        r, c = idx // 13, idx % 13
        pixels = sample_cell_pixels(im, r, c)
        cell = aggregate_cell_strategies(pixels, stack_raw)
        cell["hand"] = hand
        hands[hand] = cell
        if cell.get("isMixed"):
            mixed_count += 1
        if cell.get("gradingAllowed"):
            gradable_count += 1
        if cell.get("dataStatus") == "NEEDS_CLARIFICATION":
            clarify_count += 1
        if cell.get("actionRaw") == "UNSELECTED":
            unselected_count += 1

    return {
        "hands": hands,
        "parseStats": {
            "handCells": 169,
            "mixedCells": mixed_count,
            "gradingAllowedCells": gradable_count,
            "needsClarificationCells": clarify_count,
            "unselectedCells": unselected_count,
            "exactTrainerCells": sum(
                1 for h in hands.values() if h.get("dataStatus") == "EXACT_TRAINER_DATA" and not h.get("isMixed")
            ),
        },
    }


def chart_parse_status(errors: List[str], hands: Dict[str, Any]) -> str:
    if any("hand_count" in e or "missing_hands" in e for e in errors):
        return "FAILED"
    low_conf = sum(1 for h in hands.values() if h.get("parsingStatus") == "LOW_CONFIDENCE")
    if low_conf > 50:
        return "PARTIAL"
    if errors:
        return "PARTIAL"
    return "SUCCESS"


def build_flat_records(
    chart_id: str,
    manifest_row: dict,
    hands: Dict[str, Any],
) -> List[Dict[str, Any]]:
    records = []
    for hand, cell in hands.items():
        records.append(
            {
                "chartId": chart_id,
                "hand": hand,
                "actionRaw": cell.get("actionRaw"),
                "strategies": cell.get("strategies"),
                "dataStatus": cell.get("dataStatus"),
                "gradingAllowed": bool(cell.get("gradingAllowed")),
                "parsingStatus": cell.get("parsingStatus"),
                "isMixed": bool(cell.get("isMixed")),
                "sourceMode": manifest_row.get("source_mode"),
                "spot": manifest_row.get("spot"),
                "stack": manifest_row.get("stack"),
                "heroPosition": manifest_row.get("position"),
                "opponentPosition": manifest_row.get("opponent"),
                "sizing": manifest_row.get("bet"),
                "sourceHash": manifest_row.get("source_hash"),
                "sourceFilename": manifest_row.get("source_file"),
                "compressedSha256": manifest_row.get("compressed_sha256"),
            }
        )
    return records


def main() -> None:
    ensure_extracted()
    rows = list(csv.DictReader(open(MANIFEST, encoding="utf-8")))
    parsed_charts: Dict[str, Any] = {}
    flat_records: List[Dict[str, Any]] = []

    global_stats: Counter = Counter()
    by_mode: Dict[str, Counter] = defaultdict(Counter)
    validation_errors: Dict[str, List[str]] = {}

    for row in rows:
        chart_id = row["chart_id"]
        chart_num = row["compressed_file"].split("/")[-1].replace(".webp", "")
        img_path = EXTRACT_DIR / f"{chart_num}.webp"
        stack_raw = row.get("stack")
        stack_semantics = parse_trainer_stack(stack_raw)

        if not img_path.exists():
            global_stats["charts_failed"] += 1
            global_stats["charts_missing_image"] += 1
            parsed_charts[chart_id] = {
                "chartId": chart_id,
                "parseStatus": "FAILED",
                "error": "missing_image",
                "hands": {},
                "sourceHash": row.get("source_hash"),
                "sourceFilename": row.get("source_file"),
            }
            continue

        try:
            result = parse_chart_image(img_path, stack_raw)
            hands = result["hands"]
            errors = validate_chart(chart_id, hands)
            status = chart_parse_status(errors, hands)
            if errors:
                validation_errors[chart_id] = errors

            parsed_charts[chart_id] = {
                "chartId": chart_id,
                "parseStatus": status,
                "hands": hands,
                "parseStats": result["parseStats"],
                "validationErrors": errors,
                "sourceHash": row.get("source_hash"),
                "sourceFilename": row.get("source_file"),
                "compressedSha256": row.get("compressed_sha256"),
                "sourceMode": row.get("source_mode"),
                "stackSemantics": stack_semantics,
            }

            flat_records.extend(build_flat_records(chart_id, row, hands))

            mode = row.get("source_mode") or "unknown"
            by_mode[mode]["charts_total"] += 1
            if status == "SUCCESS":
                global_stats["charts_success"] += 1
                by_mode[mode]["charts_parsed"] += 1
            elif status == "PARTIAL":
                global_stats["charts_partial"] += 1
                by_mode[mode]["charts_partial"] += 1
            else:
                global_stats["charts_failed"] += 1

            ps = result["parseStats"]
            global_stats["hand_cells"] += ps["handCells"]
            global_stats["mixed_cells"] += ps["mixedCells"]
            global_stats["grading_allowed_cells"] += ps["gradingAllowedCells"]
            global_stats["needs_clarification_cells"] += ps["needsClarificationCells"]
            global_stats["unselected_cells"] += ps["unselectedCells"]
            global_stats["exact_trainer_cells"] += ps["exactTrainerCells"]
            by_mode[mode]["hand_records"] += ps["handCells"]
            by_mode[mode]["grading_enabled"] += ps["gradingAllowedCells"]
            by_mode[mode]["clarification"] += ps["needsClarificationCells"]

        except Exception as e:
            global_stats["charts_failed"] += 1
            parsed_charts[chart_id] = {
                "chartId": chart_id,
                "parseStatus": "FAILED",
                "error": str(e),
                "hands": {},
                "sourceHash": row.get("source_hash"),
                "sourceFilename": row.get("source_file"),
            }

    legend_export = {
        "entries": [
            {"id": e["id"], "rawAction": e.get("rawAction"), "gradingAllowed": e.get("gradingAllowed")}
            for e in LEGEND_ENTRIES
        ],
        "unknownFamilies": [f["bucket"] for f in UNKNOWN_COLOR_FAMILIES],
        "policy": {
            "grayNotFold": True,
            "mixedCellsPreserved": True,
            "noGreenlineFill": True,
        },
    }

    report = {
        "batch2ChartsTotal": len(rows),
        "chartsSuccessfullyParsed": global_stats["charts_success"],
        "chartsPartiallyParsed": global_stats["charts_partial"],
        "chartsFailed": global_stats["charts_failed"],
        "chartsMissingImage": global_stats["charts_missing_image"],
        "handCellsTotal": global_stats["hand_cells"],
        "handCellsParsed": global_stats["hand_cells"],
        "mixedCells": global_stats["mixed_cells"],
        "gradingAllowedCells": global_stats["grading_allowed_cells"],
        "needsClarificationCells": global_stats["needs_clarification_cells"],
        "unselectedCells": global_stats["unselected_cells"],
        "exactTrainerCells": global_stats["exact_trainer_cells"],
        "unknownActionLabels": sum(
            1
            for c in parsed_charts.values()
            for h in (c.get("hands") or {}).values()
            if str(h.get("actionRaw", "")).startswith(("COLOR_", "ORANGE_", "YELLOW_"))
        ),
        "validationErrorCharts": len(validation_errors),
        "byScenario": {k: dict(v) for k, v in sorted(by_mode.items())},
        "sourceTraceability": "manifest+compressed_sha256+source_hash",
        "duplicates": 0,
    }

    OUTPUT_PARSED.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PARSED, "w", encoding="utf-8") as f:
        json.dump(
            {
                "legend": legend_export,
                "charts": parsed_charts,
                "stats": dict(global_stats),
                "report": report,
            },
            f,
        )

    with open(OUTPUT_FLAT, "w", encoding="utf-8") as f:
        json.dump(flat_records, f)

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # Compact gradable-only index for fast lookup (~2-5MB vs 178MB flat dump)
    gradable_index = []
    for rec in flat_records:
        if rec.get("gradingAllowed"):
            gradable_index.append(
                [rec["chartId"], rec["hand"], rec["actionRaw"], rec.get("sourceMode")]
            )
    gradable_path = ROOT / "data/trainer/built/batch2-gradable-index.json"
    with open(gradable_path, "w", encoding="utf-8") as f:
        json.dump({"records": gradable_index, "count": len(gradable_index)}, f)

    parsed_size = OUTPUT_PARSED.stat().st_size
    flat_size = OUTPUT_FLAT.stat().st_size if OUTPUT_FLAT.exists() else 0
    gradable_size = gradable_path.stat().st_size
    report["datasetSizeBytes"] = {"parsed": parsed_size, "flat": flat_size, "gradableIndex": gradable_size}
    report["datasetSizeMB"] = {
        "parsed": round(parsed_size / 1_048_576, 2),
        "flat": round(flat_size / 1_048_576, 2),
        "gradableIndex": round(gradable_size / 1_048_576, 2),
    }

    print(
        json.dumps(
            {
                "output": str(OUTPUT_PARSED),
                "flat": str(OUTPUT_FLAT),
                "report": str(OUTPUT_REPORT),
                "reportSummary": report,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
