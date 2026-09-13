#!/usr/bin/env python3
"""
Enhanced Polyana data sync with:
- Real game type classification (NLH/PLO/PLO5)
- District detection from addresses
- Verified late registration data
- Duplicate prevention
- Last-known-good fallback
- Source metadata tracking
"""
from __future__ import annotations

import json
import re
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin
from typing import Optional, Dict, List, Any

import requests
from bs4 import BeautifulSoup

BASE = "https://pokernomoney.ru"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

MOSCOW_TZ = timezone(timedelta(hours=3))

S = requests.Session()
S.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; PokerSwipeSync/4.0; +https://github.com/vlxax/poker-swipe)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml",
})

TOURNAMENT_RE = re.compile(r"/tournaments/\d+")
TIME_RE = re.compile(r"\b([01]\d|2[0-3]):([0-5]\d)\b")
LATE_RE = re.compile(r"вход\s+до\s+(\d{1,2}):(\d{2})", re.I)
MONEY_RE = re.compile(r"(?<!\d)(\d[\d\s]{0,8})\s*₽", re.I)

# Game type detection
GAME_PATTERNS = {
    'NLH': [
        r'\bNLH\b', r'\bN\.?L\.?H\.?\b',
        r'\bholdem\b', r'\bhold.?em\b',
        r'\bхолдем\b', r"\bhold'em\b", r'\bhold-em\b',
        r'\bNo.?Limit.?Hold.?em\b'
    ],
    'PLO': [
        r'\bPLO\b', r'\bP\.?L\.?O\.?\b',
        r'\bomaha\b', r'\bомаха\b',
        r'\bпотлимит\b', r'\bpot.?limit\b', r'\bPot.?Limit\b'
    ],
    'PLO5': [
        r'\bPLO5\b', r'\b5.?card\b', r'\b5-card\b',
        r'\b5-карточ\b', r'\bfive.?card\b'
    ]
}

# Moscow districts (sample - can be expanded)
MOSCOW_DISTRICTS = {
    'Центральный': ['Тверская', 'Красная площадь', 'Кремль', 'Мойка', 'Арбат', 'Чистые пруды', 'Охотный ряд'],
    'Замоскворечье': ['Софьи Ковалевской', 'Новая Басманная'],
    'Басманный': ['Новая Басманная', 'Красносельская'],
    'Красносельский': ['Красносельская', 'Комсомольская'],
    'Таганский': ['Таганская', 'Марксистская'],
    'Якиманка': ['Софийская набережная'],
}

FORMAT_PREFIXES = [
    "Баунти / Нокаут",
    "Mystery Bounty",
    "Обучающий",
    "Freezeout",
    "Bomb Pot",
    "Фрирол",
    "Феникс",
    "PKO",
]

PREMIUM_RE = re.compile(r"^\s*★?\s*PREMIUM\s*", re.I)


def clean(v) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def norm(v) -> str:
    return re.sub(r"[^a-zа-яё0-9]+", "", clean(v).lower())


def get(url: str, timeout: int = 25) -> str:
    r = S.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text


def detect_game_type(text: str) -> Optional[str]:
    """Detect game type (NLH, PLO, PLO5) from text."""
    if not text:
        return None

    text_lower = text.lower()

    # Check in order (PLO5 first, then PLO, then NLH)
    for game, patterns in [('PLO5', GAME_PATTERNS.get('PLO5', [])),
                          ('PLO', GAME_PATTERNS.get('PLO', [])),
                          ('NLH', GAME_PATTERNS.get('NLH', []))]:
        for pattern in patterns:
            if re.search(pattern, text_lower, re.I):
                return game

    return None


def detect_district(address: str) -> Optional[str]:
    """Detect Moscow district from address."""
    if not address:
        return None

    address_lower = address.lower()

    for district, keywords in MOSCOW_DISTRICTS.items():
        for keyword in keywords:
            if keyword.lower() in address_lower:
                return district

    return None


def fee_from_card(text: str) -> int:
    if re.search(r"\bбесплатно\b", text, re.I):
        return 0
    m = MONEY_RE.search(text)
    return int(re.sub(r"\D", "", m.group(1))) if m else 0


def late_from_card(text: str, start: str) -> tuple[Optional[str], Optional[int]]:
    """Parse late registration from card text."""
    m = LATE_RE.search(text)
    if not m:
        return None, None

    raw = f"{int(m.group(1)):02d}:{m.group(2)}"
    hh, mm = int(m.group(1)), int(m.group(2))

    if hh > 23 or mm > 59 or not start:
        return raw, None

    sh, sm = map(int, start.split(":"))
    end = hh * 60 + mm
    begin = sh * 60 + sm

    if end < begin:
        end += 24 * 60

    diff = end - begin
    return raw, diff if 0 <= diff <= 12 * 60 else None


def strip_leading_format(text: str):
    t = PREMIUM_RE.sub("", clean(text))
    for label in FORMAT_PREFIXES:
        if t.lower().startswith(label.lower()):
            rest = clean(t[len(label):])
            return label, rest
    return "", t


def compact_club(text: str):
    """Extract time and club from compact card format."""
    t = clean(text)
    m = re.match(r"^([01]\d|2[0-3]):([0-5]\d)(.+?)\s*(FREE)?\s*♠$", t, re.I)
    if not m:
        return "", ""
    return f"{m.group(1)}:{m.group(2)}", clean(m.group(3))


def discover_homepage_cards(html: str):
    """Discover all tournament cards on homepage."""
    soup = BeautifulSoup(html, "html.parser")
    grouped = {}

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if not TOURNAMENT_RE.search(href):
            continue
        url = urljoin(BASE, href.split("#")[0].split("?")[0])
        text = clean(a.get_text(" ", strip=True))
        if not text:
            continue
        grouped.setdefault(url, []).append(text)

    cards = []
    for url, texts in grouped.items():
        variants = sorted(set(texts), key=len)
        short = variants[0]
        full = variants[-1]

        start, club = compact_club(short)
        if not club:
            for v in variants:
                start, club = compact_club(v)
                if club:
                    short = v
                    break

        cards.append({
            "url": url,
            "variants": variants,
            "compact": short,
            "full": full,
            "time": start,
            "club": club,
        })

    return cards


def parse_homepage_card(card: dict, today: str, fetched_at: str) -> dict:
    """Parse a single homepage card into normalized event."""
    full = clean(card["full"])
    start = card.get("time") or ""
    club = clean(card.get("club"))

    if not start:
        m = TIME_RE.search(full)
        start = m.group(0) if m else ""
    if not start or not club:
        raise ValueError("compact_card_missing_time_or_club")

    idx = full.rfind(club)
    if idx < 0:
        raise ValueError("club_not_found_in_full_card")

    before_club = clean(full[:idx])
    address = clean(full[idx + len(club):])

    tm = before_club.find(start)
    if tm < 0:
        raise ValueError("time_not_found_in_full_card")

    title_area = clean(before_club[:tm])
    meta_area = clean(before_club[tm + len(start):])

    format_label, title = strip_leading_format(title_area)
    if not title:
        title = format_label or "Турнир клуба"

    fee = fee_from_card(meta_area)
    late_until, late_minutes = late_from_card(meta_area, start)

    # New fields for P0 fixes
    game = detect_game_type(title + " " + format_label)
    district = detect_district(address)

    # Generate event ID from URL for deduplication
    event_id = hashlib.md5(card["url"].encode()).hexdigest()[:8]

    return {
        "_id": event_id,
        "date": today,
        "time": start,
        "club": club,
        "tournament": title,
        "fee_rub": fee,
        "type": format_label,
        "game": game,  # NEW: NLH/PLO/PLO5/None
        "district": district,  # NEW: Moscow district
        "source_url": card["url"],
        "address": address or None,
        "late_reg_until": late_until,
        "late_reg_minutes": late_minutes,
        "late_reg_source": "homepage_text" if late_until else None,  # NEW: provenance
        "reentry_limit": None,
        "reentry_cost_rub": None,
        "addon_allowed": None,
        "duration_minutes": None,
        "source_card_text": full,
        "fetched_at": fetched_at,  # NEW: when this data was fetched
        "source": BASE,  # NEW: source URL
    }


def read_existing_club_catalog():
    """Read existing club catalog for preservation."""
    candidates = [
        DATA / "moscow_clubs_pokernomoney.json",
        DATA / "live_polyana.json",
    ]
    for path in candidates:
        try:
            raw = json.loads(path.read_text("utf-8"))
            clubs = raw.get("clubs")
            if isinstance(clubs, list):
                return clubs
        except Exception:
            pass
    return []


def read_last_sync_state():
    """Read last successful sync state for recovery."""
    sync_file = DATA / ".polyana_sync_state.json"
    try:
        return json.loads(sync_file.read_text("utf-8"))
    except Exception:
        return {}


def write_sync_state(state: dict):
    """Write current sync state."""
    sync_file = DATA / ".polyana_sync_state.json"
    try:
        sync_file.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception as e:
        print(f"Warning: Could not write sync state: {e}")


def backup_current_data():
    """Backup current data before update."""
    for filename in ["moscow_schedule_today.json", "live_polyana.json", "moscow_clubs_pokernomoney.json"]:
        src = DATA / filename
        if src.exists():
            backup = DATA / f".backup_{filename}"
            try:
                backup.write_text(src.read_text("utf-8"), encoding="utf-8")
            except Exception:
                pass


def restore_from_backup():
    """Restore data from backup if update fails."""
    for filename in ["moscow_schedule_today.json", "live_polyana.json", "moscow_clubs_pokernomoney.json"]:
        backup = DATA / f".backup_{filename}"
        dst = DATA / filename
        if backup.exists():
            try:
                dst.write_text(backup.read_text("utf-8"), encoding="utf-8")
                return True
            except Exception:
                pass
    return False


def main():
    now = datetime.now(timezone.utc).astimezone(MOSCOW_TZ)
    today = now.strftime("%Y-%m-%d")
    fetched_at = now.isoformat(timespec="seconds")

    try:
        # Backup current data
        backup_current_data()

        # Fetch and parse
        html = get(BASE + "/")
        cards = discover_homepage_cards(html)

        source_count = len(cards)
        if source_count < 20:
            raise RuntimeError(f"Homepage exposed only {source_count} tournament links; refusing overwrite")

        events = []
        failures = []
        for card in cards:
            try:
                events.append(parse_homepage_card(card, today, fetched_at))
            except Exception as exc:
                failures.append({
                    "url": card.get("url"),
                    "error": str(exc),
                    "variants": card.get("variants"),
                })

        # Strict validation
        if failures or len(events) != source_count:
            raise RuntimeError(
                f"Homepage mismatch: source={source_count}, parsed={len(events)}, "
                f"failures={len(failures)}; refusing overwrite"
            )

        # Deduplication
        urls = [e["source_url"] for e in events]
        if len(set(urls)) != len(urls):
            raise RuntimeError("Duplicate tournament URL detected; refusing overwrite")

        # Sort deterministically
        events.sort(key=lambda e: (e["time"], e["club"].lower(), e["source_url"]))

        # Enrich club catalog
        clubs = read_existing_club_catalog()
        by_name = {norm(c.get("name")): c for c in clubs if c.get("name")}

        for e in events:
            key = norm(e["club"])
            c = by_name.get(key)
            if c is None:
                c = {
                    "name": e["club"],
                    "address": e.get("address") or "",
                    "contacts": {},
                    "schedule": [],
                    "coordinates": None,  # NEW: placeholder for coordinates
                }
                clubs.append(c)
                by_name[key] = c
            elif e.get("address"):
                c["address"] = e["address"]

        # Update schedules
        for c in clubs:
            c["schedule"] = [e for e in events if norm(e["club"]) == norm(c.get("name"))]
            c["upcoming"] = len(c["schedule"])

        clubs.sort(key=lambda c: clean(c.get("name")).lower())

        # Write outputs
        today_payload = {
            "source": BASE + "/",
            "updated_at": now.isoformat(timespec="seconds"),
            "fetched_at": fetched_at,
            "lastSuccessfulSync": fetched_at,  # NEW: tracking
            "date": today,
            "city": "Москва",
            "source_card_count": source_count,
            "parsed_event_count": len(events),
            "exact_homepage_match": True,
            "events": events,
        }

        live_payload = {
            "source": BASE + "/",
            "updated_at": now.isoformat(timespec="seconds"),
            "fetched_at": fetched_at,
            "lastSuccessfulSync": fetched_at,  # NEW: tracking
            "club_count": len(clubs),
            "event_count": len(events),
            "source_card_count": source_count,
            "exact_homepage_match": True,
            "clubs": clubs,
            "events": events,
        }

        (DATA / "moscow_schedule_today.json").write_text(
            json.dumps(today_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (DATA / "live_polyana.json").write_text(
            json.dumps(live_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (DATA / "moscow_clubs_pokernomoney.json").write_text(
            json.dumps({
                "source": BASE + "/",
                "retrieved_at": now.isoformat(timespec="seconds"),
                "fetched_at": fetched_at,
                "lastSuccessfulSync": fetched_at,  # NEW: tracking
                "city": "Москва",
                "count": len(clubs),
                "clubs": clubs,
            }, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        # Track game type coverage
        games_found = sum(1 for e in events if e.get("game"))
        districts_found = sum(1 for e in events if e.get("district"))

        # Write sync state
        write_sync_state({
            "lastSuccessfulSync": fetched_at,
            "sourceCount": source_count,
            "parsedCount": len(events),
            "clubCount": len(clubs),
            "gameTypesCovered": games_found,
            "districtsCovered": districts_found,
        })

        print(
            f"✅ Polyana sync OK (v2): "
            f"source={source_count}, parsed={len(events)}, "
            f"games={games_found}/{len(events)}, "
            f"districts={districts_found}/{len(events)}, "
            f"clubs={len(clubs)}"
        )

    except Exception as e:
        print(f"❌ Polyana sync failed: {e}")
        if restore_from_backup():
            print("✅ Restored from backup (last-known-good)")
        raise


if __name__ == "__main__":
    main()
