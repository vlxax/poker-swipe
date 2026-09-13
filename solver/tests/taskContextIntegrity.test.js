import test from 'node:test';
import assert from 'node:assert/strict';

import { loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import {
  buildCanonicalSpot,
  boardExpectedLength,
  canonicalToDisplayContext,
  canonicalToSizingSpot,
  canonicalToSwipeSpot
} from '../../task-context/canonicalSpot.js';
import {
  auditCanonicalSpot,
  auditModeSpot
} from '../src/training/taskContextIntegrity.js';
import { libraryTaskToMiniAppSpot } from '../../training-ui/miniAppSpotAdapter.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';

const tasks = loadTaskLibrary();

test('displayed board equals canonical board for swipe adapter', () => {
  const task = tasks.find((t) => t.street === 'ФЛОП' && t.board.length === 3);
  assert.ok(task);
  const spot = libraryTaskToMiniAppSpot(task, 'swipe');
  assert.equal(spot.board.join(''), spot._canonical.board.join(''));
});

test('street matches board length', () => {
  for (const task of tasks) {
    const c = buildCanonicalSpot(task);
    const need = boardExpectedLength(c.street);
    assert.equal(c.board.length, need, `${task.id} street/board`);
  }
});

test('displayed positions match canonical for brain spot', () => {
  const task = tasks.find((t) => t.position === 'BTN' && t.villain === 'BB');
  assert.ok(task);
  const brain = libraryTaskToBrainSpot(task);
  assert.equal(brain.heroPosition, task.position);
  assert.equal(brain.villainPosition, task.villain);
});

test('displayed stack matches canonical eff/hero stack', () => {
  const task = tasks[0];
  const brain = libraryTaskToBrainSpot(task);
  assert.equal(brain.stack, task.heroStack);
  assert.equal(brain.effStack, task.effStack);
});

test('history is internally consistent with street', () => {
  const postflop = tasks.filter((t) => t.street !== 'ПРЕФЛОП');
  assert.ok(postflop.length > 10);
  for (const task of postflop.slice(0, 30)) {
    const c = buildCanonicalSpot(task);
    const post = c.history.filter((h) => !/ПРЕФЛОП/i.test(h.street));
    assert.ok(post.length > 0, `${task.id} needs postflop history`);
  }
});

test('question type aligns with grading target for action tasks', () => {
  const pre = tasks.filter((t) => t.street === 'ПРЕФЛОП' && !t.options.some((o) => /\d+%/.test(o)));
  for (const task of pre.slice(0, 20)) {
    const audit = auditCanonicalSpot(buildCanonicalSpot(task));
    const gradingErrors = audit.errors.filter((e) => e.type === 'GRADING_TARGET_MISMATCH');
    assert.equal(gradingErrors.length, 0, task.id);
  }
});

test('answer options are legal for facing context', () => {
  const facing = tasks.filter((t) => /ставит|открыл|3-бет/i.test((t.history || []).slice(-1)[0]?.text || ''));
  for (const task of facing.slice(0, 15)) {
    const illegal = auditCanonicalSpot(buildCanonicalSpot(task)).errors
      .filter((e) => e.type === 'ANSWER_OPTION_MISMATCH');
    assert.equal(illegal.length, 0, `${task.id}: ${illegal.map((x) => x.detail).join('; ')}`);
  }
});

test('trainer lookup context uses same position and stack as canonical', () => {
  const pre = tasks.filter((t) => t.street === 'ПРЕФЛОП')[0];
  const c = buildCanonicalSpot(pre);
  const brain = libraryTaskToBrainSpot(pre);
  assert.equal(brain.heroPosition, c.position);
  assert.equal(brain.stack, c.heroStack);
});

test('changing task changes description line', () => {
  const a = buildCanonicalSpot(tasks[0]);
  const b = buildCanonicalSpot(tasks[1]);
  assert.notEqual(a.descriptionLine, b.descriptionLine);
});

test('previous task narrative cannot leak — display ctx is per spot', () => {
  const a = canonicalToDisplayContext(buildCanonicalSpot(tasks[0]));
  const b = canonicalToDisplayContext(buildCanonicalSpot(tasks[1]));
  assert.notEqual(a.extra, b.extra);
  assert.notEqual(a.heroPos, b.heroPos);
});

test('display context derives from canonical spot fields', () => {
  const task = tasks.find((t) => t.position === 'CO' && t.stage === 'СРЕДНЯЯ');
  assert.ok(task);
  const spot = libraryTaskToMiniAppSpot(task, 'swipe');
  const ctx = canonicalToDisplayContext(spot._canonical);
  assert.equal(ctx.heroPos, task.position);
  assert.equal(ctx.eff, `${task.effStack} ББ`);
  assert.ok(ctx.tags.includes(task.format));
});

test('integrity audit runs over full library without adapter drift', () => {
  let adapterDrift = 0;
  for (const task of tasks) {
    const spot = libraryTaskToMiniAppSpot(task, 'swipe');
    if (!spot) continue;
    if (spot.board.join('') !== (spot._canonical.board || []).join('')) adapterDrift++;
    if (spot.stack !== spot._canonical.heroStack) adapterDrift++;
  }
  assert.equal(adapterDrift, 0);
});

test('sizing adapter derives zone from correct answer when pct present', () => {
  const sizingTask = tasks.find((t) => /СТАВКА\s+\d+%/.test(t.correct) || t.options.some((o) => /\d+%/.test(o)));
  if (!sizingTask) return;
  const spot = canonicalToSizingSpot(buildCanonicalSpot(sizingTask));
  if (spot?._quarantine) return;
  assert.ok(Array.isArray(spot.zone));
});

test('legacy swipe canonicalizes ctx into history', () => {
  const legacy = {
    id: 'PF_BTN_A8S',
    street: 'ПРЕФЛОП',
    pos: 'BTN',
    hero: ['A♠', '8♠'],
    board: [],
    ctx: 'До тебя все сфолдили.',
    stack: 30,
    pot: 1.5,
    actions: ['ФОЛД', 'РЕЙЗ'],
    preferred: ['РЕЙЗ'],
    _legacy: true
  };
  const audit = auditModeSpot(legacy, 'swipe');
  assert.equal(audit.ok, true, audit.errors.map((e) => e.detail).join('; '));
  assert.ok(buildCanonicalSpot(legacy).history.length > 0);
});

test('legacy sizing derives correct target from zone', () => {
  const legacy = {
    id: 'SZ1',
    street: 'ФЛОП',
    pos: 'BTN vs BB',
    ctx: 'BTN vs BB · dry',
    hero: ['A♥', 'Q♥'],
    board: ['A♠', '7♦', '2♣'],
    pot: 6.5,
    zone: [20, 40],
    check: 'y',
    _legacy: true
  };
  const spot = canonicalToSizingSpot(buildCanonicalSpot(legacy));
  assert.ok(spot);
  assert.equal(spot.zone[0], 20);
  assert.match(buildCanonicalSpot(legacy).correct, /СТАВКА/);
});

test('integrate enrich path uses canonical when available', () => {
  const legacy = {
    id: 'PF_BTN_A8S',
    street: 'ПРЕФЛОП',
    pos: 'BTN',
    hero: ['A♠', '8♠'],
    ctx: 'До тебя все сфолдили.',
    stack: 30,
    pot: 1.5,
    actions: ['ФОЛД', 'РЕЙЗ'],
    preferred: ['РЕЙЗ'],
    _legacy: true
  };
  const c = buildCanonicalSpot(legacy);
  assert.equal(c.position, 'BTN');
  assert.ok(c.history[0].text.includes('сфолдили'));
});

test('legacy xray canonicalizes hero/villain from ref+line seats', () => {
  const tripleBarrel = {
    title: 'ТРОЙНОЙ БАРРЕЛЬ',
    villain: 'BTN · 40 BB',
    hero: ['K♠', 'J♦'],
    board: ['K♣', '8♦', '3♠', '4♥', 'A♣'],
    line: ['BTN open 2.2', 'K♣8♦3♠ · 33%', '4♥ · 75%', 'A♣ · 125%'],
    ref: [[], [], [], []],
    _legacy: true
  };
  const bvb = {
    title: 'BVB POLAR',
    villain: 'SB · 55 BB',
    hero: ['Q♠', '8♥'],
    board: ['Q♣', '7♦', '2♠', '5♣', 'K♥'],
    line: ['SB open 3', 'Q♣7♦2♠ · 33%', '5♣ · 80%', 'K♥ · 150%'],
    ref: [[], [], [], []],
    _legacy: true
  };
  for (const task of [tripleBarrel, bvb]) {
    const audit = auditModeSpot(task, 'xray');
    assert.equal(audit.ok, true, audit.errors.map((e) => e.detail).join('; '));
    assert.equal(audit.canonical.position, 'BB', task.title);
    assert.match(task.villain, new RegExp(audit.canonical.villain));
  }
});

test('quarantined library sizing tasks are not exported to mini-app', () => {
  const pre = tasks.find((t) => t.street === 'ПРЕФЛОП' && !t.xrayRef);
  assert.ok(pre);
  const spot = libraryTaskToMiniAppSpot(pre, 'sizing');
  if (spot === null) assert.ok(true);
  else assert.ok(!spot._quarantine);
});

test('drill grading uses same correct option as canonical', () => {
  const task = tasks[0];
  const gen = drillFromLibraryTask(task);
  assert.ok(gen.ok);
  const rec = gen.drill.options.find((o) => o.labelRu === task.correct);
  assert.ok(rec);
  assert.equal(gen.drill.solution.recommendedAction.type, rec.action.type);
});
