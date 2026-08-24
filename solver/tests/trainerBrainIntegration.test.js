// Poker Brain trainer integration tests — Stage 3B

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  resetTrainerCache,
  lookupTrainerSpot,
  lookupTrainerHandAction
} from '../../trainer-knowledge/index.js';
import {
  inferTrainerQueryFromSpot,
  buildBrainTrainerResult,
  mergeBrainAndTrainer
} from '../../trainer-knowledge/adapters/brainAdapter.js';
import { MATCH_STATUS } from '../../trainer-knowledge/status.js';

const nodeLookup = {
  lookupSpot: lookupTrainerSpot,
  lookupHandAction: lookupTrainerHandAction
};

describe('trainer brain integration', { concurrency: 1 }, () => {
  test('BRAIN EXACT MATCH: UO EP 3bb AA', () => {
    resetTrainerCache();
    const spot = {
      street: 'PREFLOP',
      pos: 'EP',
      hero: ['As', 'Ad'],
      stack: 3,
      ctx: 'unopened pot'
    };
    const result = buildBrainTrainerResult(nodeLookup, spot, 'AA');
    assert.equal(result.status, 'EXACT_TRAINER_MATCH');
    assert.equal(result.trainer.actionRaw, 'AI');
    assert.equal(result.trainer.gradingAllowed, true);
  });

  test('BRAIN PARTIAL MATCH: sizing mismatch noted', () => {
    resetTrainerCache();
    const spot = {
      street: 'PREFLOP',
      pos: 'EP',
      hero: ['Qh', 'Qd'],
      stack: 25,
      ctx: 'squeeze spot',
      betSize: '99x'
    };
    const result = buildBrainTrainerResult(nodeLookup, spot, 'QQ');
    assert.ok(
      ['PARTIAL_TRAINER_MATCH', 'TRAINER_DATA_NEEDS_CLARIFICATION'].includes(result.status),
      `expected partial or needs-clarification status, got ${result.status}`
    );
    assert.ok(result.mismatches.some((m) => /betSize|sizing/i.test(m)));
  });

  test('BRAIN NO MATCH: postflop spot skipped', () => {
    resetTrainerCache();
    const spot = { street: 'FLOP', pos: 'BTN', hero: ['As', 'Ks'], board: ['Ah', '7d', '2c'], stack: 30, ctx: 'cbet' };
    const query = inferTrainerQueryFromSpot(spot, 'AKo');
    assert.equal(query, null);
    const result = buildBrainTrainerResult(nodeLookup, spot, 'AKo');
    assert.equal(result.status, 'NO_TRAINER_DATA');
  });

  test('BRAIN EXACT MATCH: UNSELECTED hand grades as FOLD', () => {
    resetTrainerCache();
    const spot = { street: 'PREFLOP', pos: 'EP', hero: ['Ks', '2s'], stack: 3, ctx: 'unopened pot' };
    const result = buildBrainTrainerResult(nodeLookup, spot, 'K2s');
    assert.equal(result.status, 'EXACT_TRAINER_MATCH');
    assert.equal(result.trainer.gradingAllowed, true);
    assert.equal(result.trainer.actionRaw, 'UNSELECTED');
  });

  test('TRAINER VS BRAIN CONFLICT: merge keeps both', () => {
    const merged = mergeBrainAndTrainer({
      brainResult: { source: 'PREFLOP_ATLAS', explanation: 'brain says raise', action: 'RAISE' },
      trainerResult: {
        status: 'EXACT_TRAINER_MATCH',
        trainer: { actionRaw: 'AI', gradingAllowed: true, provenanceDebug: 'TRAINER·UO' },
        mismatches: []
      }
    });
    assert.equal(merged.primarySource, 'TRAINER');
    assert.ok(merged.brain);
    assert.ok(merged.trainerRecommendation);
  });

  test('PARTIAL does not auto-replace brain as primary', () => {
    const merged = mergeBrainAndTrainer({
      brainResult: { source: 'PREFLOP_ATLAS', explanation: 'brain' },
      trainerResult: { status: 'PARTIAL_TRAINER_MATCH', mismatches: ['stack mismatch'], trainer: { actionRaw: 'AI', gradingAllowed: true } }
    });
    assert.equal(merged.primarySource, 'POKER_BRAIN');
    assert.ok(merged.trainerNote);
  });
});
