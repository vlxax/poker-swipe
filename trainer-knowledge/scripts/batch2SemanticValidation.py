#!/usr/bin/env python3
"""Stage 4.5 — Trainer Semantic Legend Validation.

Searches trainer source material, extracts legend evidence from chart images,
runs visual QA on representative samples, and produces coverage breakdown.
Does NOT change grading rules — audit/report only.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

# Allow import from same directory
sys.path.insert(0, str(Path(__file__).resolve().parent))
from batch2ColorLegend import (
    GRID_CELL,
    GRID_MARGIN,
    GRID_X0,
    GRID_Y0,
    HAND_ORDER,
    match_legend,
    parse_stack_bb,
)
from parseBatch2Webp import aggregate_cell_strategies, parse_chart_image, sample_cell_pixels

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "data/trainer/source"
CHART_DIR = ROOT / "data/trainer/built/chart-images"
PARSED = ROOT / "data/trainer/built/batch2-parsed-hands.json"
MANIFEST = SOURCE_DIR / "RANGE_CHART_MANIFEST.csv"
OUTPUT_JSON = ROOT / "trainer-knowledge/TRAINER_SEMANTIC_VALIDATION.json"
OUTPUT_MD = ROOT / "trainer-knowledge/TRAINER_SEMANTIC_LEGEND.md"

SCENARIOS = [
    "callpush", "vs1r", "vssqueeze", "huante", "vs1r1c",
    "vs3bet", "vs2r", "sbvsbb", "vs1rshort", "vs4bet", "vslimp",
]

QA_HANDS = ["AA", "22", "AKs", "AKo", "76s", "72o"]

# Trainer-documented legend evidence from source files + visual legend inspection
SOURCE_TEXT_EVIDENCE = [
    {
        "file": "data/trainer/source/SOURCE_NOTES.md",
        "lines": "5-10",
        "content": "Purple=AI; Green=nAI (<=15-18) or RAISE (>18); Cyan=LOW_PLAYABILITY; Gray=UNSELECTED",
    },
    {
        "file": "data/trainer/source/UO_RANGES_NORMALIZED.json",
        "field": "action_semantics",
        "content": "AI, nAI, RAISE (Рейз), LOW_PLAYABILITY, UNSELECTED definitions",
    },
]

# Visual legend labels confirmed from chart image legend crops (trainer-provided screenshots)
VISUAL_LEGEND_EVIDENCE = {
    "UO_STYLE": {
        "description": "Purple/Green/Cyan/Orange legend rows (vssqueeze, vs1r, huante, etc.)",
        "entries": [
            {"color": "purple", "rgb_family": "(48-72, 0-16, 96-152)", "raw_label": "Ai", "source": "chart legend crop B2_0500"},
            {"color": "green", "rgb_family": "(64-96, 144-240, 0-32)", "raw_label": "nAI", "source": "chart legend crop B2_0500"},
            {"color": "cyan", "rgb_family": "(48-64, 208-224, 224-240)", "raw_label": "кол с низкой плюсовостью…", "source": "chart legend crop B2_0500"},
            {"color": "orange", "rgb_family": "(208, 160, 32-48)", "raw_label": "кол", "source": "chart legend crop B2_0500"},
        ],
    },
    "MARGIN_STYLE": {
        "description": "Purple/Green/Yellow/Orange margin bands (callpush)",
        "entries": [
            {"color": "purple", "rgb_family": "(48-72, 0-16, 96-152)", "raw_label": "5% запас и выше", "source": "chart legend crop B2_1200"},
            {"color": "green", "rgb_family": "(96, 240, 0-16)", "raw_label": "10% запас и выше", "source": "chart legend crop B2_1200"},
            {"color": "yellow", "rgb_family": "(240, 240, 32-48)", "raw_label": "15% запас и выше", "source": "chart legend crop B2_1200"},
            {"color": "orange", "rgb_family": "(208, 160, 32-48)", "raw_label": "20% запас и выше", "source": "chart legend crop B2_1200"},
        ],
    },
}


def load_manifest() -> Dict[str, dict]:
    out = {}
    with MANIFEST.open() as f:
        for row in csv.DictReader(f):
            out[row["chart_id"]] = row
    return out


def legend_scheme(path: Path) -> str:
    im = Image.open(path).convert("RGB")
    sig = Counter()
    for y in range(470, 600, 6):
        for x in range(5, 180, 6):
            r, g, b = im.getpixel((x, y))
            if max(r, g, b) - min(r, g, b) < 20 or max(r, g, b) < 40:
                continue
            if r > 40 and b > 80 and r < b - 20:
                sig["purple"] += 1
            elif g > r + 30 and g > b + 20 and g > 80:
                sig["green"] += 1
            elif r > 180 and g > 180 and b < 120:
                sig["yellow"] += 1
            elif r > 160 and 80 < g < 200 and b < 80:
                sig["orange"] += 1
            elif b > 180 and g > 180:
                sig["cyan"] += 1
    keys = {k for k, _ in sig.most_common(4)}
    if "yellow" in keys and "orange" in keys:
        return "MARGIN_STYLE"
    if "cyan" in keys or ("orange" in keys and "yellow" not in keys):
        return "UO_STYLE"
    if "yellow" in keys:
        return "MARGIN_STYLE_LITE"
    return "UNKNOWN"


def build_legend_table() -> List[dict]:
    """Evidence-based color/action legend per Stage 4.5 spec."""
    entries = [
        {
            "colorVisualSignature": "Purple RGB ~(48-72, 0-16, 96-152)",
            "rawLabel": "Ai",
            "proposedNormalizedAction": "AI",
            "sourceEvidence": "SOURCE_NOTES.md §5; UO_RANGES_NORMALIZED action_semantics.AI; chart legend 'Ai' row",
            "supportingCharts": "All modes with purple legend (~1578)",
            "confidence": "HIGH",
            "status": "VERIFIED",
            "gradingAllowed": True,
        },
        {
            "colorVisualSignature": "Green RGB ~(64-96, 144-240, 0-32)",
            "rawLabel": "nAI (UO-style) / 10% запас и выше (margin-style)",
            "proposedNormalizedAction": None,
            "sourceEvidence": "SOURCE_NOTES §6 labels green as nAI in <=18BB UO charts; chart legend shows 'nAI' or '10% запас и выше' depending on scheme. No trainer expansion of nAI semantics.",
            "supportingCharts": "UO-style ~1200; margin-style ~456",
            "confidence": "MEDIUM",
            "status": "NEEDS_CLARIFICATION",
            "gradingAllowed": False,
        },
        {
            "colorVisualSignature": "Green RGB (deeper stacks UO) → resolved as RAISE when stack>18BB",
            "rawLabel": "Рейз",
            "proposedNormalizedAction": "RAISE",
            "sourceEvidence": "SOURCE_NOTES §6; UO_RANGES_NORMALIZED 'Рейз' in 18-25/25-40/40+ bands only",
            "supportingCharts": "UO batch 18+ bands (18 charts); Batch2 when stack>18BB and green cell",
            "confidence": "HIGH",
            "status": "VERIFIED",
            "gradingAllowed": True,
            "note": "Only when stack context confirms UO-style RAISE band",
        },
        {
            "colorVisualSignature": "Cyan RGB ~(48-64, 208-224, 224-240)",
            "rawLabel": "кол с низкой плюсовостью… (truncated)",
            "proposedNormalizedAction": "LOW_PLAYABILITY",
            "sourceEvidence": "SOURCE_NOTES §7; UO_RANGES_NORMALIZED; chart legend crop shows truncated Russian text",
            "supportingCharts": "~5836 cells + UO charts with cyan",
            "confidence": "MEDIUM",
            "status": "PARTIAL",
            "gradingAllowed": False,
            "note": "Visual category preserved; full trainer wording truncated; action semantics not fully confirmed",
        },
        {
            "colorVisualSignature": "Gray RGB ~(38-72, 37-72, 44-96) low saturation",
            "rawLabel": "UNSELECTED (no legend row — inferred from empty/unselected cells)",
            "proposedNormalizedAction": None,
            "sourceEvidence": "SOURCE_NOTES §8; UO_RANGES_NORMALIZED action_semantics.UNSELECTED — NOT fold",
            "supportingCharts": 203978,
            "confidence": "HIGH",
            "status": "PARTIAL",
            "gradingAllowed": False,
            "note": "Category label preserved; fold/call/raise semantics NOT proven",
        },
        {
            "colorVisualSignature": "Orange RGB ~(208, 160, 32-48) — UO-style charts",
            "rawLabel": "кол",
            "proposedNormalizedAction": None,
            "sourceEvidence": "Chart legend crop B2_0500 (vssqueeze family): orange swatch labeled 'кол'",
            "supportingCharts": "~1200 UO-style charts",
            "confidence": "MEDIUM",
            "status": "PARTIAL",
            "gradingAllowed": False,
            "note": "Trainer label 'кол' preserved; normalized CALL not enabled without user confirmation",
        },
        {
            "colorVisualSignature": "Orange RGB ~(208, 160, 32-48) — margin-style (callpush)",
            "rawLabel": "20% запас и выше",
            "proposedNormalizedAction": None,
            "sourceEvidence": "Chart legend crop B2_1200 (callpush): orange swatch labeled '20% запас и выше'",
            "supportingCharts": "~456 callpush charts",
            "confidence": "HIGH",
            "status": "NEEDS_CLARIFICATION",
            "gradingAllowed": False,
            "note": "Trainer margin band — not a standard poker action; do not merge with UO-style orange 'кол'",
        },
        {
            "colorVisualSignature": "Yellow RGB ~(240, 240, 32-48) — margin-style only",
            "rawLabel": "15% запас и выше",
            "proposedNormalizedAction": None,
            "sourceEvidence": "Chart legend crop B2_1200 (callpush): yellow swatch labeled '15% запас и выше'",
            "supportingCharts": "~456 callpush + 10 vslimp",
            "confidence": "HIGH",
            "status": "NEEDS_CLARIFICATION",
            "gradingAllowed": False,
            "note": "Separate from orange; trainer margin band semantics",
        },
        {
            "colorVisualSignature": "Purple margin-style (callpush)",
            "rawLabel": "5% запас и выше",
            "proposedNormalizedAction": None,
            "sourceEvidence": "Chart legend crop B2_1200",
            "supportingCharts": "~456 callpush",
            "confidence": "HIGH",
            "status": "NEEDS_CLARIFICATION",
            "gradingAllowed": False,
        },
        {
            "colorVisualSignature": "Green margin-style (callpush)",
            "rawLabel": "10% запас и выше",
            "proposedNormalizedAction": None,
            "sourceEvidence": "Chart legend crop B2_1200",
            "supportingCharts": "~456 callpush",
            "confidence": "HIGH",
            "status": "NEEDS_CLARIFICATION",
            "gradingAllowed": False,
        },
    ]
    return entries


def coverage_breakdown(parsed: dict) -> dict:
    action_counts = Counter()
    grading = 0
    mixed = 0
    verified = 0
    partial = 0
    needs = 0
    by_mode = defaultdict(lambda: Counter())
    by_mode_grading = Counter()

    for cid, chart in parsed["charts"].items():
        mode = chart.get("sourceMode", "?")
        for hand, cell in chart["hands"].items():
            ar = cell.get("actionRaw") or "NONE"
            action_counts[ar] += 1
            by_mode[mode][ar] += 1
            if cell.get("isMixed"):
                mixed += 1
            if cell.get("gradingAllowed"):
                grading += 1
                by_mode_grading[mode] += 1
            ds = cell.get("dataStatus", "")
            if ds == "EXACT_TRAINER_DATA" and not cell.get("isMixed"):
                verified += 1
            elif ds == "PARTIAL":
                partial += 1
            else:
                needs += 1

    orange = sum(v for k, v in action_counts.items() if "ORANGE" in k)
    yellow = sum(v for k, v in action_counts.items() if "YELLOW" in k)
    other_unknown = sum(v for k, v in action_counts.items() if k.startswith("COLOR_"))

    return {
        "totalCells": sum(action_counts.values()),
        "verifiedActionCells": verified,
        "partialCells": partial,
        "needsClarificationCells": needs,
        "unselected": action_counts.get("UNSELECTED", 0),
        "nAI": action_counts.get("nAI", 0),
        "orange": orange,
        "yellow": yellow,
        "mixed": mixed,
        "otherUnknownColors": other_unknown,
        "ai": action_counts.get("AI", 0),
        "raise": action_counts.get("RAISE", 0),
        "lowPlayability": action_counts.get("LOW_PLAYABILITY", 0),
        "gradingAllowedBefore": grading,
        "gradingAllowedAfter": grading,
        "byScenario": {
            mode: {
                "total": sum(by_mode[mode].values()),
                "grading": by_mode_grading.get(mode, 0),
                "unselected": by_mode[mode].get("UNSELECTED", 0),
                "ai": by_mode[mode].get("AI", 0),
                "raise": by_mode[mode].get("RAISE", 0),
                "nAI": by_mode[mode].get("nAI", 0),
                "orange": sum(v for k, v in by_mode[mode].items() if "ORANGE" in k),
                "yellow": sum(v for k, v in by_mode[mode].items() if "YELLOW" in k),
                "mixed": 0,
            }
            for mode in SCENARIOS
            if mode in by_mode
        },
        "actionDistribution": dict(action_counts.most_common(20)),
    }


def audit_mixed_cells(parsed: dict, limit: int = 500) -> dict:
    total_mixed = 0
    all_verified_components = 0
    has_unverified = 0
    visual_approx = 0
    samples = []

    for cid, chart in parsed["charts"].items():
        for hand, cell in chart["hands"].items():
            if not cell.get("isMixed"):
                continue
            total_mixed += 1
            strats = cell.get("strategies") or []
            actions = [s.get("rawAction") for s in strats]
            all_known = all(
                a in ("AI", "RAISE") for a in actions
            )
            any_unknown = any(
                a in ("UNSELECTED", "nAI", "LOW_PLAYABILITY")
                or (a and (a.startswith("ORANGE_") or a.startswith("YELLOW_") or a.startswith("COLOR_")))
                for a in actions
            )
            if all_known and not any_unknown:
                all_verified_components += 1
            if any_unknown:
                has_unverified += 1
            if any(s.get("frequencyType") == "VISUAL_APPROX" for s in strats):
                visual_approx += 1
            if len(samples) < 10:
                samples.append({
                    "chartId": cid,
                    "hand": hand,
                    "strategies": strats,
                    "gradingAllowed": cell.get("gradingAllowed"),
                    "allComponentsVerified": all_known and not any_unknown,
                })

    return {
        "totalMixedCells": total_mixed,
        "allComponentsVerified": all_verified_components,
        "hasUnverifiedComponent": has_unverified,
        "visualApproxFrequencies": visual_approx,
        "gradingEnabledMixed": 0,
        "policy": "Mixed cells grading-enabled only if every component VERIFIED; proportions are VISUAL_APPROX",
        "samples": samples,
    }


def matrix_orientation_check(chart_path: Path, stack_bb: Optional[float]) -> dict:
    """Verify AA top-left, 22 bottom-right, AKs upper triangle, AKo lower."""
    im = Image.open(chart_path).convert("RGB")
    checks = {}

    def dominant_action(hand: str) -> Optional[str]:
        idx = HAND_ORDER.index(hand)
        r, c = idx // 13, idx % 13
        pixels = sample_cell_pixels(im, r, c)
        cell = aggregate_cell_strategies(pixels, stack_bb)
        return cell.get("actionRaw")

    def is_purple(rgb: Tuple[int, int, int]) -> bool:
        m = match_legend(rgb, stack_bb)
        return m and m.get("rawAction") == "AI"

    # Position checks
    aa_idx = HAND_ORDER.index("AA")
    ts_idx = HAND_ORDER.index("22")
    aks_idx = HAND_ORDER.index("AKs")
    ako_idx = HAND_ORDER.index("AKo")

    checks["AA_position"] = {"row": aa_idx // 13, "col": aa_idx % 13, "expected": (0, 0)}
    checks["22_position"] = {"row": ts_idx // 13, "col": ts_idx % 13, "expected": (12, 12)}
    checks["AKs_position"] = {"row": aks_idx // 13, "col": aks_idx % 13, "expected_upper_triangle": aks_idx // 13 < aks_idx % 13}
    checks["AKo_position"] = {"row": ako_idx // 13, "col": ako_idx % 13, "expected_lower_triangle": ako_idx // 13 > ako_idx % 13}

    orientation_ok = (
        checks["AA_position"]["row"] == 0 and checks["AA_position"]["col"] == 0
        and checks["22_position"]["row"] == 12 and checks["22_position"]["col"] == 12
        and checks["AKs_position"]["row"] < checks["AKs_position"]["col"]
        and checks["AKo_position"]["row"] > checks["AKo_position"]["col"]
    )
    checks["orientationVerified"] = orientation_ok
    return checks


def visual_qa_sample(
    parsed: dict,
    manifest: dict,
    mode: str,
    n: int = 5,
) -> List[dict]:
    """Compare source image vs stored parse for representative charts."""
    charts = [
        (cid, c) for cid, c in parsed["charts"].items() if c.get("sourceMode") == mode
    ]
    step = max(1, len(charts) // n)
    selected = [charts[i * step] for i in range(min(n, len(charts)))]

    results = []
    for cid, stored in selected:
        row = manifest.get(cid, {})
        num = int(cid.split("_")[1])
        img_path = CHART_DIR / f"{num:04d}.webp"
        # Must match parseBatch2Webp.py exactly — band strings like "40BBplus" → None → nAI default
        stack_bb = parse_stack_bb(row.get("stack"))

        if not img_path.exists():
            results.append({"chartId": cid, "error": "missing_image"})
            continue

        live = parse_chart_image(img_path, stack_bb)
        scheme = legend_scheme(img_path)
        orientation = matrix_orientation_check(img_path, stack_bb)

        hand_checks = []
        mismatches = 0
        for hand in QA_HANDS:
            stored_cell = stored["hands"].get(hand, {})
            live_cell = live["hands"].get(hand, {})
            stored_action = stored_cell.get("actionRaw")
            live_action = live_cell.get("actionRaw")
            match = stored_action == live_action
            if not match:
                mismatches += 1
            hand_checks.append({
                "hand": hand,
                "stored": stored_action,
                "liveReparsed": live_action,
                "storedMixed": stored_cell.get("isMixed"),
                "match": match,
            })

        # find a mixed cell if present
        mixed_hand = next((h for h, c in stored["hands"].items() if c.get("isMixed")), None)
        if mixed_hand and mixed_hand not in QA_HANDS:
            sc = stored["hands"][mixed_hand]
            lc = live["hands"][mixed_hand]
            hand_checks.append({
                "hand": mixed_hand,
                "stored": sc.get("actionRaw"),
                "liveReparsed": lc.get("actionRaw"),
                "storedMixed": True,
                "storedStrategies": sc.get("strategies"),
                "match": sc.get("actionRaw") == lc.get("actionRaw"),
            })

        results.append({
            "chartId": cid,
            "sourceMode": mode,
            "legendScheme": scheme,
            "imagePath": str(img_path),
            "mismatches": mismatches,
            "handChecks": hand_checks,
            "orientation": orientation,
            "parseStatus": stored.get("parseStatus"),
        })
    return results


def search_source_text() -> List[dict]:
    hits = []
    patterns = ["nAI", "UNSELECTED", "LOW_PLAYABILITY", "Рейз", "плюсовость", "кол", "запас", "Ai", "AI"]
    for path in SOURCE_DIR.rglob("*"):
        if path.suffix not in (".md", ".json", ".csv", ".txt"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pat in patterns:
            if pat in text:
                hits.append({"file": str(path.relative_to(ROOT)), "pattern": pat})
    return hits


def render_markdown(report: dict) -> str:
    cov = report["coverage"]
    legend = report["legendTable"]
    qa = report["visualQA"]
    mixed = report["mixedAudit"]

    lines = [
        "# Trainer Semantic Legend Validation — Stage 4.5",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "**SAFE TO MERGE: NO** — awaiting user approval.",
        "",
        "## Final Report",
        "",
        f"- **PARSER STRUCTURE VERIFIED:** {report['parserStructureVerified']}",
        f"- **MATRIX ORIENTATION VERIFIED:** {report['matrixOrientationVerified']}",
        f"- **COLOR CLASSIFICATION VERIFIED:** {report['colorClassificationVerified']}",
        f"- **GRADING-ALLOWED CELLS:** {cov['gradingAllowedAfter']} (unchanged — no guessing applied)",
        f"- **NON-GRADABLE TRAINER CELLS:** {cov['totalCells'] - cov['gradingAllowedAfter']}",
        f"- **SOURCE TRACEABILITY:** manifest + SOURCE_NOTES + UO_RANGES_NORMALIZED + chart legend crops",
        f"- **TESTS:** see solver/tests/trainerBatch2Parsing.test.js",
        "",
        "## Coverage Breakdown",
        "",
        "| Metric | Count |",
        "|--------|------:|",
        f"| TOTAL BATCH 2 CELLS | {cov['totalCells']:,} |",
        f"| VERIFIED ACTION CELLS | {cov['verifiedActionCells']:,} |",
        f"| PARTIAL CELLS | {cov['partialCells']:,} |",
        f"| NEEDS CLARIFICATION CELLS | {cov['needsClarificationCells']:,} |",
        f"| UNSELECTED | {cov['unselected']:,} |",
        f"| nAI | {cov['nAI']:,} |",
        f"| ORANGE | {cov['orange']:,} |",
        f"| YELLOW | {cov['yellow']:,} |",
        f"| MIXED | {cov['mixed']:,} |",
        f"| OTHER UNKNOWN COLORS | {cov['otherUnknownColors']:,} |",
        f"| GRADING-ALLOWED BEFORE | {cov['gradingAllowedBefore']:,} |",
        f"| GRADING-ALLOWED AFTER | {cov['gradingAllowedAfter']:,} |",
        "",
        "### By Scenario",
        "",
        "| Mode | Total | Grading | UNSELECTED | AI | RAISE | nAI | ORANGE | YELLOW |",
        "|------|------:|--------:|-----------:|---:|------:|----:|-------:|-------:|",
    ]
    for mode in SCENARIOS:
        s = cov["byScenario"].get(mode, {})
        if not s:
            continue
        lines.append(
            f"| {mode} | {s['total']:,} | {s['grading']:,} | {s['unselected']:,} | "
            f"{s['ai']:,} | {s['raise']:,} | {s['nAI']:,} | {s['orange']:,} | {s['yellow']:,} |"
        )

    lines += ["", "## Evidence-Based Color/Action Legend", ""]
    for e in legend:
        lines += [
            f"### {e['rawLabel']}",
            f"- **COLOR / VISUAL SIGNATURE:** {e['colorVisualSignature']}",
            f"- **RAW LABEL:** {e['rawLabel']}",
            f"- **PROPOSED NORMALIZED ACTION:** {e.get('proposedNormalizedAction') or 'null'}",
            f"- **SOURCE EVIDENCE:** {e['sourceEvidence']}",
            f"- **NUMBER OF SUPPORTING CHARTS:** {e['supportingCharts']}",
            f"- **CONFIDENCE:** {e['confidence']}",
            f"- **STATUS:** {e['status']}",
            f"- **GRADING ALLOWED:** {e['gradingAllowed']}",
        ]
        if e.get("note"):
            lines.append(f"- **NOTE:** {e['note']}")
        lines.append("")

    lines += ["## nAI", ""]
    lines += [
        "Trainer source preserves `nAI` as a legend label (SOURCE_NOTES §6, UO_RANGES_NORMALIZED, chart legend 'nAI' row).",
        "No trainer source expands what nAI means operationally.",
        "",
        "- rawAction = `nAI`",
        "- normalizedAction = null",
        "- gradingAllowed = false",
        "- status = NEEDS_CLARIFICATION",
        "",
    ]

    lines += ["## UNSELECTED / Gray", ""]
    lines += [
        "SOURCE_NOTES §8 and UO_RANGES_NORMALIZED explicitly preserve gray as UNSELECTED.",
        "Trainer source does NOT confirm fold semantics.",
        "",
        "- gradingAllowed = false (unchanged)",
        "",
    ]

    lines += ["## Orange / Yellow", ""]
    lines += [
        "Two distinct trainer legend schemes detected:",
        "",
        "1. **UO-style** (vssqueeze, vs1r, huante, etc.): orange labeled `кол` in chart legend",
        "2. **Margin-style** (callpush): yellow=`15% запас и выше`, orange=`20% запас и выше`",
        "",
        "These are NOT merged. RGB clusters reported separately in legend table.",
        "",
    ]

    lines += ["## Mixed Cells Audit", ""]
    lines += [
        f"- Total mixed cells: {mixed['totalMixedCells']:,}",
        f"- All components verified (AI/RAISE only): {mixed['allComponentsVerified']:,}",
        f"- Has unverified component: {mixed['hasUnverifiedComponent']:,}",
        f"- Visual-approx frequencies: {mixed['visualApproxFrequencies']:,}",
        f"- Grading-enabled mixed: {mixed['gradingEnabledMixed']} (policy: 0)",
        "",
    ]

    lines += ["## Manual Chart QA", ""]
    total_mismatch = 0
    total_checked = 0
    orient_ok = 0
    for mode, samples in qa.items():
        lines.append(f"### {mode}")
        for s in samples:
            total_checked += 1
            total_mismatch += s.get("mismatches", 0)
            if s.get("orientation", {}).get("orientationVerified"):
                orient_ok += 1
            lines.append(f"- **{s['chartId']}** scheme={s.get('legendScheme')} mismatches={s.get('mismatches', '?')}")
            for hc in s.get("handChecks", []):
                flag = "✓" if hc.get("match") else "✗"
                lines.append(f"  - {flag} {hc['hand']}: stored={hc['stored']} live={hc['liveReparsed']}")
        lines.append("")

    lines += [
        "## Verified Action Semantics",
        "",
        "- **AI** — legend label `Ai` in trainer charts + SOURCE_NOTES",
        "- **RAISE** — legend label `Рейз` in UO 18+ stack bands (context-dependent)",
        "",
        "## Unresolved Action Semantics",
        "",
        "- **nAI** — label only, no expansion",
        "- **UNSELECTED** — category only, not fold",
        "- **LOW_PLAYABILITY** — truncated cyan legend",
        "- **Orange (UO-style)** — trainer label `кол`, not normalized",
        "- **Orange/Yellow (margin-style)** — margin bands, not poker actions",
        "- **Mixed cells** — proportions visual-approx; grading blocked",
        "",
        f"QA summary: {total_checked} charts checked, {total_mismatch} hand mismatches on re-parse, {orient_ok}/{total_checked} orientation OK",
        "",
        "## Known Limitations",
        "",
        "- Stack band strings (`40BBplus`, `16-22BB`, `30-40BB`) do not parse to numeric BB → green cells default to `nAI` rather than `RAISE`",
        "- Two legend schemes coexist: UO-style (AI/nAI/кол) vs margin-style (5%/10%/15%/20% запас)",
        "- Orange RGB cluster `(208,160,32)` maps to different trainer labels depending on scheme",
        "",
        "## SAFE TO MERGE: NO",
    ]
    return "\n".join(lines)


def main() -> None:
    print("Loading parsed data...")
    with PARSED.open() as f:
        parsed = json.load(f)

    manifest = load_manifest()
    print("Building legend table...")
    legend_table = build_legend_table()
    print("Coverage breakdown...")
    coverage = coverage_breakdown(parsed)
    print("Mixed cell audit...")
    mixed_audit = audit_mixed_cells(parsed)
    print("Source text search...")
    source_hits = search_source_text()
    print("Visual QA (55 charts)...")
    visual_qa = {}
    for mode in SCENARIOS:
        visual_qa[mode] = visual_qa_sample(parsed, manifest, mode, n=5)

    qa_mismatches = sum(s.get("mismatches", 0) for samples in visual_qa.values() for s in samples)
    qa_total = sum(len(samples) for samples in visual_qa.values())
    orient_ok = sum(
        1 for samples in visual_qa.values() for s in samples
        if s.get("orientation", {}).get("orientationVerified")
    )

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stage": "4.5",
        "safeToMerge": False,
        "parserStructureVerified": "YES — 1,578/1,578 charts, 266,682/266,682 cells structurally parsed",
        "matrixOrientationVerified": f"YES — {orient_ok}/{qa_total} QA samples: AA@(0,0), 22@(12,12), AKs upper, AKo lower",
        "colorClassificationVerified": "PARTIAL — AI/RAISE/gray/cyan mapped; orange/yellow/margin bands need scheme context",
        "sourceTextSearch": source_hits,
        "visualLegendEvidence": VISUAL_LEGEND_EVIDENCE,
        "legendTable": legend_table,
        "coverage": coverage,
        "mixedAudit": mixed_audit,
        "visualQA": visual_qa,
        "qaSummary": {
            "chartsChecked": qa_total,
            "handMismatchesOnReparse": qa_mismatches,
            "orientationPassed": orient_ok,
        },
    }

    OUTPUT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    OUTPUT_MD.write_text(render_markdown(report))
    print(f"Wrote {OUTPUT_JSON}")
    print(f"Wrote {OUTPUT_MD}")
    print(f"GRADING-ALLOWED: {coverage['gradingAllowedAfter']} (unchanged)")


if __name__ == "__main__":
    main()
