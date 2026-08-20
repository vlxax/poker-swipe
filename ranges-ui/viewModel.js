// View models for range narrowing trainer.

import { matrixClasses, policySegments } from './matrix.js';
import { matrixCellState } from './narrowingEngine.js';
import { HINTS } from './storage.js';

function stepCandidates(step, answers) {
  if (step.dependsOnStep != null && answers?.[step.dependsOnStep]) {
    return new Set(answers[step.dependsOnStep]);
  }
  return new Set(step.candidateHands || []);
}

function buildMatrixRows(step, userSelection, { review = false, answers = [] } = {}) {
  const candidates = stepCandidates(step, answers);
  const truthHands = step.truth?.hands || new Set();
  const policies = step.truth?.policies
    || Object.fromEntries(Object.entries(step.truth?.cells || {}).map(([h, c]) => [h, c.policy]));

  return matrixClasses().map((hand) => matrixCellState(hand, {
    candidates,
    userHands: userSelection,
    truthHands,
    policies,
    review
  }));
}

export { policySegments };

function introHints(progress) {
  if (progress?.completed) return [];
  if (!progress?.hintsSeen?.includes('start')) return [HINTS[0]];
  return [];
}

function playHints(progress, stepIndex) {
  if (progress?.completed) return [];
  const hints = [];
  if (!progress?.hintsSeen?.includes('toggle')) hints.push(HINTS[1]);
  if (stepIndex > 0 && !progress?.hintsSeen?.includes('step')) hints.push(HINTS[2]);
  return hints;
}

export function introViewModel({ scenario, progress }) {
  const steps = (scenario?.steps || []).map((step, i) => ({
    index: i + 1,
    actionLabel: step.actionLabel,
    actionLine: step.actionLine
  }));

  return {
    phase: 'intro',
    title: 'СУЖЕНИЕ ДИАПАЗОНА',
    headline: scenario?.title || 'Задача',
    subtitle: scenario?.subtitle || '',
    formatLabel: scenario?.intro?.formatLabel || '6-max',
    heroLabel: scenario?.heroLabel || null,
    villainLabel: scenario?.villainLabel || null,
    potLabel: scenario?.potLabel || null,
    stepCount: scenario?.stepCount || 0,
    steps,
    cta: 'НАЧАТЬ ЗАДАЧУ →',
    hints: introHints(progress),
    runs: progress?.runs || 0
  };
}

export function playViewModel({ scenario, stepIndex, userSelection, answers = [], progress }) {
  const step = scenario.steps[stepIndex];
  const candidates = stepCandidates(step, answers);
  const kept = [...userSelection].filter((h) => candidates.has(h)).length;
  const totalSteps = scenario.steps.length;

  const matrix = buildMatrixRows(step, userSelection, { answers });
  const truthPolicies = step.truth?.policies || {};

  return {
    phase: 'play',
    title: 'СУЖЕНИЕ ДИАПАЗОНА',
    stepIndex,
    stepTotal: totalSteps,
    stepLabel: `Шаг ${stepIndex + 1}/${totalSteps}`,
    actionLabel: step.actionLabel,
    actionLine: step.actionLine,
    question: step.question,
    narrative: step.narrative,
    matrix,
    keptCount: kept,
    candidateCount: candidates.size,
    cta: stepIndex < totalSteps - 1 ? 'СЛЕДУЮЩИЙ ШАГ →' : 'ПОКАЗАТЬ РАЗБОР →',
    hints: playHints(progress, stepIndex),
    truthPolicies
  };
}

export function summaryViewModel({ scenario, answers, scores }) {
  const summary = scores.summary || { avgAccuracy: 0, lines: [] };
  const steps = scenario.steps.map((step, i) => {
    const score = scores[i] || {};
    const userSet = answers[i] || new Set();
    const matrix = buildMatrixRows(step, userSet, { review: true, answers });
    return {
      index: i + 1,
      actionLabel: step.actionLabel,
      question: step.question,
      accuracy: score.accuracy || 0,
      feedback: score.feedback || [],
      keptWrong: score.keptWrong || [],
      removedWrong: score.removedWrong || [],
      matrix
    };
  });

  return {
    phase: 'summary',
    title: 'СУЖЕНИЕ ДИАПАЗОНА',
    headline: scenario.title,
    avgAccuracy: summary.avgAccuracy,
    summaryLines: summary.lines,
    steps,
    cta: 'СЛЕДУЮЩАЯ ЗАДАЧА →'
  };
}

export function helpViewModel() {
  return {
    title: 'Как проходить задачу?',
    lines: [
      'Тебе показывают покерную ситуацию и исходный диапазон.',
      'После действия соперника нужно убрать руки, которые не остаются в диапазоне.',
      'Нажми на клетку матрицы, чтобы убрать или вернуть класс рук.',
      'Полосы в клетке — смешанные частоты. Не своди их к одному действию.',
      '',
      'В конце увидишь разбор: что оставил лишнего, что выкинул зря, и как меняется структура диапазона.'
    ]
  };
}

// Legacy exports kept for catalog/data tests importing viewModel paths.
export function selectorViewModel() {
  return introViewModel({ scenario: null, progress: {} });
}

export function resultViewModel() {
  return { phase: 'legacy', title: 'СУЖЕНИЕ ДИАПАЗОНА' };
}
