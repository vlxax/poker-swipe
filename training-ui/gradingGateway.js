/**
 * Browser-safe canonical grading gateway.
 *
 * ONE production entry for general decision UIs. Routes to existing engines;
 * does not duplicate grading logic and does not import Strategy Map / fs.
 *
 *   swipe | sizing | quick | daily-legacy | d25 | myhands
 *     → solver/src/api/modeAdapters.js → unifiedGrading.js → PokerBrain
 *       (PREFLOP trainer overlay already patches PokerBrain)
 *   daily (personalized drills)
 *     → solver/src/training/answerEvaluator.js gradeAnswer
 *   assessment
 *     → solver/src/training/assessment.js gradeAssessmentItem
 *
 * Range / Battleship / narrowing keep attemptFromBattleshipTap /
 * attemptsFromNarrowingGrade. They are not routed through this gateway.
 *
 * Schema of gradeDecision() return value:
 *   ok, mode, decisionId, action, expectedAction, verdict, correctness,
 *   severity, errorType, strategyOk, score, confidence, source, metadata,
 *   brain, solver, unified, memory
 * Fields that cannot be derived honestly are null.
 */

import {
  gradeSwipeDecision,
  gradeSwipeSizing,
  gradeQuickDecision
} from '../solver/src/api/modeAdapters.js';
import { gradeToLegacy } from '../solver/src/api/unifiedGrading.js';
import { gradeAnswer } from '../solver/src/training/answerEvaluator.js';
import { gradeAssessmentItem } from '../solver/src/training/assessment.js';
import { attemptFromGradingResult, mapDecisionAction } from '../range-learning/attemptAdapter.js';
import { getLearnerMemory } from '../range-learning/persistence.js';

const GATEWAY_OWNER = 'training-ui/gradingGateway.js';
const recordedDecisionIds = new Set();

const BRAIN_MODES = new Set([
  'swipe', 'sizing', 'quick', 'daily-legacy', 'd25', 'myhands'
]);

function emptyCanonical(mode, extra = {}) {
  return {
    ok: false,
    mode: mode || 'unknown',
    decisionId: extra.decisionId || null,
    action: extra.action || null,
    expectedAction: null,
    verdict: null,
    correctness: null,
    severity: null,
    errorType: extra.errorType || 'not_gradable',
    strategyOk: null,
    score: null,
    confidence: null,
    source: extra.source || null,
    metadata: extra.metadata || {},
    brain: extra.brain || null,
    solver: extra.solver || null,
    unified: extra.unified || null,
    memory: extra.memory || { written: false, skipped: true, reason: extra.errorType || 'not_gradable' }
  };
}

function spotFromInput(input = {}) {
  return input.spot || input.scenario || input.item || {};
}

function handClassOf(spot) {
  const hero = spot?.hero || spot?.heroCards;
  const root = typeof globalThis !== 'undefined' ? globalThis : null;
  const PB = root?.window?.PokerBrain || root?.PokerBrain;
  if (PB && typeof PB.classOf === 'function' && hero) {
    try {
      const hc = PB.classOf(hero);
      if (hc) return String(hc);
    } catch (_) { /* ignore */ }
  }
  if (Array.isArray(hero) && hero.length) return hero.join('');
  return null;
}

function distributionFromBrain(brain) {
  if (!brain) return null;
  const rows = Array.isArray(brain.topActions) ? brain.topActions : [];
  if (!rows.length && brain.frequencies && typeof brain.frequencies === 'object') {
    const dist = {};
    for (const [raw, value] of Object.entries(brain.frequencies)) {
      const mapped = mapDecisionAction(raw);
      if (!mapped.canonical || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
      dist[mapped.canonical] = value > 1 ? value / 100 : value;
    }
    return Object.keys(dist).length ? dist : null;
  }
  if (!rows.length) return null;
  const scale = rows.some((r) => Number(r.freq) > 1) ? 0.01 : 1;
  const dist = {};
  for (const row of rows) {
    const mapped = mapDecisionAction(row.action);
    const freq = Number(row.freq);
    if (!mapped.canonical || !Number.isFinite(freq) || freq <= 0) continue;
    dist[mapped.canonical] = (dist[mapped.canonical] || 0) + freq * scale;
  }
  return Object.keys(dist).length ? dist : null;
}

function expectedFromBrain(brain) {
  const top = brain?.topActions?.[0]?.action;
  return top || null;
}

function decisionIdOf(input, mode, spot, action) {
  if (input.decisionId) return String(input.decisionId);
  const spotId = spot.id || spot.spotId || spot.chartId || 'unknown';
  const size = input.sizePct != null ? String(input.sizePct) : '';
  const tag = input.eventKey || input.sessionTag || '';
  return [mode, spotId, action || '', size, tag].join('|');
}

function routeBrain(mode, input) {
  const spot = spotFromInput(input);
  const action = input.action || input.chosenActionType || input.chosenAction?.type;
  const sizePct = input.sizePct ?? input.chosenSize ?? input.chosenAction?.sizePct ?? null;
  if (mode === 'sizing') {
    return gradeSwipeSizing({ spot, action, sizePct });
  }
  if (mode === 'quick') {
    return gradeQuickDecision({ scenario: spot, action, sizePct });
  }
  return gradeSwipeDecision({ scenario: spot, action, sizePct, mode });
}

function canonicalFromBrain(mode, input, unified) {
  const spot = spotFromInput(input);
  const action = input.action || input.chosenActionType || null;
  const brain = unified?.legacyResult || null;
  const dist = distributionFromBrain(brain);
  const verdict = unified?.metadata?.legacyGrade
    || (unified?.gradeClass)
    || (brain && brain.grade)
    || null;
  const expected = expectedFromBrain(brain);
  return {
    ok: !!(unified && unified.source !== 'error'),
    mode,
    decisionId: decisionIdOf(input, mode, spot, action),
    action,
    expectedAction: expected,
    verdict,
    correctness: null,
    severity: unified?.severity || null,
    errorType: unified?.source === 'error' ? 'grading_context' : null,
    strategyOk: dist ? null : null,
    score: unified?.metadata?.score ?? brain?.score ?? null,
    confidence: unified?.confidence ?? brain?.confidence ?? null,
    source: unified?.source || brain?.source || null,
    metadata: {
      spotId: spot.id || spot.spotId || null,
      handClass: handClassOf(spot),
      street: spot.street || null,
      sizePct: input.sizePct ?? null,
      distribution: dist,
      actionGrade: unified?.metadata?.actionGrade ?? brain?.actionGrade ?? null,
      sizeGrade: unified?.metadata?.sizeGrade ?? brain?.sizeGrade ?? null,
      concept: brain?.concept || null,
      trainerStatus: brain?.trainerStatus || null
    },
    brain,
    solver: null,
    unified
  };
}

function canonicalFromSolver(mode, input, solver) {
  const drill = input.drill || {};
  const action = input.chosenActionId || input.action || solver?.chosenOption?.id || null;
  const rec = drill.solution?.recommendedAction?.type || null;
  const verdict = solver?.grade || null;
  const correctness = solver?.nearOptimal === true || solver?.chosenRecommended === true
    || verdict === 'EXCELLENT' || verdict === 'GOOD'
      ? true
      : (verdict === 'MISTAKE' || verdict === 'BIG MISTAKE' || verdict === 'BIG_MISTAKE' ? false : null);
  return {
    ok: !!solver,
    mode,
    decisionId: decisionIdOf(input, mode, drill, action),
    action,
    expectedAction: rec,
    verdict,
    correctness,
    severity: null,
    errorType: null,
    strategyOk: correctness,
    score: solver?.evLossBb != null ? solver.evLossBb : null,
    confidence: solver?.confidence ?? null,
    source: 'cfr',
    metadata: {
      spotId: drill.id || drill.spotId || drill.concept || 'daily-drill',
      handClass: handClassOf(drill) || drill.heroHand || drill.handClass || 'DRILL',
      street: drill.street || drill.scenario?.street || null,
      mixedStrategy: !!solver?.mixedStrategy,
      nearOptimal: !!solver?.nearOptimal,
      chosenRecommended: !!solver?.chosenRecommended,
      evLossBb: solver?.evLossBb ?? null,
      concept: drill.concept || null
    },
    brain: null,
    solver,
    unified: null
  };
}

function canonicalFromAssessment(input, solver) {
  const item = input.item || {};
  const choice = input.choice ?? input.chosenActionId ?? input.action;
  let correctness = null;
  if (solver?.correct === true) correctness = true;
  else if (solver?.correct === false) correctness = false;
  const verdict = solver?.correct ? 'EXCELLENT' : (solver?.nearOptimal ? 'GOOD' : 'MISTAKE');
  return {
    ok: !!solver,
    mode: 'assessment',
    decisionId: decisionIdOf(input, 'assessment', item, choice),
    action: choice,
    expectedAction: item.correct || null,
    verdict,
    correctness,
    severity: null,
    errorType: solver?.cause || null,
    strategyOk: solver?.correct || solver?.nearOptimal || false,
    score: solver?.score ?? null,
    confidence: null,
    source: 'assessment',
    metadata: {
      spotId: item.id || 'assessment',
      handClass: item.handClass || item.heroHand || item.id || 'ASSESS',
      street: item.street || null,
      nearOptimal: !!solver?.nearOptimal,
      concept: item.concept || null
    },
    brain: null,
    solver,
    unified: null
  };
}

function remember(canonical, options = {}) {
  const memory = {
    written: false,
    skipped: true,
    reason: null,
    result: null,
    error: null
  };
  if (options.recordMemory === false) {
    memory.reason = 'disabled';
    canonical.memory = memory;
    return canonical;
  }
  const id = canonical.decisionId;
  if (id && recordedDecisionIds.has(id)) {
    memory.reason = 'duplicate_event';
    canonical.memory = memory;
    return canonical;
  }

  const ts = typeof options.now === 'number' ? options.now : canonical.metadata?.timestamp;
  const timestamp = Number.isFinite(ts) ? ts : Date.now();

  let built;
  try {
    built = attemptFromGradingResult({
      canonical,
      timestamp,
      producer: canonical.mode,
      sequence: id,
      context: { mode: canonical.mode }
    });
  } catch (err) {
    memory.reason = 'adapter_error';
    memory.error = err && err.message ? err.message : String(err);
    canonical.memory = memory;
    return canonical;
  }

  if (!built.ok || !built.attempt) {
    memory.reason = built.error || 'not_gradable';
    canonical.memory = memory;
    return canonical;
  }

  if (id) recordedDecisionIds.add(id);

  try {
    const store = options.memory || getLearnerMemory(options.memoryOptions || {});
    memory.result = store.recordAttempts([built.attempt], { now: timestamp });
    memory.written = (memory.result?.applied || 0) > 0;
    memory.skipped = !memory.written;
    memory.reason = memory.written ? 'applied' : (memory.result?.duplicates ? 'duplicate_attempt' : 'not_applied');
  } catch (err) {
    memory.written = false;
    memory.skipped = true;
    memory.reason = 'memory_failure';
    memory.error = err && err.message ? err.message : String(err);
  }
  canonical.memory = memory;
  return canonical;
}

/**
 * Canonical production grading entry.
 * @param {object} input
 * @param {string} input.mode
 * @param {object} [options]
 * @param {boolean} [options.recordMemory=true]
 * @param {object} [options.memory] PersistentLearnerMemory instance
 * @param {number} [options.now]
 */
export function gradeDecision(input = {}, options = {}) {
  const mode = String(input.mode || 'swipe').toLowerCase();
  try {
    if (mode === 'daily' && input.drill) {
      const solver = gradeAnswer({
        drill: input.drill,
        chosenId: input.chosenActionId || input.chosenId,
        chosenAction: input.chosenAction,
        preset: input.preset || input.drill.preset || 'mtt'
      });
      return remember(canonicalFromSolver('daily', input, solver), options);
    }
    if (mode === 'assessment') {
      const solver = gradeAssessmentItem(input.item, input.choice ?? input.chosenActionId);
      return remember(canonicalFromAssessment(input, solver), options);
    }
    if (BRAIN_MODES.has(mode) || mode === 'daily-legacy') {
      const unified = routeBrain(mode === 'daily-legacy' ? 'swipe' : mode, input);
      return remember(canonicalFromBrain(mode, input, unified), options);
    }
    return emptyCanonical(mode, { errorType: 'unknown_mode' });
  } catch (err) {
    return emptyCanonical(mode, {
      errorType: 'engine_error',
      metadata: { message: err && err.message ? err.message : String(err) },
      memory: { written: false, skipped: true, reason: 'engine_error', error: err && err.message }
    });
  }
}

export async function gradeDecisionAsync(input = {}, options = {}) {
  return gradeDecision(input, options);
}

/**
 * UI-compatible PokerBrain-shaped result. Single engine call inside the gateway.
 */
export function gradeBrain(spot, action, size, mode = 'swipe') {
  const result = gradeDecision({
    mode,
    spot,
    scenario: spot,
    action,
    sizePct: size
  });
  if (result.brain) return result.brain;
  return {
    grade: result.verdict === 'EXCELLENT' || result.verdict === 'GOOD' || result.verdict === 'g'
      ? 'g'
      : result.verdict === 'INACCURACY' || result.verdict === 'y'
        ? 'y'
        : result.verdict
          ? 'r'
          : 'y',
    actionGrade: result.metadata?.actionGrade || null,
    sizeGrade: result.metadata?.sizeGrade || null,
    score: result.score,
    confidence: result.confidence,
    source: result.source,
    explanation: result.unified?.explanationData?.explanation || '',
    concept: result.metadata?.concept || null,
    topActions: [],
    __canonical: result
  };
}

export function resetGatewayDedup() {
  recordedDecisionIds.clear();
}

export function installGradingGateway(target) {
  const root = target || (typeof globalThis !== 'undefined' ? globalThis.window || globalThis : null);
  if (!root) return null;
  if (root.PokerSwipeGrading && root.PokerSwipeGrading.__owner === GATEWAY_OWNER) {
    return root.PokerSwipeGrading;
  }
  const api = {
    gradeDecision,
    gradeDecisionAsync,
    gradeBrain,
    resetGatewayDedup,
    gradeToLegacy,
    __installed: true,
    __owner: GATEWAY_OWNER
  };
  root.PokerSwipeGrading = api;
  return api;
}

if (typeof globalThis !== 'undefined' && globalThis.window) {
  installGradingGateway(globalThis.window);
}
