# POKER SWIPE — V12 VISUAL CLEAN

ЭТО ПРОВЕРОЧНАЯ СБОРКА.

После публикации на GitHub Pages на каждой странице в правом верхнем углу должен быть ярко-розовый бейдж:

`V12 VISUAL`

Если бейджа нет — GitHub Pages всё ещё отдаёт старый `index.html`.

В корне архива лежит новый `index.html`; ZIP не нужно загружать как ZIP-файл в репозиторий — его нужно распаковать и заменить корневой `index.html`.

# Poker Swipe PRO REG V12 — Visual Interaction Build

Это уже НЕ дизайн-спека. Изменения встроены прямо в `index.html`.

Что визуально изменено:
- Sizing: физический chip-slider, банк и ставка в BB/%.
- «Ну что опять не так?»: CSI/timeline конкретных действий.
- Daily: отдельная кинематографичная сцена «одна раздача дня».
- Лечить: Poker Lab с маршрутом разных микроигр.
- Мои: отдельный визуальный poker-desk / hand lab.
- REG BATTLE: PvE-стол с четырьмя архетипами.
- YOU: Poker DNA constellation.
- Poker Swipe не менялся.

Технически всё остаётся одним простым `index.html`, без внешнего game engine.


# POKER SWIPE V11 — PRO REG LAYER

Версия после полного аудита рега. Содержит быстрые смешанные сессии, расширенный Sizing, hand review, Daily, курс лечения, My Hands с честной математикой, PvE Battle и data-driven YOU.

Загрузите index.html в корень GitHub Pages. Данные сохраняются локально через localStorage. Для общей статистики поля, синхронизации и solver-backed аналитики нужен backend.
