# POKER SWIPE V15 — REG CORRECTIONS

Рабочая сборка с последним полным аудитом рега.

## Реализовано
- Daily: исправлен блок аргументов; настоящий pointer drag/drop + tap fallback; все аргументы обязательны; sizing slider после BET; confidence; 30-slot Daily pack.
- Poker Swipe: 10 рук без повторов, 64 варианта spots, тайминги 2.5/3.3/4.5 сек, tap-to-hold, sizing slider после postflop BET, отдельный verdict Action/Size, rich event log.
- Sizing: CHECK является полноценным решением; action и size оцениваются отдельно.
- Review: 6 кейсов, включая кейсы без ошибки; конкурентные причины; repair slider.
- Heal: персональный курс из YOU (River Bluff-catch / Sizing / BB Defence / Thin Value), 4 шага каждый.
- Quick 5: реальный оркестратор Swipe → Sizing → Review → X-Ray.
- My Hands: визуальный builder с seat picker, card picker, action log и рассчитанной pot geometry; удалены фиктивные pot bars.
- X-Ray: actual combo counts по hand classes, card removal по board/Hero, weighted range score; river нельзя закончить до классификации всех surviving groups.
- YOU: новый DNA icon, реальные sample thresholds, FORM на последних 20 решениях, concept-level leaks, evidence, blind-spot confidence, персональный Heal CTA.
- Onboarding: обязательная 8-спотовая диагностика.
- Все reference-зоны маркируются как учебная базовая модель, не solver output.

## Что ещё требует Poker Brain
Точная GTO/EV оценка и solver frequencies намеренно не выдумываются. Для них нужен отдельный solver-backed Poker Brain из подготовленного архитектурного ТЗ.
