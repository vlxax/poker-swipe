
import importlib.util
from pathlib import Path

p=Path("scripts/update_polyana.py")
spec=importlib.util.spec_from_file_location("sync",p)
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

cases=[
    (
      {"url":"https://pokernomoney.ru/tournaments/1","full":"★ PREMIUM Обучающий Обучение 18:00 Бесплатно вход до 22:00 Ace Poker Club улица Сергия Радонежского, 9с5","time":"18:00","club":"Ace Poker Club"},
      ("Обучение",0,"22:00","улица Сергия Радонежского, 9с5")
    ),
    (
      {"url":"https://pokernomoney.ru/tournaments/2","full":"Freezeout Freezeout Tournament 19:00 1 500 ₽ Pocket Rockets Club Шелепихинская наб., 34к2зд1","time":"19:00","club":"Pocket Rockets Club"},
      ("Freezeout Tournament",1500,None,"Шелепихинская наб., 34к2зд1")
    ),
    (
      {"url":"https://pokernomoney.ru/tournaments/3","full":"Mystery Bounty MYSTERY WOMAN DAY 20:00 1 500 ₽ вход до 23:00 Poker Room GTO Даев пер., д. 2","time":"20:00","club":"Poker Room GTO"},
      ("MYSTERY WOMAN DAY",1500,"23:00","Даев пер., д. 2")
    ),
]
for c,exp in cases:
    e=m.parse_homepage_card(c,"2026-08-19")
    got=(e["tournament"],e["fee_rub"],e["late_reg_until"],e["address"])
    assert got==exp,(got,exp)
print("homepage card parser regression: OK")
