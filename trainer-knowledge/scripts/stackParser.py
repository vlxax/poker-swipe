"""Central trainer stack-band parser.

Represents stack semantics explicitly — never flattens a range to an arbitrary BB.
Used by Batch 2 WEBP parsing and semantic validation.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple, Union

StackSemantics = Dict[str, Any]

# UO SOURCE_NOTES boundary between nAI (<=15-18) and RAISE (18-25+) bands
UO_RAISE_THRESHOLD_BB = 18.0


def parse_trainer_stack(stack_raw: Optional[str]) -> StackSemantics:
    """Parse trainer stack string into explicit semantics."""
    raw = str(stack_raw or "").strip()
    if not raw:
        return {"type": "UNKNOWN", "raw": raw}

    # Context stacks (villain / spot-relative) — not hero depth for UO green rule
    if raw.lower().startswith("vs_"):
        return _parse_context_stack(raw)

    normalized = raw.upper().replace("BBPLUS", "BB+").replace("PLUS", "+")

    # MINIMUM: 40BBplus → 40BB+, 115BBplus, 50BBplus
    plus_match = re.match(r"^(\d+(?:\.\d+)?)\s*BB\+$", normalized)
    if plus_match:
        min_bb = float(plus_match.group(1))
        return {"type": "MINIMUM", "raw": raw, "minBb": min_bb}

    # RANGE: 16-22BB, 30-40BB, 8-12BB
    range_match = re.match(r"^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*BB$", normalized)
    if range_match:
        min_bb = float(range_match.group(1))
        max_bb = float(range_match.group(2))
        return {"type": "RANGE", "raw": raw, "minBb": min_bb, "maxBb": max_bb}

    # EXACT: 25BB, 22.5BB, 2BB
    exact_match = re.match(r"^(\d+(?:\.\d+)?)\s*BB$", normalized)
    if exact_match:
        bb = float(exact_match.group(1))
        return {"type": "EXACT", "raw": raw, "bb": bb}

    return {"type": "UNKNOWN", "raw": raw}


def _parse_context_stack(raw: str) -> StackSemantics:
    """vs_15BB_2x, vs_12-16BB, vs_20-25BB — spot context, not hero stack band."""
    body = raw[3:]  # strip vs_
    if "_2x" in body.lower() or "_3x" in body.lower():
        # vs_15BB_2x
        m = re.match(r"^(\d+(?:\.\d+)?)\s*BB", body, re.I)
        if m:
            return {
                "type": "CONTEXT",
                "raw": raw,
                "contextKind": "VS_OPEN",
                "bb": float(m.group(1)),
                "note": "Villain/spot stack context — not used for UO green nAI/RAISE rule",
            }
    range_m = re.match(r"^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*BB", body, re.I)
    if range_m:
        return {
            "type": "CONTEXT",
            "raw": raw,
            "contextKind": "VS_RANGE",
            "minBb": float(range_m.group(1)),
            "maxBb": float(range_m.group(2)),
            "note": "Villain/spot stack context — not used for UO green nAI/RAISE rule",
        }
    return {"type": "CONTEXT", "raw": raw, "contextKind": "VS_UNKNOWN"}


def stack_contains_bb(semantics: StackSemantics, bb: float) -> bool:
    """Return whether numeric BB falls within trainer stack semantics."""
    t = semantics.get("type")
    if t == "EXACT":
        return semantics["bb"] == bb
    if t == "RANGE":
        return semantics["minBb"] <= bb <= semantics["maxBb"]
    if t == "MINIMUM":
        return bb >= semantics["minBb"]
    if t == "CONTEXT" and "bb" in semantics:
        return semantics["bb"] == bb
    if t == "CONTEXT" and "minBb" in semantics:
        return semantics["minBb"] <= bb <= semantics["maxBb"]
    return False


def match_query_to_record(
    query_bb: float, record_semantics: StackSemantics
) -> str:
    """Match numeric query BB against a record's stack semantics.

    Returns: exact | band | none
    """
    if record_semantics.get("type") == "EXACT":
        return "exact" if record_semantics["bb"] == query_bb else "none"

    if record_semantics.get("type") == "RANGE":
        lo, hi = record_semantics["minBb"], record_semantics["maxBb"]
        if lo <= query_bb <= hi:
            return "band"
        return "none"

    if record_semantics.get("type") == "MINIMUM":
        return "band" if query_bb >= record_semantics["minBb"] else "none"

    return "none"


def match_query_to_records(
    query_raw: str, records: List[StackSemantics]
) -> Dict[str, Any]:
    """Match query stack string against multiple record bands.

    Returns match kind and ambiguity flag when multiple bands overlap.
    """
    query = parse_trainer_stack(query_raw)
    if query["type"] == "EXACT":
        query_bb = query["bb"]
        matches = [r for r in records if match_query_to_record(query_bb, r) != "none"]
        if len(matches) == 0:
            return {"kind": "none", "ambiguous": False, "matches": 0}
        if len(matches) == 1:
            kind = match_query_to_record(query_bb, matches[0])
            return {"kind": kind, "ambiguous": False, "matches": 1}
        return {"kind": "band", "ambiguous": True, "matches": len(matches)}

    # For range/minimum query against records — exact raw match preferred
    exact_raw = [r for r in records if r.get("raw") == query.get("raw")]
    if len(exact_raw) == 1:
        return {"kind": "exact", "ambiguous": False, "matches": 1}
    if len(exact_raw) > 1:
        return {"kind": "exact", "ambiguous": True, "matches": len(exact_raw)}

    return {"kind": "none", "ambiguous": False, "matches": 0}


def green_action_for_stack(
    stack_raw: Optional[str],
    *,
    threshold: float = UO_RAISE_THRESHOLD_BB,
) -> Tuple[str, bool, str, str]:
    """Resolve green legend action from stack semantics per SOURCE_NOTES.

    Returns: (rawAction, gradingAllowed, dataStatus, resolutionNote)
    Does NOT invent semantics — ambiguous bands stay NEEDS_CLARIFICATION.
    """
    sem = parse_trainer_stack(stack_raw)
    t = sem.get("type")

    if t in ("UNKNOWN", "CONTEXT"):
        return (
            "nAI",
            False,
            "NEEDS_CLARIFICATION",
            f"stack type {t} — no UO green rule applied",
        )

    if t == "EXACT":
        bb = sem["bb"]
        if bb <= threshold:
            return ("nAI", False, "NEEDS_CLARIFICATION", f"exact {bb}BB <= {threshold}")
        return ("RAISE", True, "EXACT_TRAINER_DATA", f"exact {bb}BB > {threshold}")

    if t == "MINIMUM":
        min_bb = sem["minBb"]
        if min_bb > threshold:
            return (
                "RAISE",
                True,
                "EXACT_TRAINER_DATA",
                f"minimum {min_bb}BB+ entirely > {threshold}",
            )
        return (
            "nAI",
            False,
            "NEEDS_CLARIFICATION",
            f"minimum {min_bb}BB+ spans <= and > {threshold}",
        )

    if t == "RANGE":
        min_bb, max_bb = sem["minBb"], sem["maxBb"]
        if max_bb <= threshold:
            return (
                "nAI",
                False,
                "NEEDS_CLARIFICATION",
                f"range {min_bb}-{max_bb}BB entirely <= {threshold}",
            )
        if min_bb > threshold:
            return (
                "RAISE",
                True,
                "EXACT_TRAINER_DATA",
                f"range {min_bb}-{max_bb}BB entirely > {threshold}",
            )
        return (
            "nAI",
            False,
            "NEEDS_CLARIFICATION",
            f"range {min_bb}-{max_bb}BB spans {threshold} boundary — ambiguous",
        )

    return ("nAI", False, "NEEDS_CLARIFICATION", "unhandled stack type")


# Backward-compatible helper — returns representative BB only for EXACT stacks
def parse_stack_bb(stack_raw: Optional[str]) -> Optional[float]:
    sem = parse_trainer_stack(stack_raw)
    if sem.get("type") == "EXACT":
        return sem["bb"]
    return None
