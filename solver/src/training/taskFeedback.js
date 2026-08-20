// Structured, task-specific Russian feedback for library drills.
// Uses per-task explain/history/context — not generic grade templates.

import { leakLabelRu } from './concepts.js';
import { skillLabelRu } from './skillProfile.js';

const STREET_RU = {
  preflop: 'префлопе', flop: 'флопе', turn: 'тёрне', river: 'ривере',
  ПРЕФЛОП: 'префлопе', ФЛОП: 'флопе', ТЁРН: 'тёрне', РИВЕР: 'ривере'
};

const VERDICT = {
  EXCELLENT: 'Отлично',
  GOOD: 'Хорошее решение',
  INACCURACY: 'Небольшая неточность',
  MISTAKE: 'Ошибка',
  'BIG MISTAKE': 'Большая ошибка'
};

function humanConcept(task) {
  const raw = task.concept || '';
  const mapped = leakLabelRu(raw);
  if (mapped && mapped !== raw) return mapped;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function villainLabel(task) {
  if (task.villain) return String(task.villain);
  if (task.opp && task.opp.name) return task.opp.name;
  return 'соперник';
}

function heroLabel(task) {
  return task.position || 'Hero';
}

function streetRu(task) {
  const s = task.street || '';
  return STREET_RU[s] || STREET_RU[String(s).toLowerCase()] || String(s).toLowerCase();
}

function contextLine(task) {
  const parts = [];
  if (task.format) parts.push(task.format);
  if (task.stage) parts.push(task.stage);
  if (task.table) parts.push(task.table);
  if (task.heroStack != null) parts.push(`стек ${task.heroStack} ББ`);
  return parts.join(' · ');
}

function actionRu(label) {
  const m = {
    ФОЛД: 'Фолд', КОЛЛ: 'Колл', ЧЕК: 'Чек', РЕЙЗ: 'Рейз', '3-БЕТ': '3-бет', '4-БЕТ': '4-бет',
    'ОЛЛ-ИН': 'Олл-ин', СТАВКА: 'Ставка'
  };
  return m[label] || label;
}

function buildWhy(task, recommendedLabel) {
  if (task.explain) return task.explain;
  const v = villainLabel(task);
  const h = heroLabel(task);
  return `В этой раздаче (${contextLine(task)}) на ${streetRu(task)} оптимальная линия для ${h} — ${actionRu(recommendedLabel)} против ${v}.`;
}

function buildUserMistake(task, chosenLabel, recommendedLabel, grade) {
  if (grade === 'EXCELLENT' || grade === 'GOOD') {
    return `Ты выбрал ${actionRu(chosenLabel)} — это совпадает с лучшей линией в этой ситуации.`;
  }
  if (grade === 'INACCURACY') {
    return `${actionRu(chosenLabel)} близко к оптимуму, но ${actionRu(recommendedLabel)} чуть лучше по EV в этой конкретной раздаче.`;
  }
  return `${actionRu(chosenLabel)} здесь проигрывает ${actionRu(recommendedLabel)}: в этой линии (${streetRu(task)}, ${heroLabel(task)} vs ${villainLabel(task)}) ты теряешь EV.`;
}

function buildAlternative(task, chosenLabel, recommendedLabel) {
  const also = (task.alsoOk || []).filter((x) => x !== task.correct);
  if (also.includes(chosenLabel)) {
    return `${actionRu(chosenLabel)} — допустимая альтернатива, но ${actionRu(recommendedLabel)} предпочтительнее.`;
  }
  if (also.length) {
    return `Допустимые линии: ${also.map(actionRu).join(', ')}. Лучшая — ${actionRu(recommendedLabel)}.`;
  }
  return null;
}

function buildDetail(task, recommendedLabel, chosenLabel) {
  const v = villainLabel(task);
  const h = heroLabel(task);
  const board = (task.board || []).join(' ') || '—';
  const hero = (task.hero || []).join(' ') || '—';
  const pot = task.pot != null ? `${task.pot} ББ` : '—';
  const history = (task.history || []).map((x) => `${x.street}: ${x.text}`).join(' → ');
  return {
    heroRange: `Диапазон ${h}: смотри концепцию «${humanConcept(task)}» и позицию ${h}.`,
    villainRange: `Диапазон ${v}: ${task.opp && task.opp.style ? task.opp.style.toLowerCase() : 'стандартный рег'}.`,
    valueHands: recommendedLabel.includes('СТАВ') || recommendedLabel.includes('РЕЙЗ') || recommendedLabel.includes('ОЛЛ')
      ? 'Сильные руки и хорошие дро добирают ценность этой линией.'
      : 'Ценовые руки здесь чаще идут в чек/колл, а не в агрессию.',
    bluffHands: 'Блефы зависят от блокеров и частоты фолда соперника — смотри текстуру и размер.',
    folds: `Фолд выбивает слабые руки из диапазона ${v}, которые не реализуют equity.`,
    calls: `Колл удерживает руки с достаточным equity против линии ${v}.`,
    position: `${h} ${task.position === 'BB' || task.position === 'SB' ? 'вне позиции' : 'в позиции'} — это влияет на реализацию equity.`,
    stackDepth: task.heroStack != null ? `Эффективный стек ${task.heroStack} ББ меняет допустимые сайзы и диапазоны продолжения.` : null,
    potSizing: `Банк ${pot}. ${history || 'Линия раздачи задана в условиях.'}`,
    icm: /баббл|icm|itm|финальн|pko/i.test([task.stage, ...(task.tags || [])].join(' '))
      ? 'ICM давит на маржинальные коллы и пуши — учитывай призовую структуру.'
      : null,
    alternativeLine: chosenLabel !== recommendedLabel
      ? `Линия «${actionRu(chosenLabel)}» хуже, потому что не максимизирует EV в этой текстуре и против этого диапазона.`
      : null,
    board,
    hero,
    pot,
    history
  };
}

function shortFlavor(grade) {
  if (grade === 'EXCELLENT') return 'Чистая линия.';
  if (grade === 'GOOD') return 'Направление верное.';
  if (grade === 'INACCURACY') return 'Почти попал.';
  return null;
}

export function buildTaskFeedback({
  task,
  chosenLabel,
  recommendedLabel,
  grade,
  evLossBb = null,
  concept = null
} = {}) {
  if (!task) return null;

  const chosen = chosenLabel || '—';
  const recommended = recommendedLabel || task.correct || '—';
  const isCorrect = chosen === recommended;
  const isNear = !isCorrect && (task.alsoOk || []).includes(chosen);
  const conceptLabel = humanConcept(task);

  const why = buildWhy(task, recommended);
  const userMistake = buildUserMistake(task, chosen, recommended, grade);
  const alternative = buildAlternative(task, chosen, recommended);
  const detail = buildDetail(task, recommended, chosen);
  const flavor = shortFlavor(grade);

  const summaryParts = [
    `Решение: ${actionRu(recommended)}.`,
    why,
    userMistake
  ];
  if (evLossBb != null && evLossBb > 0.01) {
    summaryParts.push(`Потеря EV: ${Number(evLossBb).toFixed(2)} BB.`);
  }

  return {
    grade,
    title: VERDICT[grade] || 'Результат',
    verdict: VERDICT[grade] || 'Результат',
    correctLine: actionRu(recommended),
    why,
    userMistake,
    concept: conceptLabel,
    conceptKey: concept || task.concept,
    alternative,
    summary: summaryParts.join(' '),
    tip: flavor,
    detail,
    chosenLabelRu: actionRu(chosen),
    recLabelRu: actionRu(recommended),
    mixedStrategy: isNear,
    taskId: task.id
  };
}

export function skillScoresForHome(skillProfile) {
  if (!skillProfile || !skillProfile.skills) return [];
  const order = ['preflop', 'postflop', 'betSizing', 'river', 'icm', 'bluffCatch', 'shortStack'];
  return order
    .filter((k) => skillProfile.skills[k] && skillProfile.skills[k].score != null)
    .map((k) => ({
      skill: k,
      label: skillProfile.skills[k].labelRu || skillLabelRu(k),
      score: skillProfile.skills[k].score
    }));
}
