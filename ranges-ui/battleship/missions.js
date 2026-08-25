// Mission definitions — quality-gated MATRIX_HUNT, no answer pre-reveal.

import {
  getPocketSequence,
  getSuitedAxSequence,
  getOffsuitAxSequence,
  getSuitedKxSequence,
  getCanonicalBroadwayHands,
  getNearBroadwayHands,
  getSuitedConnectorSequence,
  getSuitedGapperSequence,
  findContinuousBoundary,
  isSequenceContinuousOpen,
  allHands
} from './matrixUtils.js';
import { isOpen, isGradable } from './trainerRangeModel.js';
import { displayPosition, formatStackLabel } from './courses.js';

export const DEFAULT_GRENADES = 7;
export const MIN_GRENADES = 5;
export const MAX_GRENADES = 10;
export const GRENADES_PER_MISSION = DEFAULT_GRENADES;

/** Adaptive grenades: enough wrong guesses to learn, clamped 5–10. */
export function grenadesForMission(mission) {
  const n = mission?.getTargetHands?.().length || 0;
  if (mission?.type === 'RANGE_REBUILD') return MAX_GRENADES;
  const adaptive = Math.round(5 + n * 0.3);
  return Math.min(MAX_GRENADES, Math.max(MIN_GRENADES, adaptive));
}
export const MIN_TARGETS = 2;
export const MIN_NON_TARGETS = 2;
export const MAX_MISSIONS = 8;
export const MIN_MISSIONS = 5;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gradableHands(hands, model) {
  return hands.filter((h) => isGradable(h, model));
}

function openHands(hands, model) {
  return hands.filter((h) => isOpen(h, model) === true);
}

function categoryStats(hands, model) {
  const gradable = gradableHands(hands, model);
  const targets = openHands(gradable, model);
  const nonTargets = gradable.filter((h) => !targets.includes(h));
  return { gradable, targets, nonTargets };
}

export function isMeaningfulCategory(stats) {
  return stats.targets.length >= MIN_TARGETS && stats.nonTargets.length >= MIN_NON_TARGETS;
}

function boundaryHandsForSeq(seq, model) {
  const gradableSeq = gradableHands(seq, model);
  const boundary = findContinuousBoundary(gradableSeq, model.openSet);
  boundary.continuous = isSequenceContinuousOpen(gradableSeq, model.openSet);
  const hands = [];
  if (boundary.lastOpen) hands.push(boundary.lastOpen);
  if (boundary.firstFold) hands.push(boundary.firstFold);
  const idx = gradableSeq.indexOf(boundary.lastOpen);
  if (idx >= 0) {
    for (let i = Math.max(0, idx - 2); i < Math.min(gradableSeq.length, idx + 4); i++) {
      if (!hands.includes(gradableSeq[i])) hands.push(gradableSeq[i]);
    }
  }
  const active = gradableHands(hands.length ? hands : gradableSeq.slice(0, 8), model);
  const targets = openHands(active, model);
  const nonTargets = active.filter((h) => !targets.includes(h));
  return { active, targets, nonTargets, boundary, meaningful: targets.length >= MIN_TARGETS && nonTargets.length >= MIN_NON_TARGETS };
}

const CATEGORY_DEFS = [
  { id: 'pocket-pairs', title: 'КАРМАНКИ', hands: () => getPocketSequence() },
  { id: 'suited-ax', title: 'SUITED AX', hands: () => getSuitedAxSequence() },
  { id: 'suited-kx', title: 'SUITED KX', hands: () => getSuitedKxSequence() },
  { id: 'offsuit-ax', title: 'OFFSUIT AX', hands: () => getOffsuitAxSequence() },
  { id: 'broadway', title: 'BROADWAY', hands: () => [...getCanonicalBroadwayHands(), ...getNearBroadwayHands()] },
  { id: 'connectors-gappers', title: 'КОННЕКТОРЫ', hands: () => [...getSuitedConnectorSequence(), ...getSuitedGapperSequence()] }
];

function makeCategoryHunt(def, model, pos) {
  const stats = categoryStats(def.hands(), model);
  if (!isMeaningfulCategory(stats)) return null;
  return {
    id: def.id,
    type: 'MATRIX_HUNT',
    title: def.title,
    goal: `Какие ${def.title.toLowerCase()} входят в open ${pos}?`,
    instruction: 'Жми только на руки из диапазона.',
    getActiveHands() { return stats.gradable; },
    getTargetHands() { return stats.targets; },
    _audit: { category: def.id, targetCount: stats.targets.length, nonTargetCount: stats.nonTargets.length, meaningful: true }
  };
}

function makeBoundaryHunt(def, model) {
  const b = boundaryHandsForSeq(def.hands(), model);
  if (!b.meaningful) return null;
  return {
    id: `edge-${def.id}`,
    type: 'MATRIX_HUNT',
    title: `ГРАНИЦА · ${def.title}`,
    goal: `Где заканчивается ${def.title.toLowerCase()}?`,
    instruction: 'Ищи open-руки у границы диапазона.',
    getActiveHands() { return b.active; },
    getTargetHands() { return b.targets; },
    _audit: { category: def.id, targetCount: b.targets.length, nonTargetCount: b.nonTargets.length, meaningful: true, edge: true }
  };
}

function makeMixedHunt(model, count, usedTargets = new Set()) {
  const pool = shuffle(openHands(gradableHands(allHands(), model), model).filter((h) => !usedTargets.has(h)));
  const targets = pool.slice(0, Math.min(count, pool.length));
  if (targets.length < MIN_TARGETS) return null;
  return {
    id: `mixed-hunt-${count}`,
    type: 'MATRIX_HUNT',
    title: 'ОХОТА',
    goal: `Найди ${targets.length} open-рук из диапазона.`,
    instruction: 'Без подсказок — только память.',
    _targets: targets,
    getActiveHands() { return gradableHands(allHands(), model); },
    getTargetHands() { return this._targets; },
    _audit: { category: 'mixed', targetCount: targets.length, nonTargetCount: gradableHands(allHands(), model).length - targets.length, meaningful: true }
  };
}

function makeFinalRebuild(model, pos) {
  const targets = openHands(gradableHands(allHands(), model), model);
  return {
    id: 'final-battle',
    type: 'RANGE_REBUILD',
    title: 'ФИНАЛЬНЫЙ БОЙ',
    goal: `Восстанови рендж ${pos}.`,
    instruction: 'Отметь все open-руки · гранаты по размеру миссии.',
    isFinal: true,
    getActiveHands() { return gradableHands(allHands(), model); },
    getTargetHands() { return targets; },
    _audit: { category: 'final', targetCount: targets.length, nonTargetCount: gradableHands(allHands(), model).length - targets.length, meaningful: true, rebuild: true }
  };
}

export function buildMissions(model) {
  const pos = model.position || '';
  const missions = [];
  const usedIds = new Set();

  for (const def of CATEGORY_DEFS) {
    const hunt = makeCategoryHunt(def, model, pos);
    if (hunt && !usedIds.has(hunt.id)) {
      missions.push(hunt);
      usedIds.add(hunt.id);
    } else {
      const edge = makeBoundaryHunt(def, model);
      if (edge && !usedIds.has(edge.id)) {
        missions.push(edge);
        usedIds.add(edge.id);
      }
    }
  }

  const usedTargets = new Set();
  for (const m of missions) {
    for (const h of m.getTargetHands()) usedTargets.add(h);
  }

  while (missions.length < MAX_MISSIONS - 1) {
    const count = missions.length < 4 ? 6 : missions.length < 6 ? 8 : 10;
    const hunt = makeMixedHunt(model, count, usedTargets);
    if (!hunt) break;
    hunt.id = `hunt-${missions.length}`;
    missions.push(hunt);
    usedIds.add(hunt.id);
    for (const h of hunt.getTargetHands()) usedTargets.add(h);
    if (missions.length >= MAX_MISSIONS - 1) break;
  }

  missions.push(makeFinalRebuild(model, pos));

  const trimmed = missions.slice(0, MAX_MISSIONS);
  if (trimmed.length < MIN_MISSIONS) {
    while (trimmed.length < MIN_MISSIONS && trimmed.length < MAX_MISSIONS) {
      const hunt = makeMixedHunt(model, 5, usedTargets);
      if (!hunt) break;
      hunt.id = `fill-${trimmed.length}`;
      trimmed.splice(trimmed.length - 1, 0, hunt);
      for (const h of hunt.getTargetHands()) usedTargets.add(h);
    }
  }

  return trimmed.map((m, i) => ({ ...m, index: i + 1 }));
}

export const COURSE_MISSION_IDS = [
  'pocket-pairs', 'suited-ax', 'suited-kx', 'offsuit-ax', 'broadway', 'connectors-gappers',
  'edge-pocket-pairs', 'edge-suited-ax', 'edge-suited-kx', 'edge-offsuit-ax', 'edge-broadway', 'edge-connectors-gappers',
  'mixed-hunt-6', 'mixed-hunt-8', 'mixed-hunt-10', 'hunt-0', 'hunt-1', 'hunt-2', 'hunt-3', 'hunt-4', 'hunt-5', 'hunt-6',
  'fill-0', 'fill-1', 'fill-2', 'final-battle'
];

export function auditMission(mission, model) {
  const active = mission.getActiveHands();
  const targets = mission.getTargetHands();
  const activeSet = new Set(active);
  const nonTargets = active.filter((h) => !targets.includes(h));
  const preRevealed = 0;
  const meaningful = targets.length >= MIN_TARGETS && (mission.type === 'RANGE_REBUILD' || nonTargets.length >= MIN_NON_TARGETS);
  return {
    id: mission.id,
    category: mission._audit?.category || mission.id,
    targetCount: targets.length,
    nonTargetCount: nonTargets.length,
    answerPreRevealed: preRevealed,
    meaningfulDecision: meaningful,
    type: mission.type
  };
}

export function missionRangeLabel(model) {
  const pos = displayPosition(model.position || '');
  return `${pos} · ${formatStackLabel(model.stack)}`;
}
