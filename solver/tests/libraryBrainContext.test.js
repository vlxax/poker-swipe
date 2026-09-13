// Integration: Poker Brain receives complete per-hand context from library tasks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { loadTaskLibrary, resetTaskLibraryCache } from '../src/training/taskLibraryBridge.js';
import { libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadBrain() {
  const previous = {
    version: '17',
    gradeDecision: () => ({}),
    analyzeHand: () => ({}),
    handBucket: () => 'TOP_PAIR'
  };
  const context = { window: { PokerBrain: previous }, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'poker_brain_v33.js'), 'utf8'), context);
  return context.window.PokerBrainV33;
}

test('libraryTaskToBrainSpot passes complete context for consecutive different hands', () => {
  resetTaskLibraryCache();
  const tasks = loadTaskLibrary();
  const a = tasks.find((t) => t.id === 'F_DRY_CBET');
  const b = tasks.find((t) => t.id === 'R_BLUFFCATCH');
  assert.ok(a && b, 'fixture tasks must exist');

  const spotA = libraryTaskToBrainSpot(a);
  const spotB = libraryTaskToBrainSpot(b);
  const Brain = loadBrain();
  const ctxA = Brain.contextForSpot(spotA);
  const ctxB = Brain.contextForSpot(spotB);

  assert.ok(ctxA.score >= 70, `hand A context score ${ctxA.score}`);
  assert.ok(ctxB.score >= 70, `hand B context score ${ctxB.score}`);
  assert.equal(ctxA.missing.length, 0, `hand A missing: ${ctxA.missing.join(', ')}`);
  assert.equal(ctxB.missing.length, 0, `hand B missing: ${ctxB.missing.join(', ')}`);

  assert.notDeepEqual(
    { hero: ctxA.hero, board: ctxA.board, current: ctxA.current, format: ctxA.format },
    { hero: ctxB.hero, board: ctxB.board, current: ctxB.current, format: ctxB.format },
    'consecutive hands must produce different Brain contexts'
  );

  assert.equal(spotA.format, a.format);
  assert.equal(spotA.stage, a.stage);
  assert.ok(spotA.actionHistory.length >= 1);
  assert.ok(spotA.skillTags.length >= 1);
  assert.equal(spotA.miniApp, 'training');
});

test('choiceToActionType distinguishes fold/call/raise/3bet/4bet/all-in/sized bets', async () => {
  const { choiceToActionType } = await import('../src/training/libraryDrill.js');
  const types = [
    choiceToActionType('ФОЛД'),
    choiceToActionType('КОЛЛ'),
    choiceToActionType('РЕЙЗ'),
    choiceToActionType('3-БЕТ'),
    choiceToActionType('4-БЕТ'),
    choiceToActionType('ОЛЛ-ИН'),
    choiceToActionType('СТАВКА 33%'),
    choiceToActionType('СТАВКА 75%')
  ];
  assert.equal(new Set(types).size, types.length);
  assert.equal(choiceToActionType('КОЛЛ'), 'call');
});
