// Player Skill Profile (requirement P0). A per-skill score built from both
// analyzed EV mistakes and assessment answers. A skill is a high-level ability
// (preflop, postflop, betSizing, shortStack, river, bluffing, bluffCatch, icm,
// exploit, rangeReading, positionAwareness, stackDepthAwareness). Each skill
// carries score / sampleSize / confidence / recentTrend, and is computed from
// the same deterministic EV-loss evidence as the leak profile — never from
// hand results. Unknown evidence stays null (never invent a number).

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';

// Skill → the concept families (leak keys) that are evidence for that skill.
const SKILL_TO_CONCEPTS = {
  preflop: ['open_range', 'defend_vs_open', '3bet_frequency', '3bet_sizing', 'call_vs_3bet', '4bet_decision'],
  postflop: ['cbet_frequency', 'check_back', 'defend_vs_cbet', 'check_raise', 'range_advantage', 'nut_advantage'],
  betSizing: ['3bet_sizing', 'cbet_sizing', 'turn_barrel_sizing', 'river_sizing', 'overbet', 'sizing_efficiency'],
  shortStack: ['open_range', 'call_vs_3bet', 'fold_equity', 'push_fold'],
  river: ['value_bet', 'thin_value', 'bluff', 'bluff_catch', 'river_sizing', 'overbet', 'fold_vs_bet', 'blocker_selection'],
  bluffing: ['bluff', 'blocker_selection', 'blocker_usage', '3bet_frequency', 'polarization'],
  bluffCatch: ['bluff_catch', 'fold_vs_bet', 'price_defence', 'defend_vs_cbet'],
  icm: ['icm_pressure', 'icm_fold', 'icm_push', 'bubble'],
  exploit: ['exploit', 'opponent_exploit', 'adjustment', 'tilt_playing'],
  rangeReading: ['range_advantage', 'nut_advantage', 'equity_realization', 'range_reading', 'board_texture'],
  positionAwareness: ['position', 'rfi_position', 'open_range'],
  stackDepthAwareness: ['spr', 'pot_geometry', 'short_stack', 'stack_depth', 'push_fold']
};

const SKILLS = Object.keys(SKILL_TO_CONCEPTS);

export function skillLabelRu(skill) {
  return {
    preflop: 'Префлоп',
    postflop: 'Постфлоп',
    betSizing: 'Сайзинг',
    shortStack: 'Короткий стек',
    river: 'Ривер',
    bluffing: 'Блеф',
    bluffCatch: 'Блафф-кэтч',
    icm: 'ICM / баббл',
    exploit: 'Эксплойт',
    rangeReading: 'Чтение диапазонов',
    positionAwareness: 'Позиция',
    stackDepthAwareness: 'Глубина стеков'
  }[skill] || (skill || '—');
}

export function skillDefinitionRu(skill) {
  return {
    preflop: 'Открытие, защита BB, 3-беты и границы продолжения до флопа.',
    postflop: 'Решение на флопе: с-беты, чек-бэки, защита и чтение текстуры.',
    betSizing: 'Выбор размера ставки под текстуру, диапазон и геометрию.',
    shortStack: 'Игра на коротких и средних стеках: пуш/фолд и диапазоны.',
    river: 'Финальная улица: вэлью, тонкий вэлью, блеф и блафф-кэтч.',
    bluffing: 'Построение и исполнение блефов с учётом блокеров.',
    bluffCatch: 'Правильные коллы/фолды против ставок на ривере по цене.',
    icm: 'Турнирные решения на баббле и в зоне ITM/финального стола.',
    exploit: 'Адаптация под конкретного соперника и его статы.',
    rangeReading: 'Оценка чужого диапазона и преимущества по нему.',
    positionAwareness: 'Учёт позиции в открытии, защите и размерах.',
    stackDepthAwareness: 'Учёт SPR и глубины стеков в каждой линии.'
  }[skill] || '';
}

export function conceptsForSkill(skill) {
  return SKILL_TO_CONCEPTS[skill] || [];
}

// Deterministic mapping from a leak concept → the skills it is evidence for.
export function skillsForConcept(concept) {
  return SKILLS.filter((s) => (SKILL_TO_CONCEPTS[s] || []).includes(concept));
}

// Map street/tag heuristics to skills for evidence that lacks a concept (e.g.
// assessment items tagged by skill directly).
export function normalizeSkill(skill) {
  const key = String(skill || '').toLowerCase();
  const map = {
    pre: 'preflop', preflop: 'preflop', pf: 'preflop',
    post: 'postflop', postflop: 'postflop',
    size: 'betSizing', sizing: 'betSizing', betsizing: 'betSizing',
    short: 'shortStack', shortstack: 'shortStack', sstack: 'shortStack',
    river: 'river',
    bluff: 'bluffing', bluffing: 'bluffing', bluf: 'bluffing',
    bluffcatch: 'bluffCatch', bluff_catch: 'bluffCatch',
    icm: 'icm', bubble: 'icm',
    exploit: 'exploit', exploitive: 'exploit',
    range: 'rangeReading', ranger: 'rangeReading', rangereading: 'rangeReading',
    position: 'positionAwareness', pos: 'positionAwareness', positionawareness: 'positionAwareness',
    stack: 'stackDepthAwareness', depth: 'stackDepthAwareness', spr: 'stackDepthAwareness', stackdepthawareness: 'stackDepthAwareness'
  };
  return map[key] || null;
}

// ---- Per-skill evidence model -------------------------------------------------

export function createSkillEvidence({ skill, now = Date.now() } = {}) {
  return {
    skill,
    sampleSize: 0,
    mistakes: 0,
    totalEvLossBb: 0,
    avgEvLossBb: 0,
    highConfidenceMistakes: 0,
    score: null,          // 0..100, null until enough samples
    confidence: 0,        // 0..1 based on sample + solver confidence
    recentTrend: 'stable',
    lastSeenAt: now,
    attempts: []          // rolling { evLossBb, grade, at, confidenceScore, skillTag }
  };
}

const SCORE_MIN_SAMPLE = 3;

// Score = 100 - normalized EV loss, blended with the answer quality rate. Mirrors
// the mastery formula in progress.js so the two stay consistent.
export function scoreFromEvidence(ev) {
  const attempts = (ev && ev.attempts) || [];
  if (!attempts.length) return null;
  const evQuality = clamp(1 - (ev.avgEvLossBb || 0) / 1.0, 0, 1);
  const nearOptimal = attempts.filter((a) => a.evLossBb != null && a.evLossBb <= 0.05).length;
  const decisionQuality = nearOptimal / attempts.length;
  const score = 100 * clamp(0.6 * evQuality + 0.4 * decisionQuality, 0, 1);
  return Math.round(score);
}

export function scoredSkillFromEvidence(ev) {
  if (!ev || !ev.sampleSize) return null;
  const raw = scoreFromEvidence(ev);
  if (raw == null) return null;
  if (ev.sampleSize < SCORE_MIN_SAMPLE) {
    const prior = 55;
    const weight = ev.sampleSize / SCORE_MIN_SAMPLE;
    return Math.round(prior * (1 - weight) + raw * weight);
  }
  return raw;
}

// Confidence grows with sample size and the solver's own confidence. Never
// confident on a tiny sample.
export function confidenceFromEvidence(ev) {
  const n = (ev && ev.sampleSize) || 0;
  if (!n) return 0;
  const sampleFactor = Math.min(1, n / 12);
  const avgSolverConf = (ev && ev.attempts && ev.attempts.length)
    ? ev.attempts.reduce((s, a) => s + (a.confidenceScore != null ? a.confidenceScore : 0), 0) / ev.attempts.length
    : 0;
  return clamp(0.25 + 0.75 * sampleFactor * (0.5 + 0.5 * avgSolverConf), 0, 1);
}

export function trendFromEvidence(ev) {
  const attempts = (ev && ev.attempts) || [];
  if (attempts.length < 4) return 'stable';
  const half = Math.max(1, Math.floor(attempts.length / 2));
  const first = attempts.slice(0, half);
  const last = attempts.slice(-half);
  const fAvg = avgLoss(first);
  const lAvg = avgLoss(last);
  return fAvg - lAvg > 0.05 ? 'improving' : fAvg - lAvg < -0.05 ? 'worsening' : 'stable';
}

export function recordSkillEvidence(ev, { evLossBb = 0, grade = null, confidenceScore = null, at = Date.now() } = {}) {
  const e = ev || createSkillEvidence({});
  const loss = Number.isFinite(Number(evLossBb)) ? Math.max(0, Number(evLossBb)) : 0;
  const attempts = (e.attempts || []).slice();
  attempts.push({ evLossBb: loss, grade: grade || null, confidenceScore, at });
  e.attempts = attempts.slice(-60);

  e.sampleSize = attempts.length;
  e.mistakes = attempts.filter((a) => a.evLossBb > 0.0005).length;
  e.totalEvLossBb = round(attempts.reduce((s, a) => s + a.evLossBb, 0), 4);
  e.avgEvLossBb = e.sampleSize ? round(e.totalEvLossBb / e.sampleSize, 4) : 0;
  e.highConfidenceMistakes = attempts.filter((a) => a.evLossBb > 0.0005 && (a.confidenceScore == null || a.confidenceScore >= 0.6)).length;
  e.score = scoredSkillFromEvidence(e);
  e.confidence = confidenceFromEvidence(e);
  e.recentTrend = trendFromEvidence(e);
  if (at != null) e.lastSeenAt = at;
  return e;
}

// ---- Building the full profile ------------------------------------------------

export function evidenceToSkillEntry(ev, skill) {
  return {
    skill,
    labelRu: skillLabelRu(skill),
    score: ev.score,
    confidence: round(ev.confidence, 3),
    confidenceLabel: confidenceLabel(ev.confidence),
    sampleSize: ev.sampleSize,
    recentTrend: ev.recentTrend,
    avgEvLossBb: ev.avgEvLossBb
  };
}

export function finalizeSkillProfile(bySkill, now = Date.now()) {
  const skills = {};
  for (const s of SKILLS) {
    if (!bySkill[s]) continue;
    skills[s] = evidenceToSkillEntry(bySkill[s], s);
  }

  const present = Object.values(skills).filter((s) => s.sampleSize > 0);
  const scored = present.filter((s) => s.score != null);
  const overall = scored.length
    ? Math.round(scored.reduce((sum, x) => sum + x.score, 0) / scored.length)
    : null;

  return {
    version: 1,
    skills,
    overall,
    overallLabel: overall != null ? overallLabel(overall) : null,
    sampleSize: present.reduce((sum, x) => sum + x.sampleSize, 0),
    confidence: present.length ? round(present.reduce((sum, x) => sum + x.confidence, 0) / present.length, 3) : 0,
    updatedAt: now,
    weakest: [...Object.values(skills)].sort((a, b) => (a.score ?? 999) - (b.score ?? 999))[0] || null,
    strongest: [...Object.values(skills)].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] || null
  };
}

export function recordSkillEvidenceForTags(bySkill, skillTags, payload, now = Date.now()) {
  const tags = [...new Set((skillTags || []).filter(Boolean))];
  for (const skill of tags) {
    if (!bySkill[skill]) bySkill[skill] = createSkillEvidence({ skill, now });
    recordSkillEvidence(bySkill[skill], { ...payload, at: payload.at != null ? payload.at : now });
  }
  return bySkill;
}

export function mergeStoredSkillEvidence(bySkill, stored = {}, now = Date.now()) {
  for (const [skill, ev] of Object.entries(stored || {})) {
    if (!ev || !SKILLS.includes(skill)) continue;
    if (!bySkill[skill]) bySkill[skill] = createSkillEvidence({ skill, now });
    for (const attempt of (ev.attempts || [])) {
      recordSkillEvidence(bySkill[skill], attempt);
    }
  }
  return bySkill;
}

export function updateSkillProfileInStore(store, {
  skillTags = [],
  evLossBb = 0,
  grade = null,
  confidenceScore = null,
  now = Date.now()
} = {}) {
  if (!store || typeof store.loadSkillEvidence !== 'function') return null;
  const stored = store.loadSkillEvidence() || {};
  const bySkill = {};
  mergeStoredSkillEvidence(bySkill, stored, now);
  recordSkillEvidenceForTags(bySkill, skillTags, { evLossBb, grade, confidenceScore, at: now }, now);

  const nextStored = { ...stored };
  for (const skill of skillTags) {
    if (bySkill[skill]) nextStored[skill] = bySkill[skill];
  }
  store.saveSkillEvidence(nextStored);

  const assessment = typeof store.loadAssessment === 'function' ? store.loadAssessment() : null;
  const leakProfiles = typeof store.listProfiles === 'function' ? store.listProfiles() : [];
  const profile = buildSkillProfile({
    storedEvidence: nextStored,
    now
  });
  if (typeof store.saveSkillProfile === 'function') store.saveSkillProfile(profile);
  return profile;
}

// From leak profiles (concept → leakProfile) aggregate per-skill evidence.
export function buildSkillProfile({ leakProfiles = [], assessment = null, storedEvidence = null, now = Date.now() } = {}) {
  const bySkill = {};
  const init = (s) => { if (!bySkill[s]) bySkill[s] = createSkillEvidence({ skill: s, now }); };
  const hasStored = storedEvidence && Object.keys(storedEvidence).length > 0;

  if (hasStored) {
    mergeStoredSkillEvidence(bySkill, storedEvidence, now);
  } else {
    for (const prof of (leakProfiles || [])) {
      if (!prof || !prof.concept) continue;
      const skills = skillsForConcept(prof.concept);
      for (const skill of skills) {
        init(skill);
        for (const attempt of (prof.attempts || [])) {
          recordSkillEvidence(bySkill[skill], {
            evLossBb: attempt.evLossBb,
            confidenceScore: attempt.confidenceScore,
            at: attempt.at != null ? attempt.at : now
          });
        }
      }
    }

    if (assessment && assessment.results) {
      for (const item of assessment.results) {
        const tags = item.skillTags && item.skillTags.length
          ? item.skillTags
          : [normalizeSkill(item.skillTag) || skillsForConcept(item.concept)[0]].filter(Boolean);
        const loss = (item.evLossBb != null) ? item.evLossBb : (item.correct === true ? 0 : 0.35);
        recordSkillEvidenceForTags(bySkill, tags, {
          evLossBb: loss,
          grade: item.grade || null,
          confidenceScore: item.confidence != null ? item.confidence / 100 : null,
          at: item.at != null ? item.at : now
        }, now);
      }
    }
  }

  return finalizeSkillProfile(bySkill, now);
}

export function seedSkillEvidenceFromAssessment(store, assessmentResult, now = Date.now()) {
  if (!store || !assessmentResult || !assessmentResult.results) return null;
  const stored = typeof store.loadSkillEvidence === 'function' ? (store.loadSkillEvidence() || {}) : {};
  const bySkill = {};
  mergeStoredSkillEvidence(bySkill, stored, now);
  for (const item of assessmentResult.results) {
    const tags = item.skillTags && item.skillTags.length
      ? item.skillTags
      : [normalizeSkill(item.skillTag) || skillsForConcept(item.concept)[0]].filter(Boolean);
    const loss = (item.evLossBb != null) ? item.evLossBb : (item.correct === true ? 0 : 0.35);
    recordSkillEvidenceForTags(bySkill, tags, {
      evLossBb: loss,
      grade: item.correct ? 'GOOD' : 'MISTAKE',
      confidenceScore: item.confidence != null ? item.confidence / 100 : null,
      at: item.at != null ? item.at : now
    }, now);
  }
  if (typeof store.saveSkillEvidence === 'function') store.saveSkillEvidence(bySkill);
  return bySkill;
}

export function overallLabel(score) {
  if (score == null) return null;
  if (score >= 86) return 'СИЛЬНЫЙ СТАРТ';
  if (score >= 74) return 'РЕГОВЫЙ УРОВЕНЬ';
  if (score >= 60) return 'КЛУБНЫЙ РЕГ';
  if (score >= 45) return 'НЕСТАБИЛЬНАЯ БАЗА';
  return 'БАЗУ НАДО СОБИРАТЬ';
}

export function confidenceLabel(c) {
  if (c >= 0.7) return 'высокая';
  if (c >= 0.4) return 'средняя';
  if (c > 0) return 'низкая';
  return 'нет данных';
}

// A stable id for the whole profile (for caching / comparisons).
export function skillProfileId(profile) {
  const parts = Object.keys((profile && profile.skills) || {})
    .sort()
    .map((s) => `${s}:${profile.skills[s].score ?? 'n'}:${profile.skills[s].sampleSize}`)
    .join('|');
  return stableHash(parts);
}

function avgLoss(list) {
  if (!list.length) return 0;
  return list.reduce((s, a) => s + a.evLossBb, 0) / list.length;
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export { SKILLS, SKILL_TO_CONCEPTS, SCORE_MIN_SAMPLE };