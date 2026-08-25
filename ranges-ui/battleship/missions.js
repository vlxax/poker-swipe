// Mission definitions — built dynamically from trainer range model.

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
  getLowestContinuousOpen,
  formatThreshold,
  getHandCategory,
  allHands
} from './matrixUtils.js';
import { isOpen, isGradable } from './trainerRangeModel.js';

export const COURSE_MISSION_IDS = [
  'pocket-pairs',
  'suited-ax',
  'offsuit-ax',
  'suited-kx',
  'broadway',
  'connectors-gappers',
  'mixed-edges',
  'final-battle'
];

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

function generateFinalBattleHands(model) {
  const result = [];
  const categories = ['pocketPairs', 'suitedAx', 'offsuitAx', 'suitedKx', 'broadway', 'suitedConnectors', 'suitedGappers'];
  const categoryHands = {};
  for (const cat of categories) categoryHands[cat] = [];
  for (const hand of allHands()) {
    if (!isGradable(hand, model)) continue;
    const cat = getHandCategory(hand);
    if (categoryHands[cat]) categoryHands[cat].push(hand);
  }
  for (const cat of categories) {
    const hands = categoryHands[cat] || [];
    if (!hands.length) continue;
    result.push(shuffle(hands)[0]);
  }
  const pool = shuffle(allHands().filter((h) => isGradable(h, model)));
  for (const hand of pool) {
    if (result.length >= 12) break;
    if (!result.includes(hand)) result.push(hand);
  }
  return result;
}

export function buildMissions(model) {
  const inRange = (hand) => isOpen(hand, model) === true;

  function boundaryForCategory(category) {
    let seq = [];
    if (category === 'pocketPairs') seq = getPocketSequence();
    else if (category === 'suitedAx') seq = getSuitedAxSequence();
    else if (category === 'offsuitAx') seq = getOffsuitAxSequence();
    else if (category === 'suitedKx') seq = getSuitedKxSequence();
    else return { lastOpen: null, firstFold: null, continuous: false };
    const gradableSeq = gradableHands(seq, model);
    const openSet = model.openSet;
    const boundary = findContinuousBoundary(gradableSeq, openSet);
    boundary.continuous = isSequenceContinuousOpen(gradableSeq, openSet);
    return boundary;
  }

  const pos = model.position || '';
  const stack = model.stack || '';
  const rangeLabel = `${pos} ${stack}`;

  return [
    {
      id: 'pocket-pairs',
      type: 'FULL_SECTOR_CONFIRM',
      title: 'Pocket Pairs',
      description: `Какие карманные пары входят в ${rangeLabel} open?`,
      shots: 1,
      getChoices() {
        const seq = gradableHands(getPocketSequence(), model);
        const lowest = getLowestContinuousOpen(seq, model.openSet);
        if (!lowest) return ['22+', '44+', '66+'];
        const correct = formatThreshold(lowest);
        const choices = [correct];
        const all = ['22+', '44+', '66+', '88+'];
        for (const d of all) {
          if (d !== correct && choices.length < 3) choices.push(d);
        }
        return choices;
      },
      getCorrectChoice() {
        const seq = gradableHands(getPocketSequence(), model);
        const lowest = getLowestContinuousOpen(seq, model.openSet);
        return lowest ? formatThreshold(lowest) : '22+';
      },
      getActiveHands() { return gradableHands(getPocketSequence(), model); },
      getTargetHands() { return openHands(this.getActiveHands(), model); },
      getChallengeHands() { return this.getTargetHands(); }
    },
    {
      id: 'suited-ax',
      type: 'FULL_SECTOR_CONFIRM',
      title: 'Suited Ax',
      description: `Какие одномастные Ax входят в ${rangeLabel} open?`,
      shots: 1,
      getChoices() {
        const seq = gradableHands(getSuitedAxSequence(), model);
        const lowest = getLowestContinuousOpen(seq, model.openSet);
        if (!lowest) return ['A2s+', 'A5s+', 'A8s+'];
        const correct = formatThreshold(lowest);
        const choices = [correct];
        const all = ['A2s+', 'A5s+', 'A8s+', 'A9s+'];
        for (const d of all) {
          if (d !== correct && choices.length < 3) choices.push(d);
        }
        return choices;
      },
      getCorrectChoice() {
        const seq = gradableHands(getSuitedAxSequence(), model);
        const lowest = getLowestContinuousOpen(seq, model.openSet);
        return lowest ? formatThreshold(lowest) : 'A2s+';
      },
      getActiveHands() { return gradableHands(getSuitedAxSequence(), model); },
      getTargetHands() { return openHands(this.getActiveHands(), model); },
      getChallengeHands() { return this.getTargetHands(); }
    },
    {
      id: 'offsuit-ax',
      type: 'FIND_THE_EDGE',
      title: 'Offsuit Ax',
      description: 'Найди последнюю OPEN offsuit Ax руку или отметь границу.',
      shots: 1,
      getActiveHands() {
        const seq = gradableHands(getOffsuitAxSequence(), model);
        const b = boundaryForCategory('offsuitAx');
        if (!b.continuous) {
          return seq.filter((h) => inRange(h) || seq.indexOf(h) <= seq.indexOf(b.lastOpen || '') + 3);
        }
        const result = [];
        if (b.lastOpen) result.push(b.lastOpen);
        if (b.firstFold) result.push(b.firstFold);
        const idx = seq.indexOf(b.lastOpen);
        for (let i = Math.max(0, idx - 2); i < Math.min(seq.length, idx + 4); i++) {
          if (!result.includes(seq[i])) result.push(seq[i]);
        }
        return result.length ? result : seq.slice(0, 6);
      },
      getTargetHands() { return openHands(this.getActiveHands(), model); },
      getBoundary() { return boundaryForCategory('offsuitAx'); },
      usesSubmit: false,
      edgeMode: () => boundaryForCategory('offsuitAx').continuous
    },
    {
      id: 'suited-kx',
      type: 'FIND_THE_EDGE',
      title: 'Suited Kx',
      description: 'Найди последнюю OPEN suited Kx руку или отметь границу.',
      shots: 1,
      getActiveHands() {
        const seq = gradableHands(getSuitedKxSequence(), model);
        const b = boundaryForCategory('suitedKx');
        if (!b.continuous) {
          return seq.filter((h) => inRange(h));
        }
        const result = [];
        if (b.lastOpen) result.push(b.lastOpen);
        if (b.firstFold) result.push(b.firstFold);
        const idx = seq.indexOf(b.lastOpen);
        for (let i = Math.max(0, idx - 2); i < Math.min(seq.length, idx + 4); i++) {
          if (!result.includes(seq[i])) result.push(seq[i]);
        }
        return result.length ? result : seq.slice(0, 6);
      },
      getTargetHands() { return openHands(this.getActiveHands(), model); },
      getBoundary() { return boundaryForCategory('suitedKx'); },
      edgeMode: () => boundaryForCategory('suitedKx').continuous
    },
    {
      id: 'broadway',
      type: 'RANGE_HUNT',
      title: 'Broadway Edge',
      description: 'Отметь OPEN бродвейские и near-бродвейские руки.',
      shots: 0,
      getActiveHands() {
        return gradableHands([...getCanonicalBroadwayHands(), ...getNearBroadwayHands()], model);
      },
      getTargetHands() { return openHands(this.getActiveHands(), model); },
      getChallengeHands() { return this.getActiveHands(); },
      usesSubmit: true
    },
    {
      id: 'connectors-gappers',
      type: 'RANGE_HUNT',
      title: 'Suited connectors & gappers',
      description: 'Отметь OPEN одномастные коннекторы и гапперы.',
      shots: 0,
      getActiveHands() {
        return gradableHands([...getSuitedConnectorSequence(), ...getSuitedGapperSequence()], model);
      },
      getTargetHands() { return openHands(this.getActiveHands(), model); },
      getChallengeHands() { return this.getActiveHands(); },
      usesSubmit: true
    },
    {
      id: 'mixed-edges',
      type: 'MIXED_DECISIONS',
      title: 'Mixed Decisions',
      description: 'OPEN или FOLD для каждой руки?',
      shots: 5,
      getDecisions() {
        const hands = [];
        for (const cat of ['offsuitAx', 'suitedKx']) {
          const b = boundaryForCategory(cat);
          if (b.lastOpen) hands.push(b.lastOpen);
          if (b.firstFold) hands.push(b.firstFold);
        }
        const extra = ['QJo', 'QTo', 'JTo', 'T9s', '98s', '87s', '76s', 'T8s', '97s'];
        for (const h of extra) {
          if (isGradable(h, model) && !hands.includes(h)) hands.push(h);
        }
        return gradableHands(hands, model).slice(0, 5);
      },
      getActiveHands() { return this.getDecisions(); }
    },
    {
      id: 'final-battle',
      type: 'FINAL_BATTLE',
      title: 'Final Battle',
      description: 'OPEN или FOLD для каждой руки?',
      shots: 12,
      _cachedHands: null,
      getActiveHands() {
        if (!this._cachedHands) this._cachedHands = generateFinalBattleHands(model);
        return this._cachedHands;
      }
    }
  ];
}
