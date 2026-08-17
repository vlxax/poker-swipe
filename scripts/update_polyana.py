#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://pokernomoney.ru"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

S = requests.Session()
S.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; PokerSwipeSync/1.1; +https://github.com/vlxax/poker-swipe)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml",
})

MONTHS = {
    "янв": 1, "фев": 2, "мар": 3, "апр": 4, "май": 5, "мая": 5,
    "июн": 6, "июл": 7, "авг": 8, "сен": 9, "сент": 9,
    "окт": 10, "ноя": 11, "дек": 12,
}

KNOWN_CLUB_SLUGS = [
    "straddle","garage","spc","pride","minds","check","mask","jocker_m","pocket","river",
    "maximum","joker","face","aura","oceans","parliament","ducks","residence","nuts","doyle",
    "allin","level","friendly","quantum","raise","showdown","blackwood","prestig","ak77"
]

def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", s or "").strip()

def norm(s: str | None) -> str:
    return re.sub(r"[^a-zа-яё0-9]+", "", clean(s).lower())

def get(url: str, timeout: int = 25) -> str:
    r = S.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text

def money(s: str) -> int:
    m = re.search(r"(\d[\d\s]*)\s*₽", s or "")
    return int(m.group(1).replace(" ", "")) if m else 0

def normalize_date(raw: str, now: datetime) -> str:
    t = clean(raw).lower().replace(".", "")
    m = re.search(r"(\d{1,2})\s+([а-яё]{3,5})", t)
    if not m:
        return ""
    d = int(m.group(1))
    mon = MONTHS.get(m.group(2)[:3])
    if not mon:
        return ""
    year = now.year
    try:
        candidate = datetime(year, mon, d)
        if (candidate - now.replace(tzinfo=None)).days < -180:
            year += 1
    except Exception:
        return ""
    return f"{year:04d}-{mon:02d}-{d:02d}"

def find_after_label(lines, label):
    ll = label.lower()
    for i, x in enumerate(lines):
        if clean(x).lower() == ll and i + 1 < len(lines):
            return clean(lines[i + 1])
    return ""

def club_links_from_html(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    out = {}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "/club/c~" not in href:
            continue
        url = urljoin(BASE, href.split("#")[0])
        out.setdefault(url, clean(a.get_text(" ", strip=True)))
    return out

def fallback_club_links() -> dict[str, str]:
    return {f"{BASE}/club/c~{slug}": "" for slug in KNOWN_CLUB_SLUGS}

def extract_club_links() -> tuple[str, dict[str, str]]:
    candidates = [f"{BASE}/club", f"{BASE}/clubs"]
    best_url = candidates[0]
    best = {}
    for u in candidates:
        try:
            html = get(u)
            links = club_links_from_html(html)
            if len(links) > len(best):
                best_url, best = u, links
        except Exception:
            pass
    if len(best) < 10:
        best_url = f"{BASE}/club"
        best = fallback_club_links()
    return best_url, best

def meaningful_tournament(title: str | None, club: str) -> str | None:
    t = clean(title)
    if not t:
        return None
    if norm(t) == norm(club):
        return None
    bad = {
        "турнир", "расписаниетурниров", "сегодня", "завтра", "москва",
        "подробнее", "контактыиадрес", "связатьсясадминистратором"
    }
    if norm(t) in bad:
        return None
    return t

def parse_schedule(soup, name, url, now):
    result = []
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = [clean(x.get_text(" ", strip=True)) for x in tr.find_all(["td", "th"])]
            if len(cells) < 3:
                continue
            joined = " | ".join(cells)
            tm = re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", joined)
            dates = [normalize_date(c, now) for c in cells]
            date = next((d for d in dates if d), "")
            if not tm or not date:
                continue
            candidates = [
                c for c in cells if c and not normalize_date(c, now)
                and not re.fullmatch(r"\d{1,2}:\d{2}", c)
                and "₽" not in c
                and c.lower() not in {"дата","время","турнир","орг. взнос","оргвзнос"}
            ]
            tournament = next((meaningful_tournament(c, name) for c in reversed(candidates) if meaningful_tournament(c, name)), None)
            result.append({
                "date": date,
                "time": tm.group(0).zfill(5),
                "club": name,
                "tournament": tournament,
                "fee_rub": money(joined),
                "source_url": url,
            })

    if not result:
        lines = [clean(x) for x in soup.get_text("\n", strip=True).splitlines() if clean(x)]
        for i, line in enumerate(lines):
            date = normalize_date(line, now)
            if not date:
                continue
            window = lines[i:i+12]
            tm = next((re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", x) for x in window if re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", x)), None)
            if not tm:
                continue
            candidates = [
                x for x in window[1:]
                if not normalize_date(x, now)
                and not re.search(r"\b\d{1,2}:\d{2}\b", x)
                and "₽" not in x
                and len(x) > 3
                and "PokerNoMoney" not in x
            ]
            tournament = next((meaningful_tournament(c, name) for c in candidates if meaningful_tournament(c, name)), None)
            result.append({
                "date": date,
                "time": tm.group(0).zfill(5),
                "club": name,
                "tournament": tournament,
                "fee_rub": next((money(x) for x in window if "₽" in x), 0),
                "source_url": url,
            })

    uniq = {}
    for e in result:
        key = (e["date"], e["time"], norm(e["club"]))
        old = uniq.get(key)
        if old is None:
            uniq[key] = e
            continue
        old_score = (2 if old.get("tournament") else 0) + (1 if old.get("fee_rub", 0) > 0 else 0)
        new_score = (2 if e.get("tournament") else 0) + (1 if e.get("fee_rub", 0) > 0 else 0)
        if new_score > old_score:
            uniq[key] = e
    return list(uniq.values())

def parse_club(url, hint, now):
    html = get(url)
    soup = BeautifulSoup(html, "html.parser")
    text = clean(soup.get_text(" ", strip=True))
    if "Клуб не найден" in text:
        raise RuntimeError("club_not_found")

    h1 = soup.find("h1")
    name = clean(h1.get_text(" ", strip=True) if h1 else hint) or hint or url.rsplit("c~", 1)[-1]
    lines = [clean(x) for x in soup.get_text("\n", strip=True).splitlines() if clean(x)]
    address = find_after_label(lines, "Адрес")
    age = find_after_label(lines, "Возраст клуба")

    venue = ""
    if h1:
        n = h1.find_next()
        for _ in range(12):
            if not n:
                break
            txt = clean(n.get_text(" ", strip=True)) if getattr(n, "get_text", None) else ""
            if txt and txt not in {name, "Контакты и адрес"} and len(txt) < 100:
                venue = txt
                break
            n = n.find_next()

    desc_parts = []
    for p in soup.find_all(["p", "div"]):
        txt = clean(p.get_text(" ", strip=True))
        if len(txt) >= 80 and "Вся представленная информация" not in txt and "Связаться с администратором" not in txt:
            desc_parts.append(txt)
    description = max(desc_parts, key=len, default="")
    if len(description) > 1600:
        description = description[:1597] + "…"

    contacts = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "t.me/" in href:
            contacts.setdefault("telegram", href)
        elif href.startswith("tel:"):
            contacts.setdefault("phone", href[4:])

    dlow = text.lower()
    def rx(pattern, cast=lambda x: x):
        m = re.search(pattern, dlow, re.I)
        return cast(m.group(1)) if m else None

    late_reg_hours = rx(r"поздн(?:яя|ей)\s+регистрац(?:ия|ии)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*час", lambda x: float(x.replace(",", ".")))
    late_reg_minutes = round(late_reg_hours * 60) if late_reg_hours is not None else None
    reentry_limit = rx(r"(?:не более|до)\s+(\d+)\s+раз", int)
    reentry_cost = rx(r"(?:ребай|re-?entry)[\s\S]{0,120}?стоимост[ьи]\s*[-:–—]?\s*(\d[\d\s]*)\s*руб", lambda x: int(x.replace(" ", "")))

    duration_minutes = None
    dm = re.search(r"турнир рассчитан на\s*(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*час", dlow, re.I)
    if dm:
        a = float(dm.group(1).replace(",", "."))
        b = float(dm.group(2).replace(",", "."))
        duration_minutes = round((a + b) / 2 * 60)

    facts = []
    for needle, label in [
        ("18+", "18+"), ("tda", "Правила TDA"), ("ребай", "Ребаи"),
        ("ре-энтри", "Re-entry"), ("поздн", "Поздняя регистрация"),
        ("обуч", "Обучение"), ("бесплат", "Есть бесплатный формат"),
        ("баунти", "Bounty"), ("омах", "Омаха"), ("mtt", "MTT")
    ]:
        if needle in dlow and label not in facts:
            facts.append(label)

    schedule = parse_schedule(soup, name, url, now)
    for e in schedule:
        e["address"] = address or None
        e["reentry_limit"] = reentry_limit
        e["reentry_cost_rub"] = reentry_cost
        e["late_reg_minutes"] = late_reg_minutes
        e["duration_minutes"] = duration_minutes

    fees = [e["fee_rub"] for e in schedule if e.get("fee_rub")]
    return {
        "name": name,
        "venue": venue,
        "address": address,
        "age": age,
        "description": description,
        "details": facts,
        "contacts": contacts,
        "source_url": url,
        "min_fee_rub": min(fees) if fees else 0,
        "reentry_limit": reentry_limit,
        "reentry_cost_rub": reentry_cost,
        "late_reg_minutes": late_reg_minutes,
        "duration_minutes": duration_minutes,
        "upcoming": len(schedule),
        "schedule": schedule,
    }

def main():
    now = datetime.now(timezone.utc)
    moscow_now = now.astimezone(timezone(timedelta(hours=3)))
    directory_url, links = extract_club_links()

    clubs, events, failures = [], [], []
    for url, hint in links.items():
        try:
            c = parse_club(url, hint, moscow_now)
            clubs.append(c)
            events.extend(c["schedule"])
        except Exception as e:
            failures.append({"url": url, "error": str(e)})
        time.sleep(0.05)

    if len(clubs) < 5:
        raise RuntimeError(f"Only {len(clubs)} clubs parsed; refusing overwrite")

    unique_events = {}
    for e in events:
        key = (e["date"], e["time"], norm(e["club"]))
        old = unique_events.get(key)
        if old is None:
            unique_events[key] = e
            continue
        old_score = (2 if old.get("tournament") else 0) + (1 if old.get("fee_rub", 0) > 0 else 0)
        new_score = (2 if e.get("tournament") else 0) + (1 if e.get("fee_rub", 0) > 0 else 0)
        if new_score > old_score:
            unique_events[key] = e
    events = list(unique_events.values())

    clubs.sort(key=lambda x: x["name"].lower())
    events.sort(key=lambda e: (e["date"], e["time"], e["club"].lower()))

    updated_at = moscow_now.isoformat(timespec="seconds")
    payload = {
        "source": directory_url,
        "updated_at": updated_at,
        "club_count": len(clubs),
        "event_count": len(events),
        "failures": failures,
        "clubs": clubs,
        "events": events,
    }

    (DATA / "live_polyana.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "moscow_clubs_pokernomoney.json").write_text(json.dumps({
        "source": directory_url,
        "retrieved_at": updated_at,
        "city": "Москва",
        "count": len(clubs),
        "clubs": clubs,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    today = moscow_now.strftime("%Y-%m-%d")
    today_events = [e for e in events if e["date"] == today]
    (DATA / "moscow_schedule_today.json").write_text(json.dumps({
        "source": directory_url,
        "updated_at": updated_at,
        "date": today,
        "city": "Москва",
        "events": today_events,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Updated Polyana: clubs={len(clubs)}, events={len(events)}, today={len(today_events)}, failures={len(failures)}")

if __name__ == "__main__":
    main()
