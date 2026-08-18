POLYANA MAP IFRAME PATCH

Заменить только:
1) polyana/polyana-integrated.js
2) добавить polyana/map.html

index.html НЕ трогать.

Почему это исправляет текущую ошибку:
- у production index.html строгий CSP, который блокирует OSM tiles/geocoding в основном документе;
- карта теперь живёт в same-origin iframe polyana/map.html;
- CSP родительского index.html не блокирует внешние tiles/fetch внутри отдельного документа карты;
- огромный index.html менять не нужно.

Что умеет карта:
- двигается мышью/пальцем;
- zoom + / −;
- кнопка "Москва" в Поляне отправляет reset в iframe;
- 5 проверочных точек появляются сразу:
  Minds, Joker Poker Club Moscow, PRIDE, Check-Check Club, HEADS UP;
- остальные клубы берутся из data/moscow_club_locations_source.json
  и постепенно геокодируются/кэшируются;
- кликом по точке открывается название и адрес клуба.

После загрузки этих двух файлов открой:
Поляна -> Карта.
