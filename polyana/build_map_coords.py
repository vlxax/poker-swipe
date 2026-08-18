#!/usr/bin/env python3
"""
Build static PokerSwipe Polyana map coordinates.

IMPORTANT:
- Runs on GitHub Actions, never in the user's browser.
- Preserves already resolved coordinates.
- Reads the canonical 65-club source:
    data/moscow_club_locations_source.json
- Writes:
    polyana/club_coords.json
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "moscow_club_locations_source.json"
OUTPUT = ROOT / "polyana" / "club_coords.json"

# Moscow + close Moscow-region envelope used only as a hard sanity check.
MIN_LAT, MAX_LAT = 54.90, 56.30
MIN_LNG, MAX_LNG = 36.65, 39.05

USER_AGENT = "PokerSwipe-Polyana-Map/2.0 (+https://github.com/vlxax/poker-swipe)"
SLEEP_NOMINATIM = 1.10
SLEEP_PHOTON = 0.45

VERIFIED_SEEDS = {
    "minds": (55.682229, 37.580647),
    "joker-poker-club-moscow": (55.582987, 37.595142),
    "pride": (55.771803, 37.684111),
    "check-check-club": (55.761279, 37.663018),
    "heads-up": (55.777318, 37.636410),
}

def valid(lat, lng):
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG

def clean_address(value: str) -> str:
    s = str(value or "").strip()
    # Geocoders generally perform better without floor / entrance / metro hints.
    s = re.sub(r"\((?:[^)]*(?:этаж|подъезд|метро|тц|трк)[^)]*)\)", " ", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip(" ,")
    return s

def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return fallback

def fetch_json(url: str):
    req = Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
    })
    with urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))

def query_variants(club):
    address = clean_address(club.get("address"))
    alt = clean_address(club.get("address_alternative"))
    variants = []
    if address:
        variants.append(f"{address}, Москва, Россия")
    if alt and alt != address:
        variants.append(f"{alt}, Москва, Россия")
    # A second, simpler variant helps when the source has verbose mall/floor text.
    simple = re.sub(r",?\s*(?:ТЦ|ТРК)\s+[^,]+", "", address, flags=re.I).strip(" ,")
    if simple and simple != address:
        variants.append(f"{simple}, Москва, Россия")
    # de-duplicate while preserving order
    out = []
    for q in variants:
        if q not in out:
            out.append(q)
    return out

def nominatim(q: str):
    params = {
        "format": "jsonv2",
        "limit": "4",
        "countrycodes": "ru",
        "addressdetails": "1",
        "bounded": "1",
        # lon1,lat1,lon2,lat2
        "viewbox": f"{MIN_LNG},{MAX_LAT},{MAX_LNG},{MIN_LAT}",
        "q": q,
    }
    url = "https://nominatim.openstreetmap.org/search?" + urlencode(params)
    try:
        rows = fetch_json(url)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        rows = []
    time.sleep(SLEEP_NOMINATIM)
    for row in rows if isinstance(rows, list) else []:
        lat, lng = row.get("lat"), row.get("lon")
        if valid(lat, lng):
            return float(lat), float(lng), "nominatim"
    return None

def photon(q: str):
    params = {
        "q": q,
        "limit": "4",
        "lat": "55.7558",
        "lon": "37.6173",
        "lang": "ru",
    }
    url = "https://photon.komoot.io/api/?" + urlencode(params)
    try:
        data = fetch_json(url)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        data = {}
    time.sleep(SLEEP_PHOTON)
    for row in (data.get("features") or []) if isinstance(data, dict) else []:
        co = ((row.get("geometry") or {}).get("coordinates") or [])
        if len(co) >= 2 and valid(co[1], co[0]):
            return float(co[1]), float(co[0]), "photon"
    return None

def resolve(club):
    for q in query_variants(club):
        result = nominatim(q)
        if result:
            return result
    for q in query_variants(club):
        result = photon(q)
        if result:
            return result
    return None

def main():
    if not SOURCE.exists():
        raise SystemExit(f"Missing source: {SOURCE}")

    source = load_json(SOURCE, {})
    clubs = source.get("clubs") or []
    if len(clubs) < 50:
        raise SystemExit(f"Refusing coordinate rebuild: source contains only {len(clubs)} clubs")

    existing_payload = load_json(OUTPUT, {})
    existing = {}
    for row in existing_payload.get("clubs") or []:
        cid = str(row.get("id") or "")
        if cid and valid(row.get("lat"), row.get("lng")):
            # address is part of cache identity: if club moved, re-geocode it.
            existing[(cid, str(row.get("address") or ""))] = row

    resolved_rows = []
    unresolved = []

    total = len(clubs)
    for idx, club in enumerate(clubs, 1):
        cid = str(club.get("id") or "").strip()
        name = str(club.get("name") or "").strip()
        address = str(club.get("address") or "").strip()
        if not cid or not address:
            unresolved.append({**club, "status": "missing_address_or_id"})
            continue

        if cid in VERIFIED_SEEDS:
            lat, lng = VERIFIED_SEEDS[cid]
            row = {
                "id": cid, "name": name, "address": address,
                "lat": lat, "lng": lng, "status": "verified_seed"
            }
            resolved_rows.append(row)
            print(f"[{idx}/{total}] seed {name}")
            continue

        cached = existing.get((cid, address))
        if cached:
            resolved_rows.append({
                "id": cid, "name": name, "address": address,
                "lat": float(cached["lat"]), "lng": float(cached["lng"]),
                "status": cached.get("status") or "cached"
            })
            print(f"[{idx}/{total}] cached {name}")
            continue

        result = resolve(club)
        if result:
            lat, lng, provider = result
            resolved_rows.append({
                "id": cid, "name": name, "address": address,
                "lat": lat, "lng": lng,
                "status": "geocoded",
                "provider": provider,
                "needs_manual_review": bool(club.get("needs_manual_review")),
            })
            print(f"[{idx}/{total}] resolved {name} -> {lat:.6f},{lng:.6f}")
        else:
            unresolved.append({
                "id": cid, "name": name, "address": address,
                "lat": None, "lng": None, "status": "unresolved",
                "needs_manual_review": bool(club.get("needs_manual_review")),
            })
            print(f"[{idx}/{total}] UNRESOLVED {name}", file=sys.stderr)

    # Stable ordering follows the source catalog.
    order = {str(c.get("id")): i for i, c in enumerate(clubs)}
    resolved_rows.sort(key=lambda r: order.get(r["id"], 9999))
    unresolved.sort(key=lambda r: order.get(str(r.get("id")), 9999))

    payload = {
        "schema_version": 2,
        "city": "Москва",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "club_count": total,
        "resolved_count": len(resolved_rows),
        "unresolved_count": len(unresolved),
        "clubs": resolved_rows,
        "unresolved": unresolved,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"Done: resolved={len(resolved_rows)}/{total}, unresolved={len(unresolved)}")

    # Do not fail the whole workflow just because a few source addresses are ambiguous.
    # But fail if the result is catastrophically incomplete.
    if len(resolved_rows) < 45:
        raise SystemExit(f"Too few coordinates resolved: {len(resolved_rows)}/{total}")

if __name__ == "__main__":
    main()
