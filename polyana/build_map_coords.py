#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("POLYANA_SOURCE", ROOT / "data" / "moscow_club_locations_source.json"))
OUTPUT = Path(os.environ.get("POLYANA_OUTPUT", ROOT / "polyana" / "club_coords.json"))
OVERRIDES = Path(os.environ.get("POLYANA_OVERRIDES", ROOT / "polyana" / "verified_overrides.json"))

MIN_LAT, MAX_LAT = 54.90, 56.30
MIN_LNG, MAX_LNG = 36.65, 39.05
UA = "PokerSwipe-Polyana-Map/4.0 (+https://github.com/vlxax/poker-swipe)"

def valid(lat, lng):
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG

def read_json(path, fallback):
    try:
        return json.loads(Path(path).read_text("utf-8"))
    except Exception:
        return fallback

def fetch_json(url):
    req = Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
    })
    with urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

def clean_address(value):
    s = str(value or "").strip()
    s = re.sub(r"\((?:[^)]*(?:этаж|подъезд|метро|вход)[^)]*)\)", " ", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip(" ,")
    return s

def normalize_addr(s):
    s = str(s or "").lower().replace("ё","е")
    replacements = {
        "строение":"с", "стр.":"с", "стр ":"с ",
        "корпус":"к", "корп.":"к", "дом":"", "д.":"",
        "улица":"", "ул.":"", "проспект":"", "пр-т":"",
        "шоссе":"", "пер.":"", "переулок":"",
    }
    for a,b in replacements.items():
        s = s.replace(a,b)
    s = re.sub(r"[^a-zа-я0-9]+", "", s)
    return s

def house_token(s):
    # Extract the first building-like token, e.g. 26с2, 5с1, 160, 11.
    t = str(s or "").lower().replace("ё","е")
    t = t.replace("строение","с").replace("стр.","с").replace("корпус","к").replace("корп.","к")
    m = re.search(r"(?<!\d)(\d+[а-яa-z]?(?:\s*[ск]\s*\d+[а-яa-z]?)?)", t, re.I)
    if not m:
        return ""
    return re.sub(r"\s+","",m.group(1))

def street_anchor(s):
    t = str(s or "").lower().replace("ё","е")
    # Prefer a long Cyrillic street-name token before generic words/numbers.
    words = re.findall(r"[а-яa-z]{5,}", t, re.I)
    stop = {"россия","москва","область","город","улица","проспект","шоссе","переулок","строение","корпус","этаж","торговый","центр"}
    for w in words:
        if w not in stop:
            return w
    return ""

def address_match(source, matched):
    if not source or not matched:
        return False
    src_norm, mat_norm = normalize_addr(source), normalize_addr(matched)
    h = house_token(source)
    if h and normalize_addr(h) not in mat_norm:
        return False
    anchor = street_anchor(source)
    if anchor and normalize_addr(anchor) not in mat_norm:
        return False
    # If neither useful token exists, don't claim high confidence.
    return bool(h or anchor)

def query_variants(club):
    vals = []
    for raw in (club.get("address"), club.get("address_alternative")):
        a = clean_address(raw)
        if not a:
            continue
        vals += [f"{a}, Москва, Россия", f"Москва, {a}"]
        simple = re.sub(r",?\s*(?:ТЦ|ТРК)\s+[^,]+", "", a, flags=re.I)
        simple = re.sub(r",?\s*\d+\s*этаж.*$", "", simple, flags=re.I).strip(" ,")
        if simple and simple != a:
            vals.append(f"{simple}, Москва, Россия")
    out = []
    for v in vals:
        if v not in out:
            out.append(v)
    return out

def nominatim(q, source_address):
    params = {
        "format":"jsonv2","limit":"5","countrycodes":"ru","addressdetails":"1",
        "bounded":"1","viewbox":f"{MIN_LNG},{MAX_LAT},{MAX_LNG},{MIN_LAT}","q":q,
    }
    try:
        rows = fetch_json("https://nominatim.openstreetmap.org/search?" + urlencode(params))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        rows = []
    time.sleep(1.05)
    for row in rows if isinstance(rows,list) else []:
        lat,lng = row.get("lat"),row.get("lon")
        if not valid(lat,lng):
            continue
        typ = str(row.get("type") or "")
        addrt = str(row.get("addresstype") or "")
        matched = str(row.get("display_name") or "")
        address_level = typ in {"house","building","apartments","commercial","yes"} or addrt in {"house","building","amenity"}
        confidence = "high" if address_level and address_match(source_address, matched) else "medium"
        return float(lat),float(lng),"nominatim",confidence,matched
    return None

def arcgis(q, source_address):
    params = {
        "SingleLine":q,"f":"json","maxLocations":"5","countryCode":"RUS",
        "outFields":"Match_addr,Addr_type,City,District,Region",
        "searchExtent":f"{MIN_LNG},{MIN_LAT},{MAX_LNG},{MAX_LAT}",
    }
    try:
        d = fetch_json("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?" + urlencode(params))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        d = {}
    time.sleep(0.25)
    for row in (d.get("candidates") or []) if isinstance(d,dict) else []:
        loc=row.get("location") or {}
        lat,lng=loc.get("y"),loc.get("x")
        score=float(row.get("score") or 0)
        if score < 82 or not valid(lat,lng):
            continue
        attrs=row.get("attributes") or {}
        addr_type=str(attrs.get("Addr_type") or "")
        matched=str(attrs.get("Match_addr") or row.get("address") or "")
        high = score >= 95 and addr_type in {"PointAddress","StreetAddress","Subaddress"} and address_match(source_address, matched)
        return float(lat),float(lng),"arcgis",("high" if high else "medium"),matched
    return None

def photon(q, source_address):
    params={"q":q,"limit":"5","lat":"55.7558","lon":"37.6173","lang":"ru"}
    try:
        d=fetch_json("https://photon.komoot.io/api/?" + urlencode(params))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        d={}
    time.sleep(0.35)
    for row in (d.get("features") or []) if isinstance(d,dict) else []:
        co=((row.get("geometry") or {}).get("coordinates") or [])
        if len(co)<2 or not valid(co[1],co[0]):
            continue
        props=row.get("properties") or {}
        matched=", ".join(str(props.get(k) or "") for k in ("name","street","housenumber","city") if props.get(k))
        high = bool(props.get("housenumber")) and address_match(source_address, matched)
        return float(co[1]),float(co[0]),"photon",("high" if high else "medium"),matched
    return None

def resolve(club):
    source_address = clean_address(club.get("address"))
    candidates = []
    for fn in (nominatim, arcgis, photon):
        for q in query_variants(club):
            r = fn(q, source_address)
            if r:
                candidates.append(r)
                if r[3] == "high":
                    return r
    return candidates[0] if candidates else None

def unique_output_id(source_id, address, seen):
    sid=source_id or "club"
    if sid not in seen:
        seen.add(sid); return sid
    suffix=hashlib.sha1(str(address).encode("utf-8")).hexdigest()[:7]
    out=f"{sid}--{suffix}"
    n=2
    while out in seen:
        out=f"{sid}--{suffix}-{n}"; n+=1
    seen.add(out); return out

def comparable(payload):
    if not isinstance(payload,dict):
        return {}
    return {k:v for k,v in payload.items() if k not in {"generated_at","note"}}

def main():
    src=read_json(SOURCE,{})
    clubs=src.get("clubs") or []
    if len(clubs)<50:
        raise SystemExit(f"Refusing map rebuild: only {len(clubs)} source clubs")

    overrides_payload=read_json(OVERRIDES,{})
    overrides={}
    for row in overrides_payload.get("clubs") or []:
        sid=str(row.get("source_id") or "").strip()
        if sid and valid(row.get("lat"),row.get("lng")):
            overrides[sid]=row

    old=read_json(OUTPUT,{})
    old_by_source_addr={}
    for row in old.get("clubs") or []:
        # Keep only previously verified/high coordinates. Never preserve medium/cached-unknown.
        conf=str(row.get("confidence") or "")
        status=str(row.get("status") or "")
        sid=str(row.get("source_id") or row.get("id") or "")
        addr=str(row.get("address") or "")
        if sid and valid(row.get("lat"),row.get("lng")) and (conf in {"verified","high"} or status=="verified_manual"):
            old_by_source_addr[(sid,addr)]=row

    resolved,review,unresolved,seen_ids=[],[],[],set()

    for i,club in enumerate(clubs,1):
        source_id=str(club.get("id") or "").strip()
        name=str(club.get("name") or "").strip()
        address=str(club.get("address") or "").strip()
        out_id=unique_output_id(source_id,address,seen_ids)

        base={
            "id":out_id,"source_id":source_id,"name":name,"address":address,
        }

        if not source_id or not address:
            unresolved.append({**base,"lat":None,"lng":None,"status":"missing_address_or_id"})
            continue

        manual=overrides.get(source_id)
        if manual:
            resolved.append({
                **base,"lat":float(manual["lat"]),"lng":float(manual["lng"]),
                "status":"verified_manual","confidence":"verified",
                "needs_manual_review":False,
            })
            print(f"[{i}/{len(clubs)}] verified {name}")
            continue

        cached=old_by_source_addr.get((source_id,address))
        if cached and not bool(club.get("needs_manual_review")):
            resolved.append({
                **base,"lat":float(cached["lat"]),"lng":float(cached["lng"]),
                "status":cached.get("status") or "geocoded_address",
                "provider":cached.get("provider"),"confidence":cached.get("confidence") or "high",
                "matched_address":cached.get("matched_address"),"needs_manual_review":False,
            })
            print(f"[{i}/{len(clubs)}] cached-high {name}")
            continue

        r=resolve(club)
        if not r:
            unresolved.append({**base,"lat":None,"lng":None,"status":"unresolved"})
            print(f"[{i}/{len(clubs)}] UNRESOLVED {name}",file=sys.stderr)
            continue

        lat,lng,provider,confidence,matched=r
        candidate={
            **base,"lat":lat,"lng":lng,"status":"geocoded_address",
            "provider":provider,"confidence":confidence,"matched_address":matched,
        }

        # STRICT PUBLISHING POLICY:
        # only high confidence + source not flagged for manual review goes to map.
        if confidence=="high" and not bool(club.get("needs_manual_review")):
            resolved.append({**candidate,"needs_manual_review":False})
            print(f"[{i}/{len(clubs)}] HIGH {provider} {name} -> {lat:.6f},{lng:.6f}")
        else:
            review.append({
                **candidate,"needs_manual_review":True,
                "review_reason":"source_flagged" if club.get("needs_manual_review") else "medium_confidence",
            })
            print(f"[{i}/{len(clubs)}] REVIEW {provider}/{confidence} {name}",file=sys.stderr)

    payload={
        "schema_version":4,"city":"Москва","build_status":"ready",
        "club_count":len(clubs),"resolved_count":len(resolved),
        "review_count":len(review),"unresolved_count":len(unresolved),
        "clubs":resolved,"needs_review":review,"unresolved":unresolved,
    }

    # Never let an automated rebuild silently shrink a previously good published map.
    old_count=int(old.get("resolved_count") or 0)
    old_ready=(old.get("build_status")=="ready")
    if old_ready and len(resolved)<old_count:
        raise SystemExit(f"Regression blocked: new {len(resolved)} < previous ready {old_count}")

    if comparable(old)==comparable(payload):
        print(f"No coordinate changes: {len(resolved)}/{len(clubs)}")
        return

    payload["generated_at"]=datetime.now(timezone.utc).isoformat(timespec="seconds")
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Updated static map: published={len(resolved)}/{len(clubs)}, review={len(review)}, unresolved={len(unresolved)}")

    if len(resolved)<5:
        raise SystemExit(f"Catastrophic result blocked: only {len(resolved)} published")

if __name__=="__main__":
    main()
