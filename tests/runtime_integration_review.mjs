/**
 * Forensic review harness: grading equivalence + Battleship semantics + exactly-once.
 * Run: node tests/runtime_integration_review.mjs
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeDecision,
  gradeBrain,
  installGradingGateway,
  resetGatewayDedup
} from '../training-ui/gradingGateway.js';
import {
  attemptFromBattleshipTap,
  mapCanonicalToMemory,
  classifyChosenAction
} from '../range-learning/attemptAdapter.js';
import { gradeAnswer } from '../solver/src/training/answerEvaluator.js';
import { gradeAssessmentItem } from '../solver/src/training/assessment.js';
import { gradeSwipeDecision } from '../solver/src/api/modeAdapters.js';
import {
  PersistentLearnerMemory,
  createMemoryStorage,
  resetLearnerMemorySingleton
} from '../range-learning/persistence.js';

const NOW = 1_700_000_100_000;

function installBrain(impl) {
  const g = globalThis;
  if (!g.window) g.window = g;
  g.window.PokerBrain = {
    gradeDecision: impl,
    classOf: (hero) => (Array.isArray(hero) ? hero.join('') : 'AKs')
  };
  installGradingGateway(g.window);
}

const dailyDrill = {
  id: 'eq-daily',
  concept: 'RFI BTN',
  heroHand: 'AKs',
  street: 'PREFLOP',
  options: [
    { id: 'raise', labelRu: 'Рейз', evBB: 1.2, action: { type: 'raise', sizePot: 0.5 } },
    { id: 'fold', labelRu: 'Фолд', evBB: 0, action: { type: 'fold' } }
  ],
  solution: {
    actionEVs: { raise: 1.2, fold: 0 },
    bestEV: 1.2,
    recommendedAction: { type: 'raise', sizePot: 0.5 },
    recommendedFrequency: 0.9
  }
};

const assessItem = {
  id: 'eq-assess',
  correct: 'raise',
  alsoOk: ['call'],
  choices: ['raise', 'fold', 'call'],
  handClass: 'AKs',
  concept: 'RFI'
};

beforeEach(() => {
  resetGatewayDedup();
  resetLearnerMemorySingleton();
});

describe('B grading equivalence OLD vs NEW', () => {
  it('swipe brain path: gradeBrain matches direct PokerBrain for representative spots', () => {
    const cases = [
      { spot: { id: 'S1', hero: ['Ah', 'Kh'], street: 'FLOP', board: ['Qs', '7d', '2c'] }, action: 'CHECK', size: null },
      { spot: { id: 'S2', hero: ['As', 'Kd'], street: 'PREFLOP' }, action: 'RAISE', size: 75 },
      { spot: { id: 'S3', hero: ['2c', '7d'], street: 'RIVER', board: ['As', 'Kd', 'Qh', 'Jc', '9s'] }, action: 'FOLD', size: null }
    ];
    for (const c of cases) {
      const direct = {
        grade: 'g', actionGrade: 'g', sizeGrade: 'y', score: 88, confidence: 70,
        source: 'TEST', explanation: 'ok', concept: 'TEST', action: c.action,
        topActions: [{ action: 'RAISE', freq: 0.8 }, { action: 'FOLD', freq: 0.2 }]
      };
      installBrain(() => ({ ...direct }));
      const viaGateway = gradeBrain({ ...c.spot, spotId: c.spot.id }, c.action, c.size, 'swipe');
      assert.equal(viaGateway.grade, direct.grade, c.spot.id);
      assert.equal(viaGateway.actionGrade, direct.actionGrade, c.spot.id);
      assert.equal(viaGateway.sizeGrade, direct.sizeGrade, c.spot.id);
      assert.equal(viaGateway.score, direct.score, c.spot.id);
      assert.equal(viaGateway.source, direct.source, c.spot.id);
    }
  });

  it('daily: gateway solver output matches direct gradeAnswer', () => {
    installBrain(() => ({ grade: 'y' }));
    for (const chosenId of ['raise', 'fold']) {
      const direct = gradeAnswer({ drill: dailyDrill, chosenId });
      const via = gradeDecision({
        mode: 'daily', drill: dailyDrill, chosenActionId: chosenId,
        eventKey: `eq-${chosenId}`
      }, { recordMemory: false });
      assert.equal(via.solver.grade, direct.grade, chosenId);
      assert.equal(via.solver.evLossBb, direct.evLossBb, chosenId);
      assert.equal(via.solver.nearOptimal, direct.nearOptimal, chosenId);
      assert.equal(via.solver.chosenRecommended, direct.chosenRecommended, chosenId);
    }
  });

  it('assessment: gateway solver output matches direct gradeAssessmentItem', () => {
    installBrain(() => ({ grade: 'g' }));
    for (const choice of ['raise', 'fold', 'call']) {
      const direct = gradeAssessmentItem(assessItem, choice);
      const via = gradeDecision({
        mode: 'assessment', item: assessItem, choice,
        eventKey: `eq-a-${choice}`
      }, { recordMemory: false });
      assert.equal(via.solver.correct, direct.correct, choice);
      assert.equal(via.solver.score, direct.score, choice);
      assert.equal(via.solver.nearOptimal, direct.nearOptimal, choice);
    }
  });

  it('mixed-frequency maps to IN_MIX via distribution', () => {
    const mapped = mapCanonicalToMemory({
      ok: true,
      action: 'CALL',
      metadata: { distribution: { RAISE: 0.6, CALL: 0.25, FOLD: 0.15 } }
    });
    assert.equal(mapped.classification, 'IN_MIX');
    assert.equal(mapped.strategyOk, true);
  });

  it('zero-frequency action maps to OUT_OF_STRATEGY', () => {
    const mapped = mapCanonicalToMemory({
      ok: true,
      action: 'FOLD',
      metadata: { distribution: { RAISE: 1 } }
    });
    assert.equal(mapped.classification, 'OUT_OF_STRATEGY');
    assert.equal(mapped.strategyOk, false);
  });

  it('ambiguous brain g/y/r without distribution does not invent MM category', () => {
    const mapped = mapCanonicalToMemory({ ok: true, action: 'CHECK', verdict: 'g' });
    assert.equal(mapped.classification, null);
    assert.equal(mapped.reason, 'ambiguous_brain_grade');
  });

  it('missing input returns not_gradable', () => {
    const r = gradeDecision({ mode: 'unknown_mode' });
    assert.equal(r.ok, false);
    assert.equal(r.errorType, 'unknown_mode');
  });
});

describe('C Battleship mission-vs-strategy semantics', () => {
  const model = { chartId: 'UO_2-4_EP', supported: true };
  const mission = { id: 'm1' };

  it('MISSION_OFF_TARGET → PURE_MATCH + strategyOk true', () => {
    const built = attemptFromBattleshipTap({
      model, mission, hand: 'A9s', timestamp: NOW, sequence: 1,
      isTarget: false, inRange: true
    });
    assert.equal(built.attempt.classification, 'PURE_MATCH');
    assert.equal(built.attempt.context.missionResult, 'MISSION_OFF_TARGET');
    assert.equal(built.attempt.context.strategyOk, true);
  });

  it('MISSION_MISS / OUT_OF_STRATEGY → strategyOk false', () => {
    const built = attemptFromBattleshipTap({
      model, mission, hand: '72o', timestamp: NOW, sequence: 2,
      isTarget: false, inRange: false
    });
    assert.equal(built.attempt.classification, 'OUT_OF_STRATEGY');
    assert.equal(built.attempt.context.missionResult, 'MISSION_MISS');
    assert.equal(built.attempt.context.strategyOk, false);
  });

  it('MISSION_HIT unchanged', () => {
    const built = attemptFromBattleshipTap({
      model, mission, hand: 'AA', timestamp: NOW, sequence: 3,
      isTarget: true, inRange: true
    });
    assert.equal(built.attempt.classification, 'PURE_MATCH');
    assert.equal(built.attempt.context.missionResult, 'MISSION_HIT');
    assert.equal(built.attempt.context.strategyOk, true);
  });
});

describe('D Mistake Memory exactly-once', () => {
  it('gateway dedup: same decisionId writes once', () => {
    installBrain(() => ({
      grade: 'r', actionGrade: 'r', score: 10, confidence: 50, source: 'T',
      explanation: '', concept: 'X',
      topActions: [{ action: 'RAISE', freq: 1 }]
    }));
    const mem = new PersistentLearnerMemory({
      storage: createMemoryStorage(new Map()),
      now: () => NOW
    });
    const input = {
      mode: 'daily', drill: dailyDrill, chosenActionId: 'fold',
      eventKey: 'dup-once'
    };
    const a = gradeDecision(input, { memory: mem, now: NOW });
    const b = gradeDecision(input, { memory: mem, now: NOW });
    assert.equal(a.memory.written, true);
    assert.equal(b.memory.reason, 'duplicate_event');
    assert.equal(b.memory.written, false);
    const events = [];
    for (const st of mem.allStates()) {
      for (const rec of st._eventLog || []) events.push(rec);
    }
    assert.equal(events.length, 1);
  });

  it('battleship tap produces exactly one attempt object', () => {
    const built = attemptFromBattleshipTap({
      model: { chartId: 'BL_uo-test', supported: true },
      mission: { id: 'm' },
      hand: 'KQs',
      timestamp: NOW,
      sequence: 99,
      isTarget: false,
      inRange: true
    });
    assert.equal(built.ok, true);
    assert.ok(built.attempt.attemptId);
    assert.equal(built.attempt.context.strategyOk, true);
  });
});
