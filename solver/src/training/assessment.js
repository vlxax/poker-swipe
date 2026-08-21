// Primary assessment (P0). Placement Test V2 — adaptive 12–15 task MTT placement
// built from validated task-context library tasks with mini-app presentation.
// Produces initial Player Skill Profile + leak profile + recommended difficulty.

import { buildSkillProfile } from './skillProfile.js';
import { buildLeakProfile } from './leakProfile.js';
import { classifyErrorCause } from './errorCause.js';
import {
  getDiagnosticPool,
  diagnosticItemToAssessmentItem,
  validateDiagnosticItem,
  validateDiagnosticPool,
  getDiagnosticPoolSize
} from './diagnosticPool.js';
import {
  createPlacementSession,
  createPlacementSessionSeed,
  selectNextPlacementItem,
  submitPlacementAnswer,
  simulatePlacementRun,
  placementSessionSummary,
  placementEvidenceWeight,
  recommendedStartingDifficulty,
  PLACEMENT_COUNT_DEFAULT,
  PLACEMENT_COUNT_MIN,
  PLACEMENT_COUNT_MAX,
  getValidatedMttTasks,
  getPlacementPoolStats
} from './placementTestV2.js';
import { libraryTaskToPlacementItem } from './placementTaskAdapter.js';

export const DIAGNOSTIC_COUNT_DEFAULT = PLACEMENT_COUNT_DEFAULT;
export const DIAGNOSTIC_COUNT_MIN = PLACEMENT_COUNT_MIN;
export const DIAGNOSTIC_COUNT_MAX = PLACEMENT_COUNT_MAX;

export const PLACEMENT_TEST_V2 = true;

// Legacy fixed pool kept for backward-compatible grading references in old tests.
export const ASSESSMENT_POOL = [
  { id: 'A_RFI_BTN', skillTag: 'preflop', concept: 'open_range', street: 'ПРЕФЛОП', q: 'BTN · 30 ББ · до тебя фолд. A8s', choices: ['ФОЛД', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: [], score: 92 },
  { id: 'A_BB_DEF', skillTag: 'preflop', concept: 'defend_vs_open', street: 'ПРЕФЛОП', q: 'BB · K8s · BTN 2.2 ББ', choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ'], correct: 'КОЛЛ', alsoOk: ['3-БЕТ'], score: 88 },
  { id: 'A_3B', skillTag: 'preflop', concept: '3bet_frequency', street: 'ПРЕФЛОП', q: 'SB · A5s · CO 2.3 ББ', choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ'], correct: '3-БЕТ', alsoOk: [], score: 86 },
  { id: 'A_DRY_CBET', skillTag: 'postflop', concept: 'cbet_frequency', street: 'ФЛОП', q: 'BTN vs BB · A72 · QJs · BB чек', choices: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [], score: 90 },
  { id: 'A_DYN_CBET', skillTag: 'postflop', concept: 'cbet_frequency', street: 'ФЛОП', q: 'BTN vs BB · T98 · AQ · BB чек', choices: ['ЧЕК', 'СТАВКА'], correct: 'ЧЕК', alsoOk: ['СТАВКА'], score: 80 },
  { id: 'A_OVERBET_VS', skillTag: 'bluffCatch', concept: 'defend_vs_cbet', street: 'ФЛОП', q: 'BB · 76s · BTN ставит 125% · K72', choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'ФОЛД', alsoOk: [], score: 78 },
  { id: 'A_TURN_VALUE', skillTag: 'betSizing', concept: 'turn_barrel_sizing', street: 'ТЁРН', q: 'BTN · AQ · Q832 · BB чек', choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 75%', alsoOk: ['СТАВКА 33%'], score: 82 },
  { id: 'A_SHORT_PUSH', skillTag: 'shortStack', concept: 'fold_equity', street: 'ПРЕФЛОП', q: 'SB · 22 · 12 ББ', choices: ['ФОЛД', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: [], score: 74 },
  { id: 'A_THIN_VALUE', skillTag: 'river', concept: 'value_bet', street: 'РИВЕР', q: 'CO vs BB · KQ · K9522 · BB чек', choices: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: ['ЧЕК'], score: 76 },
  { id: 'A_BLUFFCATCH', skillTag: 'bluffCatch', concept: 'bluff_catch', street: 'РИВЕР', q: 'BB · KJ · K947A · BTN 140%', choices: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [], score: 72 },
  { id: 'A_RANGE_READ', skillTag: 'rangeReading', concept: 'range_advantage', street: 'ФЛОП', q: 'BTN vs BB · AQ · T98 · кто впереди?', choices: ['BB', 'BTN', 'РАВНО'], correct: 'BB', alsoOk: [], score: 70 },
  { id: 'A_ICM', skillTag: 'icm', concept: 'icm_pressure', street: 'ПРЕФЛОП', q: '5 left · баббл · short 6 ББ · BTN A7o', choices: ['ФОЛД', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['ФОЛД'], score: 65 }
];

export const REQUIRED_SKILLS = [
  'preflop', 'postflop', 'betSizing', 'shortStack', 'river', 'bluffing',
  'bluffCatch', 'icm', 'exploit', 'rangeReading', 'positionAwareness', 'stackDepthAwareness'
];

export function getPlacementEligiblePool() {
  return getValidatedMttTasks().map((t) => libraryTaskToPlacementItem(t));
}

export function getDiagnosticEligiblePool() {
  return getPlacementEligiblePool();
}

export function buildAssessmentEligiblePool() {
  return getPlacementEligiblePool();
}

export function getAssessmentEligiblePool() {
  return getPlacementEligiblePool();
}

export function evidenceWeight(item, grade) {
  const tier = item.difficulty || item.tier || 2;
  return placementEvidenceWeight(tier, grade);
}

export function gradeAssessmentItem(item, choice) {
  if (!item) return { score: 0, correct: false, nearOptimal: false, evLossBb: 0.5, cause: null, evidenceWeight: 0 };
  const correct = choice === item.correct;
  const nearOptimal = !correct && (item.alsoOk || []).includes(choice);
  const evLossBb = correct ? 0 : nearOptimal ? 0.08 : 0.5;
  const score = correct ? item.score : nearOptimal ? Math.round(item.score * 0.85) : Math.round(item.score * 0.3);
  const cause = classifyErrorCause({
    concept: item.concept,
    actionTaken: { type: choiceToType(choice) },
    recommendedAction: { type: choiceToType(item.correct) },
    sizingSensitive: /%/.test(choice) || /%/.test(item.correct),
    confidence: null
  });
  const weight = placementEvidenceWeight(item.tier || item.difficulty || 2, { correct, nearOptimal });
  return { score, correct, nearOptimal, evLossBb, cause, evidenceWeight: weight };
}

function resolveSessionSeed({ sessionSeed, diagnosticSessionSeed, personalizationSeed, rng } = {}) {
  if (diagnosticSessionSeed) return diagnosticSessionSeed;
  if (sessionSeed) return sessionSeed;
  if (personalizationSeed != null) return `pt2-${personalizationSeed}`;
  if (typeof rng === 'function') {
    const n = Math.floor(rng() * 1e9);
    return `pt2-${n}`;
  }
  return createPlacementSessionSeed();
}

export function buildAssessmentSet({
  pool = null,
  rng = Math.random,
  count = PLACEMENT_COUNT_DEFAULT,
  sessionSeed = null,
  diagnosticSessionSeed = null,
  personalizationSeed = null,
  answerFn = null
} = {}) {
  const seed = resolveSessionSeed({ sessionSeed, diagnosticSessionSeed, personalizationSeed, rng });
  const targetCount = clamp(Number(count) || PLACEMENT_COUNT_DEFAULT, PLACEMENT_COUNT_MIN, PLACEMENT_COUNT_MAX);
  const choose = answerFn || ((item) => item.correct);
  const { items } = simulatePlacementRun({
    sessionSeed: seed,
    targetCount,
    library: pool,
    answerFn: choose,
    gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
  });
  return items;
}

export function runAssessment({
  items = null,
  answers = [],
  pool = null,
  rng = Math.random,
  sessionSeed = null,
  diagnosticSessionSeed = null,
  personalizationSeed = null,
  session = null,
  now = Date.now()
} = {}) {
  const set = items || buildAssessmentSet({
    pool,
    rng,
    sessionSeed,
    diagnosticSessionSeed,
    personalizationSeed
  });

  const results = [];

  for (const a of answers) {
    const item = set.find((i) => i.id === a.id)
      || getPlacementEligiblePool().find((i) => i.id === a.id)
      || getDiagnosticPool().map(diagnosticItemToAssessmentItem).find((i) => i.id === a.id)
      || ASSESSMENT_POOL.find((i) => i.id === a.id);
    if (!item) continue;
    const g = gradeAssessmentItem(item, a.choice);
    const w = g.evidenceWeight;
    results.push({
      id: item.id,
      concept: item.concept,
      skillTag: item.skillTag,
      skillTags: item.skillTags || [item.skillTag].filter(Boolean),
      street: item.street,
      q: item.prompt || item.q,
      choice: a.choice,
      confidence: a.confidence != null ? a.confidence : null,
      score: g.score,
      correct: g.correct,
      nearOptimal: g.nearOptimal,
      evLossBb: g.evLossBb,
      cause: g.cause,
      evidenceWeight: w,
      difficulty: item.difficulty,
      tier: item.tier,
      category: item.category,
      miniAppMode: item.miniAppMode || null,
      at: now
    });
  }

  const assessed = buildSkillProfile({ assessment: { results }, now });
  const ability = session?.ability ?? estimateAbilityFromResults(results);
  const recDifficulty = recommendedStartingDifficulty({
    ability,
    overall: assessed.overall
  });

  const skillConfidence = buildSkillConfidence(results);
  const strongestAreas = rankSkillsByScore(assessed, 'desc').slice(0, 3);
  const weakestAreas = rankSkillsByScore(assessed, 'asc').slice(0, 3);

  const leakEvents = results
    .filter((r) => !r.correct)
    .map((r) => ({
      concept: r.concept,
      street: r.street,
      sourceHandId: 'assessment:' + r.id,
      candidateId: 'assessment:' + r.id,
      evLossBb: r.evLossBb,
      severity: r.evLossBb > 0.4 ? 'medium' : 'small',
      confidenceScore: r.confidence != null ? r.confidence / 100 : null,
      highConfidence: r.confidence != null && r.confidence >= 60,
      at: now
    }));

  const leakProfiles = {};
  for (const ev of leakEvents) {
    if (!leakProfiles[ev.concept]) leakProfiles[ev.concept] = buildLeakProfile({ concept: ev.concept, now });
    leakProfiles[ev.concept] = {
      ...leakProfiles[ev.concept],
      attempts: [...(leakProfiles[ev.concept].attempts || []), ev]
    };
  }

  const diagSummary = session ? placementSessionSummary(session) : summarizeFromResults(set, results);

  return {
    version: 3,
    placementVersion: 2,
    completedAt: now,
    answered: results.length,
    total: set.length,
    results,
    skillProfile: assessed,
    leakProfiles,
    overall: assessed.overall,
    overallLabel: assessed.overallLabel,
    weakestSkill: assessed.weakest ? assessed.weakest.skill : null,
    strongestSkill: assessed.strongest ? assessed.strongest.skill : null,
    skillConfidence,
    strongestAreas,
    weakestAreas,
    recommendedStartingDifficulty: recDifficulty,
    diagnosticSummary: diagSummary,
    placementSummary: diagSummary,
    sessionSeed: session?.sessionSeed || null
  };
}

function buildSkillConfidence(results) {
  const bySkill = {};
  for (const r of results) {
    const tags = r.skillTags && r.skillTags.length ? r.skillTags : [r.skillTag].filter(Boolean);
    for (const skill of tags) {
      if (!bySkill[skill]) bySkill[skill] = { weight: 0, correct: 0, total: 0 };
      const w = Math.abs(r.evidenceWeight || 1);
      bySkill[skill].weight += w;
      bySkill[skill].total += 1;
      if (r.correct || r.nearOptimal) bySkill[skill].correct += w;
    }
  }
  const out = {};
  for (const [skill, data] of Object.entries(bySkill)) {
    const rate = data.weight ? data.correct / data.weight : 0;
    const sampleFactor = Math.min(1, data.total / 3);
    out[skill] = round(0.2 + 0.8 * sampleFactor * (0.4 + 0.6 * rate), 3);
  }
  return out;
}

function rankSkillsByScore(profile, dir) {
  const skills = Object.values((profile && profile.skills) || {})
    .filter((s) => s && s.score != null)
    .sort((a, b) => dir === 'desc' ? (b.score - a.score) : (a.score - b.score));
  return skills.map((s) => ({ skill: s.skill, score: s.score, labelRu: s.labelRu }));
}

function estimateAbilityFromResults(results) {
  if (!results.length) return 50;
  let ability = 50;
  for (const r of results) {
    const diff = r.difficulty || r.tier || 2;
    if (r.correct) ability += diff * 3;
    else if (r.nearOptimal) ability += diff * 2;
    else ability -= diff * 4;
    ability = clamp(ability, 0, 100);
  }
  return ability;
}

function summarizeFromResults(set, results) {
  const tiers = results.map((r) => r.tier || r.difficulty || 2);
  const avgTier = tiers.length ? tiers.reduce((s, t) => s + t, 0) / tiers.length : 0;
  const advancedCount = results.filter((r) => (r.tier || r.difficulty || 0) >= 4).length;
  return {
    answered: results.length,
    targetCount: set.length,
    avgTier: round(avgTier, 2),
    advancedCount,
    advancedShare: results.length ? round(advancedCount / results.length, 3) : 0,
    itemIds: set.map((i) => i.id)
  };
}

function choiceToType(choice) {
  const c = String(choice || '');
  if (c.includes('СТАВКА') || c.includes('ОЛЛ') || c.includes('РЕЙЗ') || /^\d+%$/.test(c)) return 'bet';
  if (c === 'КОЛЛ') return 'call';
  if (c === 'ЧЕК') return 'check';
  if (c === 'ФОЛД') return 'fold';
  return null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// V2 aliases — controllers import these names
export const createDiagnosticSession = createPlacementSession;
export const createDiagnosticSessionSeed = createPlacementSessionSeed;
export const selectNextDiagnosticItem = selectNextPlacementItem;
export const submitDiagnosticAnswer = submitPlacementAnswer;
export const simulateDiagnosticRun = simulatePlacementRun;
export const diagnosticSessionSummary = placementSessionSummary;

export {
  createPlacementSession,
  createPlacementSessionSeed,
  selectNextPlacementItem,
  submitPlacementAnswer,
  simulatePlacementRun,
  placementSessionSummary,
  placementEvidenceWeight,
  validateDiagnosticItem,
  validateDiagnosticPool,
  getDiagnosticPoolSize,
  getPlacementPoolStats,
  PLACEMENT_COUNT_DEFAULT,
  PLACEMENT_COUNT_MIN,
  PLACEMENT_COUNT_MAX
};
