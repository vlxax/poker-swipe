#!/usr/bin/env python3
from __future__ import annotations
import json, re, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE="https://pokernomoney.ru"
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"; DATA.mkdir(exist_ok=True)
S=requests.Session()
S.headers.update({
 "User-Agent":"PokerSwipe/1.0",
 "Accept-Language":"ru-RU,ru;q=0.9,en;q=0.7",
})
MONTHS={"янв":1,"фев":2,"мар":3,"апр":4,"май":5,"мая":5,"июн":6,"июл":7,"авг":8,"сен":9,"сент":9,"окт":10,"ноя":11,"дек":12}

def clean(s): return re.sub(r"\s+"," ",s or "").strip()
def get(url,timeout=25):
 r=S.get(url,timeout=timeout); r.raise_for_status(); return r.text
def money(s):
 m=re.search(r"(\d[\d\s]*)\s*₽",s or "")
 return int(m.group(1).replace(" ","")) if m else 0
def normalize_date(raw,now):
 t=clean(raw).lower().replace(".","")
 m=re.search(r"(\d{1,2})\s+([а-яё]{3,5})",t)
 if not m:return ""
 d=int(m.group(1)); mon=MONTHS.get(m.group(2)[:3])
 if not mon:return ""
 year=now.year
 try:
  candidate=datetime(year,mon,d)
  if (candidate-now.replace(tzinfo=None)).days < -180: year+=1
 except: return ""
 return f"{year:04d}-{mon:02d}-{d:02d}"

def find_after_label(lines,label):
 for i,x in enumerate(lines):
  if clean(x).lower()==label.lower() and i+1<len(lines): return clean(lines[i+1])
 return ""

def club_links(html):
 soup=BeautifulSoup(html,"html.parser"); out={}
 for a in soup.find_all("a",href=True):
  href=a["href"]
  if "/club/c~" not in href: continue
  url=urljoin(BASE,href)
  txt=clean(a.get_text(" ",strip=True))
  out.setdefault(url,txt)
 return out

def parse_schedule(soup,name,url,now):
 result=[]
 for table in soup.find_all("table"):
  for tr in table.find_all("tr"):
   cells=[clean(x.get_text(" ",strip=True)) for x in tr.find_all(["td","th"])]
   if len(cells)<3:continue
   joined=" | ".join(cells)
   tm=re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b",joined)
   date=next((normalize_date(c,now) for c in cells if normalize_date(c,now)),"")
   if not tm or not date:continue
   candidates=[c for c in cells if c and not normalize_date(c,now) and not re.fullmatch(r"\d{1,2}:\d{2}",c) and "₽" not in c and c.lower() not in {"дата","время","турнир","орг. взнос","оргвзнос"}]
   tournament=candidates[-1] if candidates else "Турнир"
   result.append({"date":date,"time":tm.group(0).zfill(5),"club":name,"tournament":tournament,"fee_rub":money(joined),"source_url":url})
 # fallback from visible text
 if not result:
  lines=[clean(x) for x in soup.get_text("\n",strip=True).splitlines() if clean(x)]
  for i,line in enumerate(lines):
   date=normalize_date(line,now)
   if not date:continue
   window=lines[i:i+10]
   tm=next((re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b",x) for x in window if re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b",x)),None)
   if not tm:continue
   candidates=[x for x in window[1:] if not normalize_date(x,now) and not re.search(r"\b\d{1,2}:\d{2}\b",x) and "₽" not in x and len(x)>3]
   result.append({"date":date,"time":tm.group(0).zfill(5),"club":name,"tournament":candidates[0] if candidates else "Турнир","fee_rub":next((money(x) for x in window if "₽" in x),0),"source_url":url})
 uniq={}
 for e in result: uniq[(e["date"],e["time"],e["tournament"])]=e
 return list(uniq.values())

def parse_club(url,hint,now):
 html=get(url); soup=BeautifulSoup(html,"html.parser")
 h1=soup.find("h1"); name=clean(h1.get_text(" ",strip=True) if h1 else hint) or hint
 lines=[clean(x) for x in soup.get_text("\n",strip=True).splitlines() if clean(x)]
 address=find_after_label(lines,"Адрес")
 age=find_after_label(lines,"Возраст клуба")

 # Venue is typically the compact line immediately after H1 and before "Контакты и адрес".
 venue=""
 if h1:
  n=h1.find_next()
  while n and getattr(n,"name",None):
   txt=clean(n.get_text(" ",strip=True))
   if txt and txt not in {name,"Контакты и адрес"}:
    if len(txt)<100: venue=txt
    break
   n=n.find_next()

 # Description: all meaningful paragraphs before tournament schedule.
 desc_parts=[]
 schedule_heading=soup.find(lambda tag:getattr(tag,"name",None) in ["h2","h3"] and "Расписание турниров" in clean(tag.get_text(" ",strip=True)))
 for p in soup.find_all(["p","div"]):
  if schedule_heading and p.sourceline and schedule_heading.sourceline and p.sourceline>=schedule_heading.sourceline: break
  txt=clean(p.get_text(" ",strip=True))
  if len(txt)>=80 and "Вся представленная информация" not in txt and "Связаться с администратором" not in txt:
   desc_parts.append(txt)
 description=max(desc_parts,key=len,default="")
 if len(description)>1600: description=description[:1597]+"…"

 # Telegram / phone / external links if present.
 contacts={}
 for a in soup.find_all("a",href=True):
  href=a["href"]; label=clean(a.get_text(" ",strip=True))
  if "t.me/" in href: contacts.setdefault("telegram",href)
  if href.startswith("tel:"): contacts.setdefault("phone",href[4:])
  if href.startswith("http") and "pokernomoney.ru" not in href and "t.me/" not in href:
   contacts.setdefault("website",href)

 schedule=parse_schedule(soup,name,url,now)
 fees=[e["fee_rub"] for e in schedule if e.get("fee_rub")]

 # Extract useful structured facts from description.
 facts=[]
 dlow=description.lower()
 checks=[
  ("18+","18+"),("tda","Правила TDA"),("ребай","Ребаи"),("ре-энтри","Re-entry"),
  ("поздн","Поздняя регистрация"),("обуч","Обучение"),("бесплат","Есть бесплатный формат"),
  ("баунти","Bounty"),("омах","Омаха"),("mtt","MTT")
 ]
 for needle,label in checks:
  if needle in dlow and label not in facts:facts.append(label)

 return {
  "name":name,"venue":venue,"address":address,"age":age,
  "description":description,"details":facts,"contacts":contacts,
  "source_url":url,"min_fee_rub":min(fees) if fees else 0,
  "upcoming":len(schedule),"schedule":schedule,
 }

def main():
 now=datetime.now(timezone.utc).astimezone()
 directory_url=BASE+"/club"
 directory=get(directory_url)
 links=club_links(directory)
 if len(links)<10:
  directory_url=BASE+"/clubs";directory=get(directory_url);links=club_links(directory)
 if len(links)<10: raise RuntimeError(f"Only {len(links)} club links found; refusing overwrite")

 clubs=[]; events=[]; failures=[]
 for url,hint in links.items():
  try:
   c=parse_club(url,hint,now);clubs.append(c);events.extend(c["schedule"])
  except Exception as e: failures.append({"url":url,"error":str(e)})
  time.sleep(.08)

 if len(clubs)<10: raise RuntimeError(f"Only {len(clubs)} clubs parsed; refusing overwrite")
 clubs.sort(key=lambda x:x["name"].lower())
 events.sort(key=lambda e:(e["date"],e["time"],e["club"].lower()))

 payload={
  "source":directory_url,"updated_at":now.isoformat(timespec="seconds"),
  "club_count":len(clubs),"event_count":len(events),"failures":failures,
  "clubs":clubs,"events":events
 }
 (DATA/"live_polyana.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
 (DATA/"moscow_clubs_pokernomoney.json").write_text(json.dumps({"source":directory_url,"retrieved_at":payload["updated_at"],"city":"Москва","count":len(clubs),"clubs":clubs},ensure_ascii=False,indent=2),encoding="utf-8")
 today=now.strftime("%Y-%m-%d")
 (DATA/"moscow_schedule_today.json").write_text(json.dumps({"source":directory_url,"updated_at":payload["updated_at"],"date":today,"city":"Москва","events":[e for e in events if e["date"]==today]},ensure_ascii=False,indent=2),encoding="utf-8")
 print(f"Updated rich club data: {len(clubs)} clubs, {len(events)} events, failures={len(failures)}")

if __name__=="__main__": main()
