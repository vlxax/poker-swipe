РАЗДЕЛ «ТЫ» — PokerSwipe

В архиве только рендер и стили профиля. Это часть существующего приложения, не самостоятельное приложение.

Интеграция:
1. Замените блок PLAYER DASHBOARD в poker_swipe_v39.js содержимым profile.js. Старый рендер профиля одновременно не подключайте.
2. Замените блок V38 — PLAYER DASHBOARD / YOU в poker_swipe_v39.css содержимым profile.css.
3. Остальные блоки этих файлов сохраните: они относятся к другим экранам.

Профиль использует существующие состояние S, функции show, formScore, disciplineScore, conceptLabel, topLeak, startConceptSwipe, openModal, exportPokerSwipe32 и контейнер #profileArea.
Проверен изолированный DOM-рендер. Полная интеграция и мобильная вёрстка в браузере ещё не проверены.
