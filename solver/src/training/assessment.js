// Primary assessment (requirement P0). A short (~12-question) diagnostic built from
// validated library tasks. Produces an initial Player Skill Profile + leak profile.
// Selection is seeded per-user so two fresh profiles do not get identical task sets.

import { buildSkillProfile, skillsForConcept, normalizeSkill, SKILLS } from './skillProfile.js';
import { buildLeakProfile } from './leakProfile.js';
import { classifyErrorCause } from './errorCause.js';
import { loadTaskLibrary } from './taskLibraryBridge.js';
import { deriveSkillTags } from './planner.js';
import { seededRng } from './personalizationSeed.js';

// Legacy fixed pool kept for backward-compatible tests / grading references.
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

function isValidAssessmentTask(task) {
  if (!task || !task.id || !task.correct) return false;
  if (!Array.isArray(task.options) || task.options.length < 2) return false;
  if (!task.concept || task.difficulty == null || !task.street) return false;
  if (!task.options.includes(task.correct)) return false;
  return true;
}

function assessmentScoreFromDifficulty(difficulty) {
  const d = Number(difficulty) || 2;
  return Math.round(clamp(96 - d * 4, 60, 95));
}

function taskToAssessmentItem(task) {
  const skillTags = deriveSkillTags(task);
  const primarySkill = skillTags[0] || skillsForConcept(task.concept)[0] || 'preflop';
  return {
    id: task.id,
    skillTag: primarySkill,
    skillTags,
    concept: task.concept,
    street: task.street,
    q: task.question || task.q || `${task.position || ''} · ${task.concept || ''}`.trim(),
    choices: task.options.slice(),
    correct: task.correct,
    alsoOk: (task.alsoOk || []).slice(),
    score: assessmentScoreFromDifficulty(task.difficulty),
    difficulty: task.difficulty,
    position: task.position || null,
    heroStack: task.heroStack != null ? task.heroStack : null,
    tags: task.tags || []
  };
}

export function buildAssessmentEligiblePool(tasks = null) {
  const source = tasks || loadTaskLibrary();
  return source.filter(isValidAssessmentTask).map(taskToAssessmentItem);
}

let _eligibleCache = null;
export function getAssessmentEligiblePool() {
  if (!_eligibleCache) _eligibleCache = buildAssessmentEligiblePool();
  return _eligibleCache;
}

function primarySkillForItem(item) {
  if (item.skillTags && item.skillTags.length) return item.skillTags[0];
  return normalizeSkill(item.skillTag) || skillsForConcept(item.concept)[0] || null;
}

function pickFromPool(list, rng, usedIds) {
  const available = list.filter((item) => !usedIds.has(item.id));
  if (!available.length) return null;
  const idx = Math.floor(rng() * available.length);
  return available[idx];
}

export function buildAssessmentSet({
  pool = null,
  rng = Math.random,
  count = 12,
  personalizationSeed = null
} = {}) {
  const eligible = pool || getAssessmentEligiblePool();
  const random = personalizationSeed != null ? seededRng(personalizationSeed) : rng;

  const bySkill = {};
  for (const item of eligible) {
    const tags = item.skillTags && item.skillTags.length ? item.skillTags : [primarySkillForItem(item)].filter(Boolean);
    for (const skill of tags) {
      if (!SKILLS.includes(skill)) continue;
      (bySkill[skill] = bySkill[skill] || []).push(item);
    }
  }

  const chosen = [];
  const usedIds = new Set();
  const coveredSkills = new Set();

  for (const skill of REQUIRED_SKILLS) {
    if (chosen.length >= count) break;
    const list = bySkill[skill];
    if (!list || !list.length) continue;
    const pick = pickFromPool(list, random, usedIds);
    if (!pick) continue;
    usedIds.add(pick.id);
    chosen.push(pick);
    coveredSkills.add(skill);
  }

  const remaining = eligible
    .filter((item) => !usedIds.has(item.id))
    .sort((a, b) => {
      const aNew = (a.skillTags || []).filter((s) => !coveredSkills.has(s)).length;
      const bNew = (b.skillTags || []).filter((s) => !coveredSkills.has(s)).length;
      return bNew - aNew;
    });

  while (chosen.length < count && remaining.length) {
    const windowSize = Math.min(8, remaining.length);
    const start = Math.floor(random() * Math.max(1, remaining.length - windowSize + 1));
    const window = remaining.splice(start, windowSize);
    window.sort((a, b) => {
      const aNew = (a.skillTags || []).filter((s) => !coveredSkills.has(s)).length;
      const bNew = (b.skillTags || []).filter((s) => !coveredSkills.has(s)).length;
      return bNew - aNew;
    });
    const pick = window[0];
    if (!pick || usedIds.has(pick.id)) continue;
    usedIds.add(pick.id);
    chosen.push(pick);
    for (const s of (pick.skillTags || [])) coveredSkills.add(s);
  }

  return chosen.slice(0, count);
}

export function gradeAssessmentItem(item, choice) {
  if (!item) return { score: 0, correct: false };
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
  return { score, correct, nearOptimal, evLossBb, cause };
}

export function runAssessment({
  items = null,
  answers = [],
  pool = null,
  rng = Math.random,
  personalizationSeed = null,
  now = Date.now()
} = {}) {
  const set = items || buildAssessmentSet({ pool, rng, personalizationSeed });
  const results = [];
  for (const a of answers) {
    const item = set.find((i) => i.id === a.id)
      || (pool || getAssessmentEligiblePool()).find((i) => i.id === a.id)
      || ASSESSMENT_POOL.find((i) => i.id === a.id);
    if (!item) continue;
    const g = gradeAssessmentItem(item, a.choice);
    results.push({
      id: item.id,
      concept: item.concept,
      skillTag: item.skillTag,
      skillTags: item.skillTags || [item.skillTag].filter(Boolean),
      street: item.street,
      q: item.q,
      choice: a.choice,
      confidence: a.confidence != null ? a.confidence : null,
      score: g.score,
      correct: g.correct,
      nearOptimal: g.nearOptimal,
      evLossBb: g.evLossBb,
      cause: g.cause,
      at: now
    });
  }
  const assessed = buildSkillProfile({ assessment: { results }, now });

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

  return {
    version: 1,
    completedAt: now,
    answered: results.length,
    total: set.length,
    results,
    skillProfile: assessed,
    leakProfiles,
    overall: assessed.overall,
    overallLabel: assessed.overallLabel,
    weakestSkill: assessed.weakest ? assessed.weakest.skill : null,
    strongestSkill: assessed.strongest ? assessed.strongest.skill : null
  };
}

function choiceToType(choice) {
  const c = String(choice || '');
  if (c.includes('СТАВКА') || c.includes('ОЛЛ') || c.includes('РЕЙЗ')) return 'bet';
  if (c === 'КОЛЛ') return 'call';
  if (c === 'ЧЕК') return 'check';
  if (c === 'ФОЛД') return 'fold';
  return null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
