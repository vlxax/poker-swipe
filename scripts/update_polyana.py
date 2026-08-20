#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://pokernomoney.ru"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

MOSCOW_TZ = timezone(timedelta(hours=3))

S = requests.Session()
S.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; PokerSwipeSync/3.0; +https://github.com/vlxax/poker-swipe)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml",
})

TOURNAMENT_RE = re.compile(r"/tournaments/\d+")
TIME_RE = re.compile(r"\b([01]\d|2[0-3]):([0-5]\d)\b")
LATE_RE = re.compile(r"вход\s+до\s+(\d{1,2}):(\d{2})", re.I)
MONEY_RE = re.compile(r"(?<!\d)(\d[\d\s]{0,8})\s*₽", re.I)

# These are display/category labels that appear before the actual event name
# in the homepage card. Only the leading label is removed; the event title itself
# is preserved exactly as printed on the homepage.
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


def fee_from_card(text: str) -> int:
    if re.search(r"\bбесплатно\b", text, re.I):
        return 0
    m = MONEY_RE.search(text)
    return int(re.sub(r"\D", "", m.group(1))) if m else 0


def late_from_card(text: str, start: str):
    m = LATE_RE.search(text)
    if not m:
        return None, None
    raw = f"{int(m.group(1)):02d}:{m.group(2)}"
    # Preserve the source value even if the source itself contains an invalid clock.
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
    """
    The homepage has a compact duplicate for every tournament:
      19:00Pocket Rockets Club♠
      18:00Ace Poker ClubFREE♠
    This gives us the club name without guessing from addresses or club pages.
    """
    t = clean(text)
    m = re.match(r"^([01]\d|2[0-3]):([0-5]\d)(.+?)\s*(FREE)?\s*♠$", t, re.I)
    if not m:
        return "", ""
    return f"{m.group(1)}:{m.group(2)}", clean(m.group(3))


def discover_homepage_cards(html: str):
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
        # Unique variants: the short top ticker + the rich "Турниры сегодня" card.
        variants = sorted(set(texts), key=len)
        short = variants[0]
        full = variants[-1]

        start, club = compact_club(short)
        if not club:
            # If markup changes, search all variants for one matching the compact form.
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

    # The homepage order is meaningful. Sort by time only as a deterministic fallback;
    # display code later sorts by time anyway.
    return cards


def parse_homepage_card(card: dict, today: str):
    full = clean(card["full"])
    start = card.get("time") or ""
    club = clean(card.get("club"))

    if not start:
        m = TIME_RE.search(full)
        start = m.group(0) if m else ""
    if not start or not club:
        raise ValueError("compact_card_missing_time_or_club")

    # Find the club occurrence after the start/fee portion. Use the last occurrence
    # because an event title can theoretically contain the club name.
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
        # If source card consists only of a category label, preserve it as title.
        title = format_label or "Турнир клуба"

    fee = fee_from_card(meta_area)
    late_until, late_minutes = late_from_card(meta_area, start)

    return {
        "date": today,
        "time": start,
        "club": club,
        "tournament": title,
        "fee_rub": fee,
        "type": format_label,
        "source_url": card["url"],
        "address": address or None,
        "late_reg_until": late_until,
        "late_reg_minutes": late_minutes,
        "reentry_limit": None,
        "reentry_cost_rub": None,
        "duration_minutes": None,
        # Exact source snapshot for debugging and 1:1 comparison.
        "source_card_text": full,
    }


def read_existing_club_catalog():
    """
    Preserve richer club metadata already collected elsewhere.
    Today's schedule itself NEVER depends on these files.
    """
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


def main():
    now = datetime.now(timezone.utc).astimezone(MOSCOW_TZ)
    today = now.strftime("%Y-%m-%d")

    html = get(BASE + "/")
    cards = discover_homepage_cards(html)

    # Source truth = unique tournament links on the Moscow homepage.
    source_count = len(cards)
    if source_count < 20:
        raise RuntimeError(f"Homepage exposed only {source_count} tournament links; refusing overwrite")

    events = []
    failures = []
    for card in cards:
        try:
            events.append(parse_homepage_card(card, today))
        except Exception as exc:
            failures.append({
                "url": card.get("url"),
                "error": str(exc),
                "variants": card.get("variants"),
            })

    # HARD 1:1 GUARANTEE:
    # if even one homepage tournament could not be represented, publish nothing.
    if failures or len(events) != source_count:
        raise RuntimeError(
            f"Homepage mismatch: source={source_count}, parsed={len(events)}, "
            f"failures={len(failures)}; refusing overwrite"
        )

    # Every URL must remain unique so simultaneous events in one club never collapse.
    urls = [e["source_url"] for e in events]
    if len(set(urls)) != len(urls):
        raise RuntimeError("Duplicate tournament URL detected; refusing overwrite")

    events.sort(key=lambda e: (e["time"], e["club"].lower(), e["source_url"]))

    # Enrich the existing club catalogue with the exact addresses seen today.
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
            }
            clubs.append(c)
            by_name[key] = c
        elif e.get("address"):
            # Homepage wins for today's displayed address.
            c["address"] = e["address"]

    for c in clubs:
        c["schedule"] = [e for e in events if norm(e["club"]) == norm(c.get("name"))]
        c["upcoming"] = len(c["schedule"])

    clubs.sort(key=lambda c: clean(c.get("name")).lower())
    updated_at = now.isoformat(timespec="seconds")

    today_payload = {
        "source": BASE + "/",
        "updated_at": updated_at,
        "date": today,
        "city": "Москва",
        "source_card_count": source_count,
        "parsed_event_count": len(events),
        "exact_homepage_match": True,
        "events": events,
    }

    live_payload = {
        "source": BASE + "/",
        "updated_at": updated_at,
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
            "retrieved_at": updated_at,
            "city": "Москва",
            "count": len(clubs),
            "clubs": clubs,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Polyana exact homepage sync OK: "
        f"source={source_count}, parsed={len(events)}, failures=0"
    )


if __name__ == "__main__":
    main()
