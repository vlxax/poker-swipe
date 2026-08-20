// Primary assessment (requirement P0). A short (~12-question) diagnostic pool
// with variants. It produces an initial Player Skill Profile + initial leak
// profile + confidence, so the product can personalise from the very first
// session without a full analyzed-hand history. Deterministic: the same choices
// always produce the same profile. Answers are graded on a 0..100 scale where
// the optimal line is 100 and near-alternatives are lower but not zero.

import { buildSkillProfile, skillsForConcept, normalizeSkill } from './skillProfile.js';
import { buildLeakProfile } from './leakProfile.js';
import { classifyErrorCause } from './errorCause.js';

// Assessment items reference decision spots. `correct` is the best line; a small
// `alsoOk` set holds near-optimal alternatives. skillTag drives the skill profile.
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

// Cover all skills at least once; pad with repeats for the weakest.
const REQUIRED_SKILLS = ['preflop', 'postflop', 'betSizing', 'shortStack', 'river', 'bluffing', 'bluffCatch', 'icm', 'exploit', 'rangeReading', 'positionAwareness', 'stackDepthAwareness'];

export function buildAssessmentSet({ pool = ASSESSMENT_POOL, rng = Math.random, count = 12 } = {}) {
  // Start with one item per covered skill, then fill with variety.
  const bySkill = {};
  for (const item of pool) {
    const skill = normalizeSkill(item.skillTag) || skillsForConcept(item.concept)[0] || null;
    if (skill) (bySkill[skill] = bySkill[skill] || []).push(item);
  }
  const chosen = [];
  const usedIds = new Set();
  const skills = REQUIRED_SKILLS.filter((s) => bySkill[s] && bySkill[s].length);
  for (const s of skills) {
    const list = bySkill[s];
    const pick = list[Math.floor(rng() * list.length)];
    if (usedIds.has(pick.id)) continue;
    usedIds.add(pick.id);
    chosen.push(pick);
  }
  // Fill the remainder from unused items (no duplicates).
  for (const item of pool) {
    if (chosen.length >= count) break;
    if (usedIds.has(item.id)) continue;
    usedIds.add(item.id);
    chosen.push(item);
  }
  return chosen.slice(0, count);
}

// Grade one assessment choice → { score, correct, nearOptimal, evLossBb, cause }.
export function gradeAssessmentItem(item, choice) {
  if (!item) return { score: 0, correct: false };
  const correct = choice === item.correct;
  const nearOptimal = !correct && (item.alsoOk || []).includes(choice);
  // EV loss scaled from the item's design: optimal = 0, near = small, else larger.
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

// Run a full assessment → skill profile + leak profile + summary.
export function runAssessment({
  items = null,
  answers = [],          // [{ id, choice, confidence }]
  pool = ASSESSMENT_POOL,
  rng = Math.random,
  now = Date.now()
} = {}) {
  const set = items || buildAssessmentSet({ pool, rng });
  const results = [];
  for (const a of answers) {
    const item = set.find((i) => i.id === a.id) || pool.find((i) => i.id === a.id);
    if (!item) continue;
    const g = gradeAssessmentItem(item, a.choice);
    results.push({
      id: item.id,
      concept: item.concept,
      skillTag: item.skillTag,
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

  // Initial leak profile from wrong answers (each wrong item → a small leak event).
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

export { REQUIRED_SKILLS };