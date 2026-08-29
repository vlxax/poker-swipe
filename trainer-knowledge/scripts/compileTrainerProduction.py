#!/usr/bin/env python3
"""Compile normalized trainer import → compact production built/ assets.

Reads bekhtold normalized JSON + trusted UO production hand records.
Outputs: charts-index.json, trainer-shards/, trainer-shard-index.json, meta.json, indexes/
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[2]
BUILT = ROOT / "data/trainer/built"
IMPORT_ROOT = Path(os.environ.get("TRAINER_IMPORT_ROOT", ROOT / "data/trainer/imported"))
IMPORT_ROOT_REL = "data/trainer/imported"
ZZZZ_IMPORT = Path(os.environ.get("TRAINER_ZZZZ_IMPORT", ROOT.parent / "zzzz/data/trainer-ranges"))
SHARD_SIZE = 50
HAND_ORDER: List[str] = []
RANKS = list("AKQJT98765432")
for i, r1 in enumerate(RANKS):
    for j, r2 in enumerate(RANKS):
        if i < j:
            HAND_ORDER.append(f"{r1}{r2}s")
        elif i > j:
            HAND_ORDER.append(f"{r2}{r1}o")
        else:
            HAND_ORDER.append(f"{r1}{r2}")

KNOWN_POSITIONS = {"UTG", "UTG+1", "EP", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB", "IP", "OOP"}


def parse_position(raw: Optional[str]) -> Dict[str, Any]:
    value = str(raw or "").strip()
    if not value:
        return {"type": "UNKNOWN", "values": [], "raw": None}
    lower = value.lower()
    if lower in ("any_position", "any"):
        return {"type": "ANY", "values": [], "raw": value}
    upper = value.upper()
    if upper in KNOWN_POSITIONS:
        return {"type": "SINGLE", "values": [upper], "raw": value}
    tokens = re.split(r"[_+\-]", value)
    found = [t.strip().upper() for t in tokens if t.strip().upper() in KNOWN_POSITIONS]
    uniq = list(dict.fromkeys(found))
    if len(uniq) == 1:
        return {"type": "SINGLE", "values": uniq, "raw": value}
    if len(uniq) > 1:
        return {"type": "GROUP", "values": uniq, "raw": value}
    return {"type": "GROUP", "values": [], "raw": value}


def parse_stack(raw: Optional[str]) -> Dict[str, Any]:
    s = str(raw or "").strip()
    if not s:
        return {"type": "UNKNOWN", "raw": s}
    norm = s.upper().replace("BBPLUS", "BB+").replace("–", "-")
    m = re.match(r"^(\d+(?:\.\d+)?)\s*BB\+$", norm)
    if m:
        return {"type": "MINIMUM", "raw": s, "minBb": float(m.group(1))}
    m = re.match(r"^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*BB$", norm)
    if m:
        return {"type": "RANGE", "raw": s, "minBb": float(m.group(1)), "maxBb": float(m.group(2))}
    m = re.match(r"^(\d+(?:\.\d+)?)\s*BB$", norm)
    if m:
        return {"type": "EXACT", "raw": s, "bb": float(m.group(1))}
    if re.match(r"^\d+-\d+$", s):
        return {"type": "BAND", "raw": s, "values": [s]}
    return {"type": "UNKNOWN", "raw": s}


def map_spot(source_mode: str, raw_spot: Optional[str], source_group: Optional[str] = None) -> Dict[str, Any]:
    raw = str(raw_spot or "").strip()
    mode = str(source_mode or "").strip()
    canonical = f"{mode}::{raw}" if raw else f"{mode}::(no_spot)"
    if raw == "UO" or source_group == "UO" or mode == "uo":
        return {
            "rawSpot": raw or "UO",
            "trainerCanonicalId": "uo::open",
            "pokerswipeAlias": "rfi",
            "mapStatus": "MAPPED_PARTIAL",
            "mapNote": "UO dataset — open range by position/stack",
        }
    aliases = {
        "Def_BB": ("bb_defend", "MAPPED_EXACT"),
        "Open_Push": ("push_fold", "MAPPED_EXACT"),
        "Resteal": ("resteal", "MAPPED_EXACT"),
    }
    mode_defaults = {
        "vs1r": "vs_open", "vssqueeze": "vs_squeeze", "vs3bet": "vs_3bet",
        "vs4bet": "vs_4bet", "vs2r": "vs_3bet", "vslimp": "vs_limp",
        "sbvsbb": "sb_vs_bb", "callpush": "call_vs_push", "huante": "hu_ante",
        "vs1r1c": "vs_open", "vs1rshort": "vs_open",
    }
    if raw in aliases:
        alias, status = aliases[raw]
        return {"rawSpot": raw, "trainerCanonicalId": canonical, "pokerswipeAlias": alias, "mapStatus": status, "mapNote": None}
    if not raw and mode in mode_defaults:
        return {"rawSpot": None, "trainerCanonicalId": canonical, "pokerswipeAlias": mode_defaults[mode], "mapStatus": "MAPPED_PARTIAL", "mapNote": f"Inferred from source_mode={mode}"}
    if raw and mode:
        return {"rawSpot": raw, "trainerCanonicalId": canonical, "pokerswipeAlias": None, "mapStatus": "UNMAPPED_TRAINER_SPOT", "mapNote": None}
    return {"rawSpot": raw or None, "trainerCanonicalId": canonical, "pokerswipeAlias": None, "mapStatus": "UNMAPPED_TRAINER_SPOT", "mapNote": None}


def compact_hand(cell: Dict[str, Any]) -> Dict[str, Any]:
    out = {
        "a": cell.get("actionRaw"),
        "d": cell.get("dataStatus") or "NEEDS_CLARIFICATION",
        "g": 1 if cell.get("gradingAllowed") else 0,
        "p": cell.get("parsingStatus") or "PARSED",
        "m": 1 if cell.get("isMixed") else 0,
    }
    strats = cell.get("strategies") or []
    if cell.get("isMixed") and len(strats) > 1:
        out["s"] = [
            {
                "a": st.get("rawAction"),
                "f": st.get("frequency"),
                "t": "E" if st.get("frequencyType") == "EXACT" else "V",
                "g": 1 if st.get("gradingAllowed") else 0,
            }
            for st in strats
        ]
    return out


def expand_for_compare(cell: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "actionRaw": cell.get("actionRaw"),
        "gradingAllowed": bool(cell.get("gradingAllowed")),
        "isMixed": bool(cell.get("isMixed")),
        "strategies": cell.get("strategies"),
        "dataStatus": cell.get("dataStatus"),
    }


def find_import_root() -> Path:
    # DEVIATION: also try Desktop zzzz import workspace (current machine layout).
    desktop = Path.home() / "Desktop" / "zzzz" / "data" / "trainer-ranges"
    for p in [IMPORT_ROOT, ZZZZ_IMPORT, desktop]:
        if (p / "index.json").exists() or (p / "uo/by-stack").exists() or (p / "bekhtold").exists():
            return p
    raise FileNotFoundError(f"No import root found at {IMPORT_ROOT} or {ZZZZ_IMPORT} or {desktop}")


def import_root_provenance(import_root: Path) -> str:
    """Repo-relative provenance only — never emit machine-specific absolute paths."""
    try:
        return import_root.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return IMPORT_ROOT_REL


def load_bekhtold_ranges(import_root: Path) -> List[Dict[str, Any]]:
    shard_dir = import_root / "bekhtold/by-category/ranges"
    if not shard_dir.exists():
        shard_dir = import_root / "bekhtold/by-category"
    ranges = []
    for p in sorted(shard_dir.rglob("*.json")):
        ranges.append(json.loads(p.read_text(encoding="utf-8")))
    return ranges


def chart_id_for_bekhtold(norm: Dict[str, Any]) -> str:
    rid = norm["metadata"]["rangeId"]
    return f"BL_{rid}"


def chart_id_for_uo_zip(stack: str, position: str) -> str:
    return f"UO_{stack}_{position}"


def build_bekhtold_chart(norm: Dict[str, Any]) -> Dict[str, Any]:
    meta = norm["metadata"]
    filters = meta.get("filters") or {}
    category = meta.get("category") or "unknown"
    spot_raw = filters.get("spot")
    hero = parse_position(filters.get("position"))
    opp = parse_position(filters.get("opponent"))
    stack_sem = meta.get("stackSemantics") or parse_stack(filters.get("stack"))
    stack = {"type": stack_sem.get("type", "UNKNOWN"), "raw": filters.get("stack"), "semantics": stack_sem}
    if stack_sem.get("type") == "BAND":
        stack = {"type": "BAND", "raw": stack_sem["raw"], "values": stack_sem.get("values", [stack_sem["raw"]])}
    chart_id = chart_id_for_bekhtold(norm)
    prov = {
        "source": "TRAINER",
        "dataset": "bekhtold_import_v1",
        "sourceFile": norm["sourcePath"],
        "sourceHash": hashlib.sha256(norm["sourcePath"].encode()).hexdigest()[:12],
        "chartId": chart_id,
        "importId": norm["id"],
        "parserStatus": norm.get("parseStatus"),
    }
    return {
        "id": chart_id,
        "dataset": "bekhtold_import_v1",
        "sourceGroup": category,
        "sourceMode": category,
        "spot": map_spot(category, spot_raw, category),
        "heroPosition": hero,
        "opponentPosition": opp if opp.get("raw") else {"type": "UNKNOWN", "values": [], "raw": filters.get("opponent")},
        "stack": stack,
        "betSize": {"raw": filters.get("bet")},
        "openSize": {"raw": filters.get("open")},
        "handRecordCount": 169,
        "dataStatus": "PARTIAL_TRAINER_DATA",
        "parseStats": norm.get("parseStats"),
        "parseStatus": norm.get("parseStatus"),
        "hasParsedHands": len(norm.get("hands") or {}) == 169,
        "provenance": prov,
        "importProvenance": {
            "normalizedId": norm["id"],
            "sourceArchive": norm["sourceFile"],
            "hierarchy": norm.get("hierarchy"),
        },
    }


def load_trusted_uo() -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Dict[str, Any]]]]:
    charts_path = BUILT / "charts-index.json"
    uo_path = BUILT / "uo-hand-records.json"
    if not charts_path.exists() or not uo_path.exists():
        raise FileNotFoundError("Legacy UO trusted data missing — cannot compile UO without regression baseline")
    charts = [c for c in json.loads(charts_path.read_text()) if c.get("sourceMode") == "uo"]
    records = json.loads(uo_path.read_text())
    by_chart: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)
    for rec in records:
        by_chart[rec["chartId"]][rec["hand"]] = {
            "actionRaw": rec["actionRaw"],
            "dataStatus": rec["dataStatus"],
            "gradingAllowed": rec.get("gradingAllowed", False),
            "parsingStatus": rec.get("parserStatus", "VERIFIED_BY_COLOR_GRID"),
            "isMixed": False,
            "strategies": [{"rawAction": rec["actionRaw"], "frequency": 100.0, "frequencyType": "EXACT", "gradingAllowed": rec.get("gradingAllowed", False), "dataStatus": rec["dataStatus"]}],
            "sourceColor": rec.get("sourceColor"),
        }
    return charts, dict(by_chart)


def build_indexes(charts: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_id = {c["id"]: c["id"] for c in charts}
    by_spot, by_mode, by_stack, by_hero = {}, {}, {}, {}
    for c in charts:
        spot_key = c["spot"].get("rawSpot") or f"(mode:{c['sourceMode']})"
        by_spot.setdefault(spot_key, []).append(c["id"])
        by_mode.setdefault(c["sourceMode"], []).append(c["id"])
        sr = c["stack"].get("raw")
        if sr:
            by_stack.setdefault(sr, []).append(c["id"])
        hr = c["heroPosition"].get("raw")
        if hr:
            by_hero.setdefault(hr, []).append(c["id"])
    return {"by_id": by_id, "by_spot_raw": by_spot, "by_source_mode": by_mode, "by_stack": by_stack, "by_hero_position": by_hero}


def main() -> int:
    import_root = find_import_root()
    print(f"Import root: {import_root}")

    bekhtold = load_bekhtold_ranges(import_root)
    uo_charts, uo_hands = load_trusted_uo()

    charts: List[Dict[str, Any]] = []
    chart_hands: Dict[str, Dict[str, Dict[str, Any]]] = {}

    for norm in bekhtold:
        cid = chart_id_for_bekhtold(norm)
        charts.append(build_bekhtold_chart(norm))
        chart_hands[cid] = norm.get("hands") or {}

    for uc in uo_charts:
        cid = uc["id"]
        charts.append(uc)
        chart_hands[cid] = uo_hands.get(cid, {})

    # Coverage assertions
    assert len(bekhtold) == 1638, f"bekhtold {len(bekhtold)} != 1638"
    assert len(uo_charts) == 60, f"uo {len(uo_charts)} != 60"
    assert len(charts) == 1698, f"charts {len(charts)} != 1698"

  # UO regression gate
    btn_id = "UO_2-4_BTN"
    trusted = uo_hands.get(btn_id, {})
    import_path = import_root / "uo/by-stack/2-4/BTN.json"
    if import_path.exists():
        imported = json.loads(import_path.read_text())
        mism = []
        for hand in HAND_ORDER:
            t = trusted.get(hand, {}).get("actionRaw")
            n = imported.get("hands", {}).get(hand, {}).get("actionRaw")
            if t != n:
                mism.append((hand, t, n))
        if mism:
            report = {"chartId": btn_id, "mismatchCount": len(mism), "sample": mism[:30]}
            (BUILT / "uo-regression-discrepancy.json").write_text(json.dumps(report, indent=2))
            print(f"UO REGRESSION: {len(mism)} mismatches — using TRUSTED production data for UO zip charts", file=sys.stderr)

    ids = [c["id"] for c in charts]
    assert len(ids) == len(set(ids)), "duplicate chart IDs"

    for cid, hands in chart_hands.items():
        assert len(hands) == 169, f"{cid} has {len(hands)} hands"

    # Write shards
    shard_dir = BUILT / "trainer-shards"
    shard_dir.mkdir(parents=True, exist_ok=True)
    for old in shard_dir.glob("*.json"):
        old.unlink()

    sorted_ids = sorted(chart_hands.keys())
    chart_to_shard = {}
    shard_sizes = []
    shard_num = 0

    for i in range(0, len(sorted_ids), SHARD_SIZE):
        slice_ids = sorted_ids[i : i + SHARD_SIZE]
        shard_id = f"shard-{shard_num:03d}"
        charts_payload = {}
        for cid in slice_ids:
            chart_to_shard[cid] = shard_id
            chart_meta = next(c for c in charts if c["id"] == cid)
            hands_compact = {h: compact_hand(chart_hands[cid][h]) for h in HAND_ORDER}
            charts_payload[cid] = {
                "id": cid,
                "ps": chart_meta.get("parseStatus", "SUCCESS"),
                "st": chart_meta.get("parseStats"),
                "sf": chart_meta.get("provenance", {}).get("sourceFile"),
                "sm": chart_meta.get("sourceMode"),
                "h": hands_compact,
            }
        payload = json.dumps({"charts": charts_payload}, separators=(",", ":"))
        (shard_dir / f"{shard_id}.json").write_text(payload)
        shard_sizes.append(len(payload.encode()))
        shard_num += 1

    shard_index = {
        "shardCount": shard_num,
        "chartsPerShard": SHARD_SIZE,
        "chartToShard": chart_to_shard,
        "totalCharts": len(sorted_ids),
        "totalShardBytes": sum(shard_sizes),
        "avgShardBytes": sum(shard_sizes) // max(shard_num, 1),
        "maxShardBytes": max(shard_sizes) if shard_sizes else 0,
    }
    (BUILT / "trainer-shard-index.json").write_text(json.dumps(shard_index, indent=2))

    indexes = build_indexes(charts)
    idx_dir = BUILT / "indexes"
    idx_dir.mkdir(parents=True, exist_ok=True)
    for name, data in indexes.items():
        (idx_dir / f"{name.replace('_', '-')}.json").write_text(json.dumps(data, indent=2))

    meta = {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "compiler": "compileTrainerProduction.py",
        "importRoot": import_root_provenance(import_root),
        "stats": {
            "totalCharts": 1698,
            "bekhtoldCharts": 1638,
            "uoZipCharts": 60,
            "uoDataSource": "trusted_production_uo-hand-records",
            "bekhtoldDataSource": "normalized_import",
            "shardCount": shard_num,
            "coldStartupFiles": ["charts-index.json", "trainer-shard-index.json", "meta.json"],
        },
        "shardIndex": shard_index,
    }
    (BUILT / "meta.json").write_text(json.dumps(meta, indent=2))
    (BUILT / "charts-index.json").write_text(json.dumps(charts, indent=2))

    # Keep trusted UO baseline in place; also snapshot as .legacy.json for audit.
    # DEVIATION from transcript: copy instead of rename so uo-hand-records.json is not removed.
    legacy_uo = BUILT / "uo-hand-records.json"
    if legacy_uo.exists():
        backup = BUILT / "uo-hand-records.legacy.json"
        if not backup.exists():
            backup.write_bytes(legacy_uo.read_bytes())

    print(json.dumps({"charts": len(charts), "shards": shard_num, "indexBytes": (BUILT / 'charts-index.json').stat().st_size, "shardIndexBytes": (BUILT / 'trainer-shard-index.json').stat().st_size, "totalShardMB": round(sum(shard_sizes)/1048576, 2)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
