# PokerSwipe Exploit Training — Sprint 4.5 GREEN

Готовый зелёный пакет движка Exploit Training с персонализацией и прогрессом.

Главное в 4.5:
- настройка соперника / улицы / сложности / длины;
- режим «Слабые места»;
- прогресс по четырём измерениям;
- сохранение статистики при пересоздании приложения;
- setup/progress/summary screen contracts;
- полный regression gate до Sprint 4.4.

Запуск:

```bash
npm run test:all
```

Интеграция в основной PokerSwipe описана в `CURSOR_TASK.md`.

## Sprint 4.13 — Transfer Learning / Generalization

Добавлен `exploit-transfer-learning.js`. PokerSwipe теперь различает первое изучение принципа, повтор знакомого контекста и перенос того же принципа в новый контекст. Controller поддерживает transfer probe sessions и сохраняет состояние в snapshot v5.
