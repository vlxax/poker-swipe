// Training Planner (requirement P0). Composes the Spot Selection Engine with the
// leak / skill profiles and the concept library to produce a concrete session:
// which concepts to drill, at what adaptive difficulty, with spaced repetition,
// mastery gating, exploration/challenge/control spots and a session goal. Pure
// and deterministic given the same inputs, so it is unit-testable.

import { selectSpots, normalizeSpot, adaptiveDifficulty, conceptDue } from './spotSelector.js';
import { skillLabelRu } from './skillProfile.js';
import { errorCauseLabelRu } from './errorCause.js';
import { stableHash } from '../integration/pokerSwipeHandAdapter.js';

const DEFAULTS = {
  count: 7,
  weaknessShare: 0.6,     // 60–70% weak
  maintenanceShare: 0.25, // 20–30% strong maintenance
  explorationShare: 0.1,  // 10–15% exploration/challenge
  masteryGate: 78
};

// Turn a concept library (task-context tasks) into selector pool entries.
export function poolFromLibrary(tasks = []) {
  return (tasks || []).map((t) => normalizeSpot({
    id: t.id,
    concept: t.concept,
    street: normalizeStreet(t.street),
    difficulty: t.difficulty || 1,
    skillTags: deriveSkillTags(t),
    format: t.format,
    stage: t.stage,
    position: t.position,
    stackDepth: t.heroStack != null ? stackBucket(t.heroStack) : null,
    decisionType: t.actions && t.actions.length ? decisionType(t.actions, t.correct) : null,
    theoryOrExploit: t.tags && t.tags.some((x) => /эксплойт|exploit/.test(String(x))) ? 'exploit' : 'theory',
    icmPressure: t.stage ? icmPressure(t.stage) : 0,
    opponentType: t.opp && t.opp.name ? t.opp.name : null
  }));
}

// Build the daily session plan: concept order + spot ids + difficulty + goal.
export function buildDailyPlan({
  pool = [],
  progressByConcept = {},
  history = [],              // [{ concept, at }]
  recentResults = [],        // [{ concept, grade, nearOptimal }]
  skillProfile = null,
  count = DEFAULTS.count,
  now = Date.now(),
  rng = Math.random
} = {}) {
  const spots = pool.length ? pool : poolFromLibrary(globalThis.__POKERSWIPE_LIBRARY || []);
  const shownAt = buildShownAt(history);

  // Spaced repetition: drop concepts that are not due yet (unless nothing else).
  const dueConcepts = new Set();
  for (const spot of spots) {
    const last = history.filter((h) => h.concept === spot.concept).at(-1);
    const progress = progressByConcept[spot.concept];
    const mastery = progress && progress.masteryScore != null ? progress.masteryScore : null;
    if (conceptDue({
      lastSeenAt: last ? last.at : null,
      mastery,
      now
    })) dueConcepts.add(spot.concept);
  }
  const eligiblePool = spots.filter((s) => dueConcepts.has(s.concept) || dueConcepts.size === 0);

  const result = selectSpots({
    pool: eligiblePool,
    shownAt,
    history,
    progressByConcept,
    recentResults,
    skillProfile,
    count,
    now,
    masteryGate: DEFAULTS.masteryGate
  });

  // Resolve full spot objects for the selected ids.
  const idToSpot = new Map(spots.map((s) => [s.id, s]));
  const selectedSpots = result.selected.map((id) => idToSpot.get(id)).filter(Boolean);

  const plan = {
    sessionId: stableHash(`${now}|${result.selected.join(',')}`),
    total: count,
    filled: selectedSpots.length,
    spots: selectedSpots,
    conceptOrder: unique(selectedSpots.map((s) => s.concept)),
    primaryConcept: result.goal && result.goal.concept ? result.goal.concept : (selectedSpots[0] && selectedSpots[0].concept) || null,
    targetDifficulty: result.targetDifficulty,
    goal: result.goal,
    earliestMeaningful: result.earliestMeaningful,
    adaptiveDifficulty: result.targetDifficulty,
    reason: result.reason,
    buckets: result.buckets
  };
  plan.personalized = plan.filled > 0 && (plan.primaryConcept != null || (skillProfile && skillProfile.overall != null));
  return plan;
}

// A Russian summary of the plan (for the session-start screen).
export function planSummaryRu(plan) {
  if (!plan || !plan.filled) return 'Пока нечего тренировать — собери больше раздач в «Моих руках».';
  const parts = [];
  if (plan.goal && plan.goal.copyRu) parts.push(plan.goal.copyRu);
  parts.push(`Спотов: ${plan.filled}. Сложность: ${plan.targetDifficulty != null ? plan.targetDifficulty.toFixed(1) + ' / 5' : '—'}.`);
  if (plan.primaryConcept) parts.push(`Главная концепция: ${plan.primaryConcept}.`);
  return parts.join(' ');
}

// ---- helpers ---------------------------------------------------------------

function buildShownAt(history) {
  const shown = {};
  let total = 0;
  for (const h of history || []) {
    total++;
    const k = h.spotId || h.id || h.concept;
    if (!k) continue;
    // approximate "shown N ago" via running count.
    if (!shown[k]) shown[k] = { countAgo: total };
  }
  return shown;
}

function unique(arr) { return [...new Set(arr)]; }

function normalizeStreet(s) {
  return String(s || '').toLowerCase();
}

function stackBucket(bb) {
  if (bb <= 12) return 'short';
  if (bb <= 40) return 'mid';
  return 'deep';
}

function decisionType(actions, correct) {
  const c = String(correct || '');
  if (c.includes('РЕЙЗ') || c.includes('3-БЕТ') || c.includes('4-БЕТ')) return 'raise';
  if (c.includes('ОЛЛ')) return 'all_in';
  if (c.includes('КОЛЛ')) return 'call';
  if (c.includes('ЧЕК')) return 'check';
  if (c.includes('ФОЛД')) return 'fold';
  if (c.includes('СТАВКА')) return 'bet';
  return null;
}

function icmPressure(stage) {
  const s = String(stage || '');
  if (s.includes('БАББЛ') || s.includes('BUBBLE')) return 1;
  if (s.includes('ФИНАЛЬНЫЙ') || s.includes('ITM')) return 0.7;
  if (s.includes('ПОЗДНЯЯ')) return 0.4;
  return 0;
}

// Derive skill tags from a task's concept + tags (best-effort keyword match).
const CONCEPT_TO_SKILL = {
  'rfi': 'preflop', 'префлоп': 'preflop', 'defence': 'preflop', '3-bet': 'preflop', '3-бет': 'preflop',
  '4-bet': 'preflop', 'squeeze': 'preflop', 'push': 'shortStack', 'push-fold': 'shortStack',
  'c-bet': 'postflop', 'с-бет': 'postflop', 'check': 'postflop', 'флоп': 'postflop',
  'bluff': 'bluffing', 'блеф': 'bluffing', 'bluffcatch': 'bluffCatch',
  'value': 'betSizing', 'sizing': 'betSizing', 'сайзинг': 'betSizing', 'overbet': 'betSizing',
  'icm': 'icm', 'баббл': 'icm', 'bubble': 'icm', 'exploit': 'exploit', 'эксплойт': 'exploit'
};
function deriveSkillTags(t) {
  const tags = [];
  const concat = [t.concept, ...(t.tags || [])].map((x) => String(x || '').toLowerCase()).join(' ');
  for (const [key, skill] of Object.entries(CONCEPT_TO_SKILL)) {
    if (concat.includes(key) && !tags.includes(skill)) tags.push(skill);
  }
  return tags;
}

export { DEFAULTS, skillLabelRu, errorCauseLabelRu };