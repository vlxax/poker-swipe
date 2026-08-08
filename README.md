# Poker Swipe V14 — РЕНТГЕН

Рабочая GitHub Pages сборка.

## Главное изменение
Третья кнопка нижнего меню:
`PLAY · МОИ · РЕНТГЕН · YOU`

Старый REG BATTLE убран из пользовательского пути и заменён самостоятельным режимом Range Reading.

### РЕНТГЕН
- живой 13×13 range grid;
- пользователь сам сужает диапазон по улицам;
- range funnel preflop → flop → turn → river;
- отдельное value/bluff вскрытие;
- blocker scan на Hero cards;
- Range Report;
- история результатов в localStorage;
- статистика Рентгена появляется в YOU;
- share-result через Web Share API / clipboard.

Reference-модели внутри режима — учебные базовые модели, а не заявленные solver frequencies.

## Проверка публикации
После загрузки в корень GitHub репозитория справа сверху должен быть бейдж:
`V14 · РЕНТГЕН`

Если его нет — GitHub Pages показывает старый index.html.
