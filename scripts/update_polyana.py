#!/usr/bin/env python3
from __future__ import annotations
import json, re, sys, time
from datetime import datetime, timezone
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
    "User-Agent": "PokerSwipe/1.0 (+public schedule aggregator; contact via repository)",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
})

MONTHS = {
 "янв":1,"фев":2,"мар":3,"апр":4,"май":5,"мая":5,"июн":6,"июл":7,"авг":8,
 "сен":9,"сент":9,"окт":10,"ноя":11,"дек":12,
}

def get(url, timeout=25):
    r = S.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text

def clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip()

def money(s):
    m = re.search(r"(\d[\d\s]*)\s*₽", s or "")
    return int(m.group(1).replace(" ","")) if m else 0

def normalize_date(raw, now):
    t = clean(raw).lower().replace(".", "")
    # "вс, 7 июн" / "7 июн"
    m = re.search(r"(\d{1,2})\s+([а-яё]{3,5})", t)
    if not m: return ""
    d = int(m.group(1)); mon = MONTHS.get(m.group(2)[:3])
    if not mon: return ""
    year = now.year
    dt = datetime(year, mon, d)
    # If page is around new year and parsed date is far in past, assume next year.
    if (dt - now.replace(tzinfo=None)).days < -180:
        year += 1
    return f"{year:04d}-{mon:02d}-{d:02d}"

def parse_club_links(html):
    soup = BeautifulSoup(html, "html.parser")
    found = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/club/" in href or href.startswith("/club/c~"):
            url = urljoin(BASE, href)
            name = clean(a.get_text(" ", strip=True))
            if name and name.lower() not in {"подробнее","перейти","расписание"}:
                found[url] = name
    # fallback regex
    for href in re.findall(r'href=["\']([^"\']*?/club/c~[^"\']+)["\']', html, re.I):
        found.setdefault(urljoin(BASE, href), "")
    return found

def parse_club(url, hinted_name, now):
    html = get(url)
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    name = clean(h1.get_text(" ", strip=True) if h1 else hinted_name) or hinted_name or url.rsplit("/",1)[-1]
    text = soup.get_text("\n", strip=True)

    address = ""
    m = re.search(r"Адрес\s*\n+\s*([^\n]+)", text, re.I)
    if m: address = clean(m.group(1))

    # Parse schedule from tables first.
    events = []
    for table in soup.find_all("table"):
        headers = [clean(x.get_text(" ", strip=True)).lower() for x in table.find_all("th")]
        for tr in table.find_all("tr"):
            cells = [clean(x.get_text(" ", strip=True)) for x in tr.find_all(["td","th"])]
            if len(cells) < 3: continue
            joined = " | ".join(cells)
            time_m = re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", joined)
            date = ""
            for c in cells:
                date = normalize_date(c, now)
                if date: break
            if not date or not time_m: continue
            # heuristically choose tournament text: non-date, non-time, non-money, not header
            candidates = [c for c in cells if c and not normalize_date(c,now) and not re.fullmatch(r"\d{1,2}:\d{2}",c) and "₽" not in c]
            tournament = candidates[-1] if candidates else "Турнир"
            fee = money(joined)
            events.append({"date":date,"time":time_m.group(0).zfill(5),"club":name,"tournament":tournament,"fee_rub":fee,"source_url":url})

    # Fallback: page text blocks can still contain date/time/name/fee.
    if not events:
        lines = [clean(x) for x in text.splitlines() if clean(x)]
        for i,line in enumerate(lines):
            date = normalize_date(line, now)
            if not date: continue
            window = lines[i:i+8]
            tm = next((re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", x) for x in window if re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", x)), None)
            if not tm: continue
            fee = next((money(x) for x in window if "₽" in x), 0)
            tournament = next((x for x in window[1:] if x and not normalize_date(x,now) and not re.search(r"\b\d{1,2}:\d{2}\b",x) and "₽" not in x and len(x)>3), "Турнир")
            events.append({"date":date,"time":tm.group(0).zfill(5),"club":name,"tournament":tournament,"fee_rub":fee,"source_url":url})

    # Deduplicate
    uniq={}
    for e in events:
        uniq[(e["date"],e["time"],e["club"],e["tournament"])]=e
    events=list(uniq.values())

    fee_vals=[e["fee_rub"] for e in events if e["fee_rub"]]
    return {
        "name":name,
        "address":address,
        "source_url":url,
        "min_fee_rub": min(fee_vals) if fee_vals else 0,
        "upcoming":len(events),
        "events":events,
    }

def main():
    now = datetime.now(timezone.utc).astimezone()
    candidates = ["/club", "/clubs"]
    directory_html = None
    directory_url = None
    errors=[]
    for path in candidates:
        try:
            directory_html = get(BASE+path)
            directory_url = BASE+path
            if directory_html: break
        except Exception as e:
            errors.append(f"{path}: {e}")
    if not directory_html:
        raise RuntimeError("Could not fetch PokerNoMoney directory: " + "; ".join(errors))

    links = parse_club_links(directory_html)
    clubs=[]; all_events=[]; failures=[]
    for idx,(url,hint) in enumerate(links.items(),1):
        try:
            c=parse_club(url,hint,now)
            clubs.append({k:v for k,v in c.items() if k!="events"})
            all_events.extend(c["events"])
        except Exception as e:
            failures.append({"url":url,"error":str(e)})
        time.sleep(0.08)

    # If discovery was sparse, don't overwrite good existing data with garbage.
    if len(clubs) < 10:
        raise RuntimeError(f"Only {len(clubs)} club pages parsed; refusing to overwrite data")

    clubs.sort(key=lambda x:x["name"].lower())
    all_events.sort(key=lambda e:(e["date"],e["time"],e["club"].lower()))

    payload={
        "source":directory_url,
        "updated_at":now.isoformat(timespec="seconds"),
        "club_count":len(clubs),
        "event_count":len(all_events),
        "failures":failures,
        "clubs":clubs,
        "events":all_events,
    }
    (DATA/"live_polyana.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    (DATA/"moscow_clubs_pokernomoney.json").write_text(json.dumps({
        "source":directory_url,"retrieved_at":payload["updated_at"],"city":"Москва","count":len(clubs),"clubs":clubs
    },ensure_ascii=False,indent=2),encoding="utf-8")

    today=now.strftime("%Y-%m-%d")
    today_events=[e for e in all_events if e["date"]==today]
    (DATA/"moscow_schedule_today.json").write_text(json.dumps({
        "source":directory_url,"updated_at":payload["updated_at"],"date":today,"city":"Москва","events":today_events
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Updated: {len(clubs)} clubs, {len(all_events)} future events, {len(today_events)} today; failures={len(failures)}")

if __name__=="__main__":
    main()
