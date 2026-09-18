# V12 QA REPORT

## Что исправлено поверх v11

- «Сегодня» теперь запускает реальную смешанную сессию до 20 вопросов, а не просто открывает слабый спот.
- Daily-сессия собирается из трёх корзин: прошлые ошибки, due-повторы и новые руки.
- В одной daily-сессии могут быть разные споты и два разных навыка: boundary и decision.
- Результаты daily-сессии сохраняются обратно по каждому spot × skill отдельно, поэтому mastery не смешивается.
- Добавлено сравнение UO не только стек → стек, но и позиция → позиция.
- Action diff сохранён: если рука остаётся в range, но меняет RAISE ↔ AI, это видно.
- Сохранены v11 fixes: отдельный boundary/decision mastery, correction retry не повышает mastery, unseen != due, semantic boundary, combo-aware build, heatmap.

## Automated QA

- trainer-core: 12/12 PASS
- JavaScript syntax: PASS for all ranges-ui JS files
- structured library: 1578 charts
- canonical matrix: 169 hands per structured chart
- source assets: 1578 embedded charts
- browser E2E: not claimed; iOS Safari/touch still requires deployed-device regression
