PokerSwipe — OTP + обязательный начальный тест
================================================

Заменить в GitHub только файл:

js/pokerswipe-auth-bootstrap.js

Новый цикл:
1. Email
2. Получить код
3. Ввести код в приложении
4. «Вход успешен»
5. ОБЯЗАТЕЛЬНЫЙ новый начальный тест
6. Экран результата теста
7. Главная PokerSwipe
8. При следующем запуске вход и тест повторно не запрашиваются

Что исправлено:
- старый локальный diagDone больше не пропускает новый тест;
- старый migrated_from_local профиль считается незавершённым onboarding;
- стартуется production assessment с force reset;
- после завершения production assessment onboarding_completed записывается в Supabase;
- migrated_from_local сбрасывается в false;
- следующий запуск уже ведёт на главную.

Supabase email template менять больше не нужно — {{ .Token }} уже настроен.
