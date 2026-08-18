POKER SWIPE — FINAL MAP RELEASE

ЗАГРУЗИТЬ В GITHUB С СОХРАНЕНИЕМ ПАПОК:

polyana/map.html
polyana/build_map_coords.py
polyana/club_coords.json
polyana/verified_overrides.json
.github/workflows/polyana-map-coords.yml

НЕ ЗАМЕНЯТЬ .github/workflows/polyana-sync.yml.
Карта теперь имеет СВОЙ отдельный workflow.

ПОСЛЕ ЗАГРУЗКИ:
GitHub -> Actions -> Build Polyana map coordinates.
Первый запуск должен стартовать автоматически, потому что изменены builder/workflow.
Дождаться зелёной галочки перед проверкой карты.

Что исправлено:
- НЕТ геокодирования на телефоне пользователя.
- НЕТ поэтапной загрузки 5 -> 20 -> 40 точек.
- На карту публикуются только manual verified / high-confidence координаты.
- Medium-confidence и source needs_manual_review идут в needs_review, а не на карту.
- Старые medium/cached-unknown координаты не наследуются.
- Автоматический rebuild не может уменьшить уже готовую карту.
- Координаты строятся отдельно от 15-минутного обновления афиши.
- Workflow запускается вручную или при изменении каталога/карты, не каждые 15 минут.
- У карты есть 4.5s timeout загрузки JSON.
- Есть last-known-good cache: плохой/неполный новый JSON не уменьшит количество точек у пользователя.
- HTTP cache разрешён через cache:no-cache, вместо принудительного no-store.
- full-width iframe, fit-to-all, drag, wheel zoom, pinch-to-zoom сохранены.
- Уникальные id защищены даже при 3+ дублях.

ВАЖНО:
В ZIP стартовый club_coords.json содержит только 5 уже вручную проверенных точек.
Полный набор verified/high точек создаёт GitHub Action после загрузки.
Пока Action не завершился, не считать карту готовой.
