import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionController } from '../../training-ui/sessionController.js';
import {
  buildResumeSnapshot, saveResume, loadResume, clearResume,
  validateResumeSnapshot, RESUME_STORAGE_KEY, RESUME_SESSION_TYPE
} from '../../training-ui/sessionResume.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

function mockDrill(id) {
  return {
    drillId: `d_${id}`,
    concept: 'test',
    street: 'flop',
    scenario: { heroCards: ['A♠', 'K♠'], potBb: 5, effectiveStackBb: 40 },
    options: [{ id: 'fold', labelRu: 'ФОЛД' }, { id: 'call', labelRu: 'КОЛЛ' }],
    solution: { recommendedAction: { type: 'call' }, bestEV: 1, actionEVs: {} },
    explanation: { promptRu: '?' }
  };
}

function activeCtl(overrides = {}) {
  const ctl = new SessionController({ store: {} });
  ctl.mode = 'drill';
  ctl.state = 'ready';
  ctl.session = { sessionId: 's1', primaryConcept: 'c1', plan: { total: 3, filled: 3 } };
  ctl.drills = [mockDrill(1), mockDrill(2), mockDrill(3)];
  ctl.index = 1;
  ctl.results = [{ grade: 'GOOD', concept: 'test' }];
  Object.assign(ctl, overrides);
  return ctl;
}

test('save new session snapshot', () => {
  const st = memoryStorage();
  const snap = buildResumeSnapshot(activeCtl());
  assert.ok(snap);
  assert.equal(snap.type, RESUME_SESSION_TYPE);
  assert.ok(saveResume(st, snap));
  assert.ok(st.getItem(RESUME_STORAGE_KEY));
});

test('restore session from storage', () => {
  const st = memoryStorage();
  const snap = buildResumeSnapshot(activeCtl({ index: 2, results: [{}, {}] }));
  saveResume(st, snap);
  const loaded = loadResume(st);
  assert.ok(loaded);
  assert.equal(loaded.index, 2);
  assert.equal(loaded.drills.length, 3);
});

test('restore correct task index via controller', () => {
  const snap = buildResumeSnapshot(activeCtl({ index: 2 }));
  const ctl = new SessionController({ store: {} });
  const r = ctl.restoreFromSnapshot(snap);
  assert.equal(r.ok, true);
  assert.equal(ctl.index, 2);
  assert.equal(ctl.drills.length, 3);
  assert.equal(ctl.state, 'ready');
});

test('restore results array', () => {
  const snap = buildResumeSnapshot(activeCtl({
    index: 1,
    results: [{ grade: 'EXCELLENT', concept: 'x' }, { grade: 'GOOD', concept: 'y' }]
  }));
  const ctl = new SessionController({ store: {} });
  ctl.restoreFromSnapshot(snap);
  assert.equal(ctl.results.length, 2);
  assert.equal(ctl.results[0].grade, 'EXCELLENT');
});

test('start new clears storage', () => {
  const st = memoryStorage();
  saveResume(st, buildResumeSnapshot(activeCtl()));
  clearResume(st);
  assert.equal(loadResume(st), null);
});

test('completed session not stored as resumable', () => {
  const ctl = activeCtl({ state: 'done' });
  assert.equal(buildResumeSnapshot(ctl), null);
});

test('corrupted storage falls back safely', () => {
  const st = memoryStorage();
  st.setItem(RESUME_STORAGE_KEY, '{not json');
  assert.equal(loadResume(st), null);
  assert.equal(st.getItem(RESUME_STORAGE_KEY), null);
});

test('invalid index falls back on validate', () => {
  const st = memoryStorage();
  const snap = buildResumeSnapshot(activeCtl());
  snap.index = 99;
  st.setItem(RESUME_STORAGE_KEY, JSON.stringify(snap));
  assert.equal(validateResumeSnapshot(snap).ok, false);
  assert.equal(loadResume(st), null);
});

test('transient answering state is not persisted', () => {
  const ctl = activeCtl({ answering: true });
  assert.equal(buildResumeSnapshot(ctl), null);
});

test('flow without persistence still works on fresh controller', () => {
  const ctl = new SessionController({ store: {} });
  assert.equal(ctl.state, 'idle');
  assert.equal(buildResumeSnapshot(ctl), null);
});

test('wrong session type rejected', () => {
  const snap = buildResumeSnapshot(activeCtl());
  snap.type = 'swipe_mode';
  assert.equal(validateResumeSnapshot(snap).ok, false);
});
