// Normalize legacy inline mini-app content into selector spots.

import { normalizeSpot } from '../solver/src/training/spotSelector.js';
import { deriveSkillTags } from '../solver/src/training/planner.js';

const STREET_MAP = {
  'ПРЕФЛОП': 'preflop', 'ФЛОП': 'flop', 'ТЁРН': 'turn', 'РИВЕР': 'river',
  PRE: 'preflop', FLOP: 'flop', TURN: 'turn', RIVER: 'river'
};

function streetKey(s) {
  const k = String(s || '').toUpperCase();
  return STREET_MAP[k] || String(s || '').toLowerCase();
}

function pseudoTask(item, extra = {}) {
  return {
    id: item.id,
    concept: item.concept,
    street: item.street,
    tags: item.tags || [],
    position: item.pos || item.position,
    heroStack: item.stack || item.heroStack,
    ...extra
  };
}

export function legacySizingToSpot(item) {
  return normalizeSpot({
    id: item.id,
    concept: item.concept,
    street: streetKey(item.street),
    difficulty: 2,
    skillTags: deriveSkillTags(pseudoTask(item, { tags: ['sizing', 'сайзинг'] })),
    stackDepth: item.pot > 20 ? 'deep' : 'mid',
    decisionType: 'bet',
    theoryOrExploit: 'theory',
    _legacy: { type: 'sizing', item }
  });
}

export function legacyReviewToSpot(item) {
  return normalizeSpot({
    id: item.id,
    concept: item.concept,
    street: 'river',
    difficulty: item.bad == null ? 1 : 3,
    skillTags: deriveSkillTags(pseudoTask(item, { tags: ['review', 'line'] })),
    decisionType: 'bet',
    theoryOrExploit: 'theory',
    _legacy: { type: 'review', item }
  });
}

export function legacySwipeToSpot(item) {
  return normalizeSpot({
    id: item.id,
    concept: item.concept,
    street: streetKey(item.street),
    difficulty: 2,
    skillTags: deriveSkillTags(pseudoTask(item)),
    position: item.pos,
    stackDepth: (item.stack || 30) <= 15 ? 'short' : (item.stack || 30) <= 40 ? 'mid' : 'deep',
    decisionType: null,
    theoryOrExploit: 'theory',
    _legacy: { type: 'swipe', item }
  });
}

export function legacyXrayToSpot(item, index) {
  const id = `XR_${index}`;
  return normalizeSpot({
    id,
    concept: 'range narrowing',
    street: 'river',
    difficulty: 3,
    skillTags: ['rangeReading', 'postflop', 'bluffCatch', 'betSizing'],
    decisionType: null,
    theoryOrExploit: 'theory',
    _legacy: { type: 'xray', item, index }
  });
}

export function buildLegacyPool({ sizing = [], reviews = [], swipe = [], xray = [] } = {}) {
  const spots = [];
  for (const s of sizing) spots.push(legacySizingToSpot(s));
  for (const r of reviews) spots.push(legacyReviewToSpot(r));
  for (const w of swipe) spots.push(legacySwipeToSpot(w));
  xray.forEach((x, i) => spots.push(legacyXrayToSpot(x, i)));
  return spots;
}
