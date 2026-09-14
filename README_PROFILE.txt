PokerSwipe — интеграция ТЫ / ПРОФИЛЬ
====================================

Файлы:
- profile.js — единственный владелец window.renderProfile
- profile.css — стили экрана профиля

Подключение (index.html):
- profile.css и profile.js загружаются последними в <body>, после poker_swipe_v39.js

Удалено из активного пути:
- блок PLAYER DASHBOARD (v38) в poker_swipe_v39.js
- обёртка renderProfile в poker_swipe_v32.js (инструменты перенесены в profile.js)

Состояние:
- window.S / PokerSwipeCore.store.getState()
- События: mode !== 'diagnostic', !excludeFromProfile
