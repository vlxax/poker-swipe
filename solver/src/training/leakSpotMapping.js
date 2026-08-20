// Maps detected leak concepts and weak skills to task-library spot metadata.
// Only uses matchers supported by normalized spot fields (concept, street, tags,
// skillTags, icmPressure, decisionType, position, stage). No invented categories.

import { skillsForConcept } from './skillProfile.js';

function haystack(spot) {
  const parts = [
    spot.concept,
    spot.street,
    spot.stage,
    spot.decisionType,
    spot.theoryOrExploit,
    ...(spot.skillTags || []),
    spot.positions && spot.positions.hero,
    spot.opponentType
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function includesAny(text, needles) {
  return needles.some((n) => text.includes(n));
}

// Leak concept → spot relevance test (task metadata only).
export const LEAK_SPOT_MATCHERS = {
  bluff_catch: (s) => includesAny(haystack(s), ['bluffcatch', 'bluff catch', 'bluff-catch', 'price defence', 'price defense', 'блеф-кетч', 'bluffcatch maniac']),
  fold_vs_bet: (s) => includesAny(haystack(s), ['overbet fold', 'fold vs', 'give up', 'фолд']) && (s.street === 'river' || includesAny(haystack(s), ['ривер', 'river'])),
  thin_value: (s) => includesAny(haystack(s), ['thin value', 'тонкое значение', 'тонк']),
  value_bet: (s) => includesAny(haystack(s), ['value', 'ценность', 'tptk']) && !includesAny(haystack(s), ['thin', 'тонк']),
  bluff: (s) => includesAny(haystack(s), ['bluff', 'блеф', 'semibluff', 'semi-bluff', 'полублеф']) && s.street !== 'preflop',
  defend_vs_open: (s) => includesAny(haystack(s), ['bb defence', 'bb defend', 'bb vs', 'защита bb', 'ante defence', 'pko defend']) ||
    (s.positions && s.positions.hero === 'BB' && s.street === 'preflop'),
  cbet_frequency: (s) => includesAny(haystack(s), ['c-bet', 'cbet', 'с-бет', 'dry board']),
  cbet_sizing: (s) => includesAny(haystack(s), ['sizing', 'сайзинг', 'overbet']),
  second_barrel: (s) => includesAny(haystack(s), ['barrel', 'баррел']),
  turn_barrel_sizing: (s) => includesAny(haystack(s), ['turn', 'тёрн', 'barrel']),
  icm_pressure: (s) => (s.icmPressure || 0) > 0.3,
  bubble: (s) => (s.icmPressure || 0) >= 0.5 || includesAny(haystack(s), ['bubble', 'баббл', 'icm']),
  open_range: (s) => includesAny(haystack(s), ['rfi', 'open', 'оупен', 'iso-raise']),
  '3bet_frequency': (s) => includesAny(haystack(s), ['3-bet', '3bet', '3-бет', 'squeeze', 'сквиз']),
  overbet: (s) => includesAny(haystack(s), ['overbet', 'овербет']),
  exploit: (s) => s.theoryOrExploit === 'exploit' || includesAny(haystack(s), ['exploit', 'эксплойт', 'nit', 'station', 'maniac', 'любитель'])
};

// Behavioral patterns described in product docs → leak concepts we can match.
export const BEHAVIORAL_LEAK_ALIASES = {
  overfold: ['bluff_catch', 'fold_vs_bet', 'defend_vs_cbet'],
  overcall: ['fold_vs_bet', 'bluff_catch', 'river_sizing'],
  underbluff: ['bluff', 'second_barrel', 'turn_barrel_sizing'],
  missedThinValue: ['thin_value', 'value_bet'],
  underDefendBB: ['defend_vs_open', 'defend_vs_cbet'],
  icmLeak: ['icm_pressure', 'bubble']
};

export function spotMatchesLeakConcept(spot, leakConcept) {
  const matcher = LEAK_SPOT_MATCHERS[leakConcept];
  if (matcher) return matcher(spot);
  // Fall back: leak concept's skills overlap spot skillTags.
  const skills = skillsForConcept(leakConcept);
  if (!skills.length) return false;
  return (spot.skillTags || []).some((t) => skills.includes(t));
}

export function leakBoostForSpot(spot, leakPriorities = []) {
  let boost = 0;
  for (const { concept, priority } of leakPriorities) {
    if (!concept || !priority) continue;
    if (spotMatchesLeakConcept(spot, concept)) boost += priority;
    const aliases = BEHAVIORAL_LEAK_ALIASES[concept];
    if (aliases) {
      for (const alias of aliases) {
        if (spotMatchesLeakConcept(spot, alias)) boost += priority * 0.5;
      }
    }
  }
  return boost;
}

export function weakSkillBoost(spot, skillProfile) {
  if (!skillProfile || !skillProfile.skills) return 0;
  let boost = 0;
  for (const tag of spot.skillTags || []) {
    const sk = skillProfile.skills[tag];
    if (!sk || sk.score == null) continue;
    if (sk.score < 65) boost += (65 - sk.score) / 65;
  }
  return boost;
}

export function maintenanceSkillMatch(spot, skillProfile, gate = 74) {
  if (!skillProfile || !skillProfile.skills) return false;
  return (spot.skillTags || []).some((tag) => {
    const sk = skillProfile.skills[tag];
    return sk && sk.score != null && sk.score >= gate;
  });
}

export function conceptLabelForPlan(spot) {
  if (!spot) return null;
  const c = String(spot.concept || '').trim();
  if (!c) return null;
  return c.length > 40 ? c.slice(0, 40) : c;
}
