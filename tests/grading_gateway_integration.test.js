/**
 * Canonical grading gateway + Mistake Memory integration.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

import {
  gradeDecision,
  gradeBrain,
  installGradingGateway,
  resetGatewayDedup
} from '../training-ui/gradingGateway.js';
import { mapCanonicalToMemory } from '../range-learning/attemptAdapter.js';
import {
  PersistentLearnerMemory,
  createMemoryStorage,
  resetLearnerMemorySingleton
} from '../range-learning/persistence.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = 1_700_000_000_000;

function mockBrain({ grade = 'g', action = 'RAISE', extras = {} } = {}) {
  return {
    grade,
    actionGrade: grade,
    sizeGrade: null,
    score: grade === 'g' ? 92 : grade === 'y' ? 60 : 18,
    confidence: 80,
    source: 'TEST_MODEL',
    explanation: 'test explanation',
    concept: 'RFI',
    action,
    topActions: extras.topActions || [],
    frequencies: extras.frequencies || undefined,
    trainerStatus: extras.trainerStatus || null
  };
}

function installWindowBrain(impl) {
  const g = globalThis;
  if (!g.window) g.window = g;
  g.window.PokerBrain = {
    gradeDecision: impl || ((spot, action) => mockBrain({ action })),
    classOf: () => 'AKs'
  };
  installGradingGateway(g.window);
}

function mem() {
  return new PersistentLearnerMemory({
    storage: createMemoryStorage(new Map()),
    now: () => NOW
  });
}

const dailyDrill = {
  id: 'daily-1',
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

beforeEach(() => {
  resetGatewayDedup();
  resetLearnerMemorySingleton();
  installWindowBrain();
});

afterEach(() => {
  resetGatewayDedup();
  resetLearnerMemorySingleton();
});

describe('1 swipe → gateway → PokerBrain → canonical', () => {
  it('grades through unified adapter and returns brain-shaped result', () => {
    let calls = 0;
    installWindowBrain((spot, action, size) => {
      calls += 1;
      return mockBrain({
        grade: 'r',
        action,
        extras: { topActions: [{ action: 'RAISE', freq: 1 }] }
      });
    });
    const storage = mem();
    const result = gradeDecision({
      mode: 'swipe',
      spot: { id: 'SW1', hero: ['A♠', 'K♠'], street: 'ПРЕФЛОП', pot: 1.5, stack: 25 },
      action: 'FOLD',
      sizePct: null,
      eventKey: 'swipe-1'
    }, { memory: storage, now: NOW });

    assert.equal(calls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'swipe');
    assert.equal(result.action, 'FOLD');
    assert.equal(result.verdict, 'r');
    assert.equal(result.brain.grade, 'r');
    assert.equal(result.source, 'TEST_MODEL');
    assert.equal(result.unified.legacyResult.grade, 'r');
  });
});

describe('2 daily → gateway → gradeAnswer semantics preserved', () => {
  it('keeps EXCELLENT on the best EV line', () => {
    const storage = mem();
    const result = gradeDecision({
      mode: 'daily',
      drill: dailyDrill,
      chosenActionId: 'raise',
      eventKey: 'daily-best'
    }, { memory: storage, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.solver.grade, 'EXCELLENT');
    assert.equal(result.solver.evLossBb, 0);
    assert.equal(result.verdict, 'EXCELLENT');
    assert.equal(result.correctness, true);
  });

  it('worse EV line is still a solver mistake grade', () => {
    const storage = mem();
    const result = gradeDecision({
      mode: 'daily',
      drill: dailyDrill,
      chosenActionId: 'fold',
      eventKey: 'daily-fold'
    }, { memory: storage, now: NOW });
    assert.ok(['MISTAKE', 'BIG MISTAKE', 'BIG_MISTAKE'].includes(result.solver.grade));
    assert.ok(result.solver.evLossBb > 0);
  });
});

describe('3 assessment → gateway preserves diagnostic scoring', () => {
  it('correct choice stays correct:true', () => {
    const item = { id: 'A1', correct: 'RAISE', alsoOk: ['CALL'], score: 10, concept: 'RFI', handClass: 'AKs' };
    const storage = mem();
    const result = gradeDecision({
      mode: 'assessment',
      item,
      choice: 'RAISE',
      eventKey: 'as-1'
    }, { memory: storage, now: NOW });
    assert.equal(result.solver.correct, true);
    assert.equal(result.solver.score, 10);
    assert.equal(result.correctness, true);
  });
});

describe('4 incorrect canonical result writes exactly one MM attempt', () => {
  it('swipe fold vs raise-only policy → one OUT_OF_STRATEGY', () => {
    installWindowBrain((spot, action) => mockBrain({
      grade: 'r',
      action,
      extras: { topActions: [{ action: 'RAISE', freq: 1 }] }
    }));
    const storage = mem();
    const result = gradeDecision({
      mode: 'swipe',
      spot: { id: 'SW-BAD', hero: ['A♠', 'K♠'], street: 'PREFLOP' },
      action: 'FOLD',
      eventKey: 'bad-1'
    }, { memory: storage, now: NOW });
    assert.equal(result.memory.written, true);
    assert.equal(result.memory.result.applied, 1);
    const states = storage.allStates();
    assert.equal(states.length, 1);
    assert.equal(states[0]._eventLog[0].c, 'OUT_OF_STRATEGY');
    assert.equal(states[0].attempts, 1);
  });
});

describe('5 correct decision maps to existing MM PURE_MATCH', () => {
  it('assessment correct → PURE_MATCH', () => {
    const storage = mem();
    const result = gradeDecision({
      mode: 'assessment',
      item: { id: 'A2', correct: 'RAISE', alsoOk: [], score: 8, concept: 'x', handClass: 'AKs' },
      choice: 'RAISE',
      eventKey: 'ok-1'
    }, { memory: storage, now: NOW });
    assert.equal(mapCanonicalToMemory(result).classification, 'PURE_MATCH');
    assert.equal(result.memory.written, true);
    assert.equal(storage.allStates()[0]._eventLog[0].c, 'PURE_MATCH');
  });
});

describe('6 unknown / ungradable does not invent a mistake', () => {
  it('brain g/y/r without distribution is skipped', () => {
    installWindowBrain(() => mockBrain({ grade: 'r', extras: { topActions: [] } }));
    const storage = mem();
    const result = gradeDecision({
      mode: 'swipe',
      spot: { id: 'SW-Y', hero: ['A♠', 'K♠'] },
      action: 'BET',
      eventKey: 'unk-1'
    }, { memory: storage, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.verdict, 'r');
    assert.equal(mapCanonicalToMemory(result).reason, 'ambiguous_brain_grade');
    assert.equal(result.memory.written, false);
    assert.equal(storage.allStates().length, 0);
  });
});

describe('7 dedup same decision event', () => {
  it('second call with the same decisionId does not apply a second attempt', () => {
    installWindowBrain((spot, action) => mockBrain({
      grade: 'r',
      action,
      extras: { topActions: [{ action: 'RAISE', freq: 1 }] }
    }));
    const storage = mem();
    const input = {
      mode: 'swipe',
      spot: { id: 'SW-DUP', hero: ['A♠', 'K♠'] },
      action: 'FOLD',
      eventKey: 'dup-event'
    };
    const a = gradeDecision(input, { memory: storage, now: NOW });
    const b = gradeDecision(input, { memory: storage, now: NOW });
    assert.equal(a.memory.written, true);
    assert.equal(b.memory.written, false);
    assert.equal(b.memory.reason, 'duplicate_event');
    assert.equal(storage.allStates()[0].attempts, 1);
  });
});

describe('8 memory failure does not break grading', () => {
  it('returns canonical result when recordAttempts throws', () => {
    installWindowBrain((spot, action) => mockBrain({
      grade: 'r',
      action,
      extras: { topActions: [{ action: 'RAISE', freq: 1 }] }
    }));
    const broken = {
      recordAttempts() { throw new Error('disk full'); }
    };
    const result = gradeDecision({
      mode: 'swipe',
      spot: { id: 'SW-FAIL', hero: ['A♠', 'K♠'] },
      action: 'FOLD',
      eventKey: 'fail-1'
    }, { memory: broken, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.verdict, 'r');
    assert.equal(result.brain.grade, 'r');
    assert.equal(result.memory.written, false);
    assert.equal(result.memory.reason, 'memory_failure');
  });
});

describe('9 production runtime callers no longer call PokerBrain directly', () => {
  it('live production files only call PokerBrain.gradeDecision from the adapter', () => {
    const allowed = new Set([
      'solver/src/api/unifiedGrading.js',
      'unified-grading-integration.js',
      'training-ui/unifiedGradingBridge.js',
      'trainer-knowledge/poker_brain_trainer_bridge.js',
      'poker_brain.js',
      'poker_brain_v20.js',
      'poker_brain_v33.js',
      'poker_brain_v34.js'
    ]);
    const productionRoots = [
      'index.html',
      'mini-app-compact.js',
      'poker_swipe_v34.js',
      'training-ui',
      'ranges-ui',
      'daily-game-patch.js'
    ];
    const hits = [];
    function scan(rel) {
      const p = join(ROOT, rel);
      const st = statSync(p);
      if (st.isDirectory()) {
        for (const name of readdirSync(p)) {
          if (name === 'node_modules' || name.startsWith('.')) continue;
          scan(join(rel, name));
        }
        return;
      }
      if (!/\.(js|html)$/.test(p)) return;
      const src = readFileSync(p, 'utf8');
      if (!/PokerBrain\.gradeDecision\s*\(/.test(src) && !/PokerBrain\?\.gradeDecision\s*\(/.test(src)) return;
      const relPosix = rel.split('\\').join('/');
      if (allowed.has(relPosix)) return;
      if (relPosix.startsWith('training-ui/unifiedGradingBridge')) return;
      hits.push(relPosix);
    }
    for (const r of productionRoots) scan(r);
    assert.deepEqual(hits, []);
  });

  it('index.html does not load the old dual-patch bridges', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    assert.equal(html.includes('unified-grading-integration.js'), false);
    assert.equal(html.includes('unifiedGradingBridge.js'), false);
    assert.equal(html.includes('solver/src/api/browser.js'), false);
    assert.match(html, /training-ui\/main\.js/);
  });
});

describe('10 browser safety: gateway graph has no fs / Strategy Map cache', () => {
  it('gradingGateway and its production imports stay browser-safe', () => {
    const files = [
      join(ROOT, 'training-ui/gradingGateway.js'),
      join(ROOT, 'range-learning/attemptAdapter.js'),
      join(ROOT, 'range-learning/persistence.js')
    ];
    const banned = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const re = /from\s+['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(src))) {
        const spec = m[1];
        if (spec === 'fs' || spec === 'node:fs' || spec.endsWith('strategyMapCache.js')
          || spec.endsWith('strategyMapRuntime.js') || spec.endsWith('range-learning/index.js')) {
          banned.push(`${file} → ${spec}`);
        }
      }
    }
    assert.deepEqual(banned, []);
  });
});

describe('gradeBrain UI helper', () => {
  it('returns PokerBrain-shaped grade for compact/index callers', () => {
    installWindowBrain(() => mockBrain({ grade: 'y' }));
    const br = gradeBrain({ id: 'S', hero: ['A♠', 'K♠'] }, 'CHECK', null, 'sizing');
    assert.equal(br.grade, 'y');
    assert.equal(br.source, 'TEST_MODEL');
  });
});
