// Mission definitions — unified MATRIX_HUNT gameplay from trainer range model.

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
  getHandCategory,
  allHands
} from './matrixUtils.js';
import { isOpen, isGradable } from './trainerRangeModel.js';

export const COURSE_MISSION_IDS = [
  'pocket-pairs',
  'suited-ax',
  'broadway',
  'suited-kx',
  'connectors-gappers',
  'range-edge',
  'hunt',
  'hunt-2',
  'final-battle'
];

export const GRENADES_PER_MISSION = 3;

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

function boundaryForCategory(category, model) {
  let seq = [];
  if (category === 'pocketPairs') seq = getPocketSequence();
  else if (category === 'suitedAx') seq = getSuitedAxSequence();
  else if (category === 'offsuitAx') seq = getOffsuitAxSequence();
  else if (category === 'suitedKx') seq = getSuitedKxSequence();
  else return { lastOpen: null, firstFold: null, continuous: false, hands: [] };
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
  boundary.hands = gradableHands(hands.length ? hands : gradableSeq.slice(0, 6), model);
  return boundary;
}

function pickEdgeMission(model) {
  const candidates = ['offsuitAx', 'suitedKx', 'suitedAx'];
  for (const cat of candidates) {
    const b = boundaryForCategory(cat, model);
    if (b.hands.length >= 3 && openHands(b.hands, model).length >= 1) {
      return { category: cat, boundary: b };
    }
  }
  return null;
}

function generateFinalTargets(model) {
  const categories = ['pocketPairs', 'suitedAx', 'offsuitAx', 'suitedKx', 'broadway', 'suitedConnectors', 'suitedGappers'];
  const picked = [];
  const byCat = {};
  for (const cat of categories) byCat[cat] = [];
  for (const hand of allHands()) {
    if (!isGradable(hand, model) || !isOpen(hand, model)) continue;
    const cat = getHandCategory(hand);
    if (byCat[cat]) byCat[cat].push(hand);
  }
  for (const cat of categories) {
    const pool = byCat[cat];
    if (pool.length) picked.push(shuffle(pool)[0]);
  }
  const rest = shuffle(allHands().filter((h) => isGradable(h, model) && isOpen(h, model) && !picked.includes(h)));
  while (picked.length < 12 && rest.length) picked.push(rest.pop());
  return picked;
}

function remainingOpenHands(model, excludeCategories = []) {
  const used = new Set();
  for (const cat of excludeCategories) {
    const seq = {
      pocketPairs: getPocketSequence(),
      suitedAx: getSuitedAxSequence(),
      broadway: [...getCanonicalBroadwayHands(), ...getNearBroadwayHands()],
      suitedKx: getSuitedKxSequence(),
      connectors: [...getSuitedConnectorSequence(), ...getSuitedGapperSequence()]
    }[cat];
    if (seq) openHands(gradableHands(seq, model), model).forEach((h) => used.add(h));
  }
  return shuffle(allHands().filter((h) => isGradable(h, model) && isOpen(h, model) && !used.has(h)));
}

export function buildMissions(model) {
  const pos = model.position || '';
  const stack = model.stack || '';
  const rangeLabel = `${pos} · ${stack.replace('-', '–')} ББ`;
  const edge = pickEdgeMission(model);

  const missions = [
    {
      id: 'pocket-pairs',
      type: 'MATRIX_HUNT',
      index: 1,
      title: 'КАРМАНКИ',
      goal: 'Найди все пары в диапазоне.',
      instruction: 'Жми на руки, которыми ' + pos + ' играет.',
      getActiveHands() { return gradableHands(getPocketSequence(), model); },
      getTargetHands() { return openHands(this.getActiveHands(), model); }
    },
    {
      id: 'suited-ax',
      type: 'MATRIX_HUNT',
      index: 2,
      title: 'SUITED AX',
      goal: 'Найди одномастные тузы.',
      instruction: 'Только suited Ax из open-диапазона.',
      getActiveHands() { return gradableHands(getSuitedAxSequence(), model); },
      getTargetHands() { return openHands(this.getActiveHands(), model); }
    },
    {
      id: 'broadway',
      type: 'MATRIX_HUNT',
      index: 3,
      title: 'BROADWAY',
      goal: 'Найди бродвейные руки.',
      instruction: 'AK–QT и соседние бродвейные комбо.',
      getActiveHands() {
        return gradableHands([...getCanonicalBroadwayHands(), ...getNearBroadwayHands()], model);
      },
      getTargetHands() { return openHands(this.getActiveHands(), model); }
    },
    {
      id: 'suited-kx',
      type: 'MATRIX_HUNT',
      index: 4,
      title: 'SUITED KX',
      goal: 'Найди одномастные короли.',
      instruction: 'Suited Kx из open-диапазона.',
      getActiveHands() { return gradableHands(getSuitedKxSequence(), model); },
      getTargetHands() { return openHands(this.getActiveHands(), model); }
    },
    {
      id: 'connectors-gappers',
      type: 'MATRIX_HUNT',
      index: 5,
      title: 'КОННЕКТОРЫ',
      goal: 'Найди suited коннекторы и гапперы.',
      instruction: 'Одномастные связки и разрывы.',
      getActiveHands() {
        return gradableHands([...getSuitedConnectorSequence(), ...getSuitedGapperSequence()], model);
      },
      getTargetHands() { return openHands(this.getActiveHands(), model); }
    }
  ];

  const priorCats = ['pocketPairs', 'suitedAx', 'broadway', 'suitedKx', 'connectors'];

  if (edge) {
    const catLabel = edge.category === 'offsuitAx' ? 'OFFSUIT AX' : edge.category === 'suitedKx' ? 'SUITED KX' : 'SUITED AX';
    missions.push({
      id: 'range-edge',
      type: 'MATRIX_HUNT',
      index: 6,
      title: 'ГРАНИЦА РЕНДЖА',
      goal: `Найди open-руки у границы ${catLabel}.`,
      instruction: edge.boundary.continuous
        ? 'Где заканчивается open?'
        : 'Граница неровная — ищи только open.',
      getActiveHands() { return edge.boundary.hands; },
      getTargetHands() { return openHands(this.getActiveHands(), model); }
    });
  } else {
    const huntPool = remainingOpenHands(model, priorCats);
    missions.push({
      id: 'hunt',
      type: 'MATRIX_HUNT',
      index: 6,
      title: 'ОХОТА',
      goal: 'Найди оставшиеся open-руки.',
      instruction: 'Случайные цели из диапазона.',
      _targets: huntPool.slice(0, Math.min(8, huntPool.length)),
      getActiveHands() { return gradableHands(allHands(), model); },
      getTargetHands() {
        return this._targets.length ? this._targets : openHands(this.getActiveHands(), model).slice(0, 6);
      }
    });
  }

  const huntPool2 = remainingOpenHands(model, priorCats);
  missions.push({
    id: edge ? 'hunt' : 'hunt-2',
    type: 'MATRIX_HUNT',
    index: 7,
    title: 'ОХОТА',
    goal: 'Найди оставшиеся open-руки.',
    instruction: 'Случайные цели из диапазона.',
    _targets: huntPool2.slice(edge ? 0 : 8, edge ? Math.min(10, huntPool2.length) : Math.min(16, huntPool2.length)),
    getActiveHands() { return gradableHands(allHands(), model); },
    getTargetHands() {
      if (this._targets.length) return this._targets;
      return openHands(this.getActiveHands(), model).slice(0, 8);
    }
  });

  missions.push({
    id: 'final-battle',
    type: 'MATRIX_HUNT',
    index: 8,
    title: 'ФИНАЛЬНЫЙ БОЙ',
    goal: 'Найди ключевые руки всего диапазона.',
    instruction: '12 целей · 3 гранаты.',
    _finalTargets: generateFinalTargets(model),
    getActiveHands() { return gradableHands(allHands(), model); },
    getTargetHands() { return this._finalTargets; },
    isFinal: true
  });

  return missions.map((m, i) => ({ ...m, index: i + 1 }));
}

export function missionRangeLabel(model) {
  const pos = model.position || '';
  const stack = (model.stack || '').replace('-', '–');
  return `${pos} · ${stack} ББ`;
}
