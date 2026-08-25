#!/usr/bin/env python3
"""Stage 4.6 — Stack fix before/after audit + re-parse trigger."""
from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BEFORE_SNAPSHOT = ROOT / "data/trainer/built/batch2-parsed-hands.before-stack-fix.json"
PARSED = ROOT / "data/trainer/built/batch2-parsed-hands.json"
MANIFEST = ROOT / "data/trainer/source/RANGE_CHART_MANIFEST.csv"
OUTPUT = ROOT / "trainer-knowledge/TRAINER_STACK_FIX_AUDIT.json"


def cell_action_summary(charts: dict) -> Counter:
    counts = Counter()
    for chart in charts.values():
        for cell in chart.get("hands", {}).values():
            ar = cell.get("actionRaw") or "NONE"
            counts[ar] += 1
            if cell.get("gradingAllowed"):
                counts["__grading__"] += 1
            if cell.get("isMixed"):
                counts["__mixed__"] += 1
            if cell.get("dataStatus") == "EXACT_TRAINER_DATA" and not cell.get("isMixed"):
                counts["__verified__"] += 1
    return counts


def green_cells_by_chart(charts: dict, manifest: dict) -> dict:
    """Track green-labeled cells (nAI or RAISE primary action)."""
    out = {}
    for cid, chart in charts.items():
        nai = raise_c = other = 0
        for cell in chart.get("hands", {}).values():
            ar = cell.get("actionRaw")
            if ar == "nAI":
                nai += 1
            elif ar == "RAISE":
                raise_c += 1
            elif ar in ("AI", "UNSELECTED", "LOW_PLAYABILITY") or (
                ar and (ar.startswith("ORANGE_") or ar.startswith("YELLOW_") or ar.startswith("COLOR_"))
            ):
                other += 1
        if nai or raise_c:
            out[cid] = {
                "sourceMode": chart.get("sourceMode") or manifest.get(cid, {}).get("source_mode"),
                "stack": manifest.get(cid, {}).get("stack"),
                "nAI": nai,
                "RAISE": raise_c,
            }
    return out


def compare_charts(before: dict, after: dict, manifest: dict) -> dict:
    affected_charts = []
    cell_changes = Counter()

    for cid in set(before.keys()) | set(after.keys()):
        b_hands = before.get(cid, {}).get("hands", {})
        a_hands = after.get(cid, {}).get("hands", {})
        chart_changed = False
        chart_cell_changes = 0

        for hand in set(b_hands.keys()) | set(a_hands.keys()):
            b = b_hands.get(hand, {})
            a = a_hands.get(hand, {})
            if b.get("actionRaw") != a.get("actionRaw") or b.get("gradingAllowed") != a.get("gradingAllowed"):
                chart_changed = True
                chart_cell_changes += 1
                key = f"{b.get('actionRaw')}->{a.get('actionRaw')}"
                cell_changes[key] += 1

        if chart_changed:
            affected_charts.append({
                "chartId": cid,
                "stack": manifest.get(cid, {}).get("stack"),
                "sourceMode": after.get(cid, {}).get("sourceMode"),
                "cellsChanged": chart_cell_changes,
            })

    return {
        "affectedCharts": len(affected_charts),
        "affectedCells": sum(c["cellsChanged"] for c in affected_charts),
        "cellChangeBreakdown": dict(cell_changes.most_common(30)),
        "affectedChartSample": affected_charts[:25],
    }


def classify_counts(counts: Counter) -> dict:
    nai = counts.get("nAI", 0)
    raise_c = counts.get("RAISE", 0)
    unresolved = sum(
        v for k, v in counts.items()
        if not k.startswith("__")
        and k not in ("nAI", "RAISE", "AI")
    )
    return {
        "nAI": nai,
        "RAISE": raise_c,
        "AI": counts.get("AI", 0),
        "UNSELECTED": counts.get("UNSELECTED", 0),
        "verified": counts.get("__verified__", 0),
        "grading": counts.get("__grading__", 0),
        "mixed": counts.get("__mixed__", 0),
        "unresolved": unresolved,
    }


def main() -> None:
    # Save before snapshot if not exists
    if PARSED.exists() and not BEFORE_SNAPSHOT.exists():
        shutil.copy2(PARSED, BEFORE_SNAPSHOT)
        print(f"Saved before snapshot: {BEFORE_SNAPSHOT}")

    before = {}
    if BEFORE_SNAPSHOT.exists():
        before = json.loads(BEFORE_SNAPSHOT.read_text()).get("charts", {})

    before_counts = cell_action_summary(before) if before else Counter()

    # Re-parse
    print("Re-parsing Batch 2 with fixed stack parser...")
    subprocess.run(
        [sys.executable, str(ROOT / "trainer-knowledge/scripts/parseBatch2Webp.py")],
        check=True,
        cwd=str(ROOT / "trainer-knowledge/scripts"),
    )

    after = json.loads(PARSED.read_text()).get("charts", {})
    after_counts = cell_action_summary(after)

    manifest = {}
    with MANIFEST.open() as f:
        for row in csv.DictReader(f):
            manifest[row["chart_id"]] = row

    comparison = compare_charts(before, after, manifest) if before else {}

    audit = {
        "stage": "4.6",
        "stackParserFixed": True,
        "before": classify_counts(before_counts),
        "after": classify_counts(after_counts),
        "comparison": comparison,
        "delta": {
            "nAI": classify_counts(after_counts)["nAI"] - classify_counts(before_counts).get("nAI", 0),
            "RAISE": classify_counts(after_counts)["RAISE"] - classify_counts(before_counts).get("RAISE", 0),
            "verified": classify_counts(after_counts)["verified"] - classify_counts(before_counts).get("verified", 0),
            "grading": classify_counts(after_counts)["grading"] - classify_counts(before_counts).get("grading", 0),
        },
    }

    OUTPUT.write_text(json.dumps(audit, indent=2))
    print(json.dumps(audit, indent=2))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
