# POKER SWIPE V22.1 — TELEGRAM NATIVE LAYOUT

Исправлен слой отображения именно внутри Telegram Mini App.

Что исправлено:
- подключён официальный Telegram WebApp bridge;
- приложение вызывает ready() и expand();
- учитываются `viewportStableHeight`, `contentSafeAreaInset` и device safe area;
- верхний UI приложения больше не должен попадать под Telegram Close/Menu controls;
- нижняя навигация учитывает Telegram/iPhone safe bottom;
- контент каждого экрана получает реальный запас под нижнюю навигацию;
- swipe action bar до ответа остаётся доступным над навигацией;
- после ответа / открытия выбора размера action bar полностью убирается и больше не перекрывает GTO-разбор;
- verdict и size-result автоматически поднимаются в видимую область;
- модальные окна/card picker ограничены реальной стабильной высотой Telegram;
- исправлены min-width/grid проблемы на узких экранах;
- внутренний developer-текст про реализацию Brain скрыт от пользователя.

Сохранено:
- V22 «Разбор раздачи»;
- mobile card picker;
- cartoon avatars;
- V21.1 onboarding diagnostic fix;
- Poker Brain V20.

Для GitHub Pages загрузить рядом:
- index.html
- poker_brain_v20.js
