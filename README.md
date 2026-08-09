# POKER SWIPE V25 — SMART DIAGNOSTIC + POKER INTELLIGENCE

## Новая стартовая диагностика
Старый тест 8/8 заменён на 12-spots assessment.

Проверяет отдельно:
- PREFLOP — RFI, BB defence, polar 3-bet, flat IP;
- POSTFLOP — dynamic boards и showdown-value discipline;
- SIZING — dry board small bet, turn value family, river thin value;
- DISCIPLINE — defence vs overbet, river bluff-catch, price defence.

Каждый ответ оценивается не бинарным answer-key, а через `PokerBrain.gradeDecision()`:
- частота выбранного действия относительно основной policy;
- попадание в size-family;
- source / confidence reference-node;
- policy score 0–100.

После каждого решения пользователь отдельно указывает confidence. Итог считает calibration и число «уверенно и мимо».

Результат:
- общий стартовый score;
- 4 независимых skill score;
- strongest / weakest dimension;
- 3 главные ошибки с выбранным действием, основной policy и объяснением;
- персональный следующий приоритет.

12 решений — baseline, а не вечный диагноз. После 20 реальных решений диагностические события перестают участвовать в текущем YOU score.

## Poker Intelligence V25
Добавлен compatibility layer `PokerBrainV25` / `GTOBrainV20`:
- существующий atlas и exact nodes доступны модулям разбора;
- hand class преобразуется в representative cards для поиска структурного node;
- source/confidence сохраняются;
- NO_MODEL возвращается честно, без выдуманной solver frequency.

ICM намеренно не оценивается в стартовом тесте: без полного payout + stack tree это не solver-grade задача.

## Existing V24
Турниры, исправленный Bounty, редактирование турниров, Push/Fold explanation, Home polish и Telegram layout сохранены.
