# CURSOR TASK — Sprint 4.13 UI integration

Не переписывать poker engine. Подключить существующие методы controller:

- `getTransferLearningState()` — показать карточку «Перенос навыка» с generalizationScore и количеством transfer attempts.
- `getTransferProbeRecommendation()` — показать, какой принцип приложение хочет проверить в новом контексте.
- `startTransferSession({length})` — кнопка «Проверить, понял ли я принцип».

В пользовательском UI не показывать conceptKey/contextKey/sourceCell. Использовать обычный русский покерный язык. Если generalizationScore отсутствует, текст: «Сначала нужно закрепить несколько принципов, потом проверим перенос».
