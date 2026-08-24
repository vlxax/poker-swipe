// Stage 4.6 — Stack band parser regression tests

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTrainerStack,
  parseStackBb,
  matchQueryToRecord,
  matchQueryToRecords,
  greenActionForStack,
  stackContainsBb,
  UO_RAISE_THRESHOLD_BB
} from '../../trainer-knowledge/stackParser.js';

describe('trainer stack parser', () => {
  test('EXACT stack formats', () => {
    assert.deepEqual(parseTrainerStack('25BB'), { type: 'EXACT', raw: '25BB', bb: 25 });
    assert.deepEqual(parseTrainerStack('2BB'), { type: 'EXACT', raw: '2BB', bb: 2 });
    assert.deepEqual(parseTrainerStack('22.5BB'), { type: 'EXACT', raw: '22.5BB', bb: 22.5 });
    assert.equal(parseStackBb('25BB'), 25);
    assert.equal(parseStackBb('16-22BB'), null);
  });

  test('RANGE stack formats', () => {
    const sem = parseTrainerStack('16-22BB');
    assert.equal(sem.type, 'RANGE');
    assert.equal(sem.minBb, 16);
    assert.equal(sem.maxBb, 22);
    assert.equal(sem.raw, '16-22BB');

    const sem2 = parseTrainerStack('30-40BB');
    assert.equal(sem2.minBb, 30);
    assert.equal(sem2.maxBb, 40);
  });

  test('MINIMUM / plus stack formats', () => {
    const sem = parseTrainerStack('40BBplus');
    assert.equal(sem.type, 'MINIMUM');
    assert.equal(sem.minBb, 40);
    assert.equal(sem.raw, '40BBplus');

    const sem2 = parseTrainerStack('115BBplus');
    assert.equal(sem2.type, 'MINIMUM');
    assert.equal(sem2.minBb, 115);
  });

  test('CONTEXT vs_ stacks are not hero depth', () => {
    const sem = parseTrainerStack('vs_15BB_2x');
    assert.equal(sem.type, 'CONTEXT');
    assert.equal(sem.contextKind, 'VS_OPEN');
    assert.equal(sem.bb, 15);

    const sem2 = parseTrainerStack('vs_12-16BB');
    assert.equal(sem2.type, 'CONTEXT');
    assert.equal(sem2.minBb, 12);
    assert.equal(sem2.maxBb, 16);
  });

  test('stack matching — exact stack in range', () => {
    const band = parseTrainerStack('16-22BB');
    assert.equal(matchQueryToRecord(16, band), 'band');
    assert.equal(matchQueryToRecord(22, band), 'band');
    assert.equal(matchQueryToRecord(23, band), 'none');
    assert.equal(matchQueryToRecord(15, band), 'none');
  });

  test('stack matching — minimum band', () => {
    const band = parseTrainerStack('40BBplus');
    assert.equal(matchQueryToRecord(40, band), 'band');
    assert.equal(matchQueryToRecord(100, band), 'band');
    assert.equal(matchQueryToRecord(39, band), 'none');
  });

  test('stack matching — exact record', () => {
    const rec = parseTrainerStack('25BB');
    assert.equal(matchQueryToRecord(25, rec), 'exact');
    assert.equal(matchQueryToRecord(24, rec), 'none');
  });

  test('ambiguous overlap returns ambiguity flag', () => {
    const records = [parseTrainerStack('16-22BB'), parseTrainerStack('20-30BB')];
    const result = matchQueryToRecords('21BB', records);
    assert.equal(result.kind, 'band');
    assert.equal(result.ambiguous, true);
    assert.ok(result.matches >= 2);
  });

  test('green action resolution — does not blanket nAI→RAISE', () => {
    // Entirely above threshold
    const raise = greenActionForStack('40BBplus');
    assert.equal(raise.rawAction, 'RAISE');
    assert.equal(raise.gradingAllowed, true);

    const raiseRange = greenActionForStack('30-40BB');
    assert.equal(raiseRange.rawAction, 'RAISE');

    // Spans boundary — stays ambiguous
    const ambiguous = greenActionForStack('16-22BB');
    assert.equal(ambiguous.rawAction, 'nAI');
    assert.equal(ambiguous.gradingAllowed, false);
    assert.match(ambiguous.resolutionNote, /spans.*boundary/i);

    // Entirely below threshold
    const nai = greenActionForStack('8-12BB');
    assert.equal(nai.rawAction, 'nAI');
    assert.equal(nai.gradingAllowed, false);

    // Context stacks — no UO rule
    const ctx = greenActionForStack('vs_15BB_2x');
    assert.equal(ctx.rawAction, 'nAI');
    assert.equal(ctx.gradingAllowed, false);
  });

  test('boundary 18BB exact is nAI per UO threshold', () => {
    const exact18 = greenActionForStack('18BB');
    assert.equal(exact18.rawAction, 'nAI');
    const exact19 = greenActionForStack('19BB');
    assert.equal(exact19.rawAction, 'RAISE');
    assert.equal(UO_RAISE_THRESHOLD_BB, 18);
  });

  test('30BB boundary between trainer bands', () => {
    const band30_40 = parseTrainerStack('30-40BB');
    assert.equal(matchQueryToRecord(30, band30_40), 'band');
    assert.equal(matchQueryToRecord(40, band30_40), 'band');
    assert.equal(matchQueryToRecord(29, band30_40), 'none');
    assert.equal(matchQueryToRecord(41, band30_40), 'none');
  });
});
