// Truth evaluation and feedback for range-narrowing trainer steps.

import { matrixClasses, isMixedPolicy, actionFrequencyRows } from './matrix.js';
import { buildReferenceMatrix, lookupReferencePolicy } from './referenceRanges.js';
import { primaryAction } from './preflopAtlas.js';

const PLAY_THRESHOLD = 0.15;

export function selectionFromReference(sel) {
  const matrix = buildReferenceMatrix(sel);
  if (!matrix.supported) {
    return { supported: false, hands: new Set(), cells: {}, policies: {} };
  }

  const hands = new Set();
  const policies = {};
  const sit = sel.situation;

  for (const hand of matrixClasses()) {
    const cell = matrix.cells[hand];
    const policy = cell?.policy || { FOLD: 1, CALL: 0, RAISE: 0 };
    policies[hand] = policy;

    if (sit === 'rfi') {
      if ((policy.RAISE || 0) >= PLAY_THRESHOLD) hands.add(hand);
    } else {
      const play = (policy.CALL || 0) + (policy.RAISE || 0);
      if (play >= PLAY_THRESHOLD) hands.add(hand);
    }
  }

  return { supported: true, hands, cells: matrix.cells, policies };
}

export function startingSelection(candidateHands) {
  return new Set(candidateHands);
}

export function toggleHand(selection, hand, candidateHands) {
  const next = new Set(selection);
  if (!candidateHands.has(hand)) return next;
  if (next.has(hand)) next.delete(hand);
  else next.add(hand);
  return next;
}

export function scoreStep(userHands, truth, candidateHands) {
  const user = userHands instanceof Set ? userHands : new Set(userHands);
  const truthHands = truth.hands instanceof Set ? truth.hands : new Set(truth.hands);
  const candidates = candidateHands instanceof Set ? candidateHands : new Set(candidateHands);

  const keptWrong = [];
  const removedWrong = [];
  const keptCorrect = [];
  const removedCorrect = [];
  const mixedIssues = [];

  for (const hand of candidates) {
    const inTruth = truthHands.has(hand);
    const inUser = user.has(hand);
    const policy = truth.policies?.[hand] || lookupReferencePolicy(truth.sel, hand);
    const mixed = policy && isMixedPolicy(policy);

    if (inUser && !inTruth) {
      keptWrong.push(hand);
      if (mixed) mixedIssues.push({ hand, type: 'kept_out' });
    } else if (!inUser && inTruth) {
      removedWrong.push(hand);
      if (mixed) mixedIssues.push({ hand, type: 'removed_in' });
    } else if (inUser && inTruth) {
      keptCorrect.push(hand);
    } else {
      removedCorrect.push(hand);
    }
  }

  const total = candidates.size || 1;
  const accuracy = Math.round(((keptCorrect.length + removedCorrect.length) / total) * 100);

  return {
    accuracy,
    keptWrong,
    removedWrong,
    keptCorrect,
    removedCorrect,
    mixedIssues,
    counts: {
      keptWrong: keptWrong.length,
      removedWrong: removedWrong.length,
      keptCorrect: keptCorrect.length,
      removedCorrect: removedCorrect.length
    }
  };
}

function actionExplain(sel, hand, policy) {
  const sit = sel.situation;
  const meta = primaryAction(policy, sit);
  const rows = actionFrequencyRows(policy, sit);
  if (isMixedPolicy(policy)) {
    const parts = rows.map((r) => `${r.label} ${r.pct}%`).join(', ');
    return `${hand} — смешанная линия (${parts}). Диапазон здесь не бинарный.`;
  }
  if (sit === 'rfi') {
    if ((policy.RAISE || 0) >= PLAY_THRESHOLD) {
      return `${hand} открывается с этой позиции — слишком сильно/гибко, чтобы выбрасывать после ${sel.position}.`;
    }
    return `${hand} не входит в открытие с ${sel.position} — слишком слабая или доминируемая рука.`;
  }
  const play = (policy.CALL || 0) + (policy.RAISE || 0);
  if (play >= PLAY_THRESHOLD) {
    return `${hand} продолжает (${meta.label.toLowerCase()}) — рука достаточно сильна или с хорошим эквити/блокерами для этой линии.`;
  }
  return `${hand} уходит в фолд — после действия соперника рука не тянет продолжение.`;
}

export function stepFeedback(step, score) {
  const lines = [];
  const sel = step.truthSel;

  if (score.accuracy >= 92) {
    lines.push('Точное чтение: структура диапазона совпадает с ожидаемой.');
  } else if (score.accuracy >= 75) {
    lines.push('Близко, но есть системные промахи по краям диапазона.');
  } else {
    lines.push('Диапазон расходится — посмотри, где осталось лишнее и что выкинул зря.');
  }

  if (score.keptWrong.length) {
    const sample = score.keptWrong.slice(0, 4).join(', ');
    lines.push(`Лишние руки: ${sample}${score.keptWrong.length > 4 ? '…' : ''}.`);
    for (const hand of score.keptWrong.slice(0, 3)) {
      const policy = step.truth.policies?.[hand];
      if (policy) lines.push(actionExplain(sel, hand, policy));
    }
  }

  if (score.removedWrong.length) {
    const sample = score.removedWrong.slice(0, 4).join(', ');
    lines.push(`Зря убрал: ${sample}${score.removedWrong.length > 4 ? '…' : ''}.`);
    for (const hand of score.removedWrong.slice(0, 3)) {
      const policy = step.truth.policies?.[hand];
      if (policy) lines.push(actionExplain(sel, hand, policy));
    }
  }

  const mixedHands = [...(step.truth.hands || [])].filter((h) => {
    const p = step.truth.policies?.[h];
    return p && isMixedPolicy(p);
  });
  if (mixedHands.length) {
    lines.push(`Смешанные руки (${mixedHands.slice(0, 5).join(', ')}${mixedHands.length > 5 ? '…' : ''}) — не схлопывай их в одно действие.`);
  }

  if (score.removedWrong.some((h) => step.truth.policies?.[h]?.RAISE >= 0.35)) {
    lines.push('Часть value-рук ушла из диапазона — после агрессии соперника сильные руки обычно остаются.');
  }
  if (score.keptWrong.some((h) => (step.truth.policies?.[h]?.FOLD || 0) >= 0.7)) {
    lines.push('В диапазоне остались слабые руки — после действия соперника они чаще становятся чистым фолдом.');
  }

  return lines;
}

export function summaryFeedback(scenario, stepScores) {
  const avg = Math.round(stepScores.reduce((s, x) => s + x.accuracy, 0) / (stepScores.length || 1));
  const lines = [`Итог: ${avg}% точности по ${stepScores.length} шаг${stepScores.length > 1 ? 'ам' : 'у'}.`];

  const allKeptWrong = stepScores.flatMap((s) => s.keptWrong);
  const allRemovedWrong = stepScores.flatMap((s) => s.removedWrong);

  if (allKeptWrong.length > allRemovedWrong.length) {
    lines.push('Системная ошибка: диапазон слишком широкий — оставляешь руки, которые соперник уже отфильтровал.');
  } else if (allRemovedWrong.length > allKeptWrong.length) {
    lines.push('Системная ошибка: диапазон слишком узкий — выкидываешь блефы, мерджи и часть value.');
  }

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const score = stepScores[i];
    if (score.accuracy < 85) {
      lines.push(`Шаг ${i + 1}: ${step.actionLabel} — ${score.accuracy}%.`);
    }
  }

  return { avgAccuracy: avg, lines };
}

export function matrixCellState(hand, { candidates, userHands, truthHands, policies, review = false }) {
  const candidate = candidates.has(hand);
  const kept = userHands.has(hand);
  const truth = truthHands.has(hand);
  const policy = policies?.[hand];
  const mixed = policy && isMixedPolicy(policy);

  if (!candidate) {
    return { hand, state: 'dead', candidate: false, kept: false, mixed: false, policy };
  }

  if (!review) {
    return { hand, state: kept ? 'kept' : 'out', candidate: true, kept, mixed, policy };
  }

  if (kept && truth) return { hand, state: 'ok-kept', candidate: true, kept: true, mixed, policy };
  if (!kept && !truth) return { hand, state: 'ok-out', candidate: true, kept: false, mixed, policy };
  if (kept && !truth) return { hand, state: 'bad-kept', candidate: true, kept: true, mixed, policy };
  return { hand, state: 'bad-out', candidate: true, kept: false, mixed, policy };
}
