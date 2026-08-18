POLYANA MAP ONLY

Что внутри:
- polyana/polyana-integrated.js
- polyana/polyana-integrated.css
- data/moscow_club_locations_source.json
- data/moscow_clubs_pokernomoney.json

Важно:
Карта в текущей версии использует OpenStreetMap tiles и Photon/Nominatim для координат.
В index.html CSP должен разрешать:

img-src ... https://tile.openstreetmap.org;
connect-src ... https://photon.komoot.io https://nominatim.openstreetmap.org;

Сам блок карты уже ожидается внутри существующей Поляны как:
#pspMoscowMap

Это пакет только карты/данных, без всего PokerSwipe.
