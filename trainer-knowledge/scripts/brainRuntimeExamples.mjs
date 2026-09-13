#!/usr/bin/env node
/**
 * Stage 3B — Poker Brain trainer runtime examples.
 */
import { resetTrainerCache, lookupTrainerSpot, lookupTrainerHandAction } from '../index.js';
import { buildBrainTrainerResult, mergeBrainAndTrainer } from '../adapters/brainAdapter.js';

const lookup = {
  lookupSpot: lookupTrainerSpot,
  lookupHandAction: lookupTrainerHandAction
};

resetTrainerCache();

const cases = [
  {
    label: 'BRAIN EXACT MATCH',
    spot: { street: 'PREFLOP', pos: 'EP', hero: ['As', 'Ad'], stack: 3, ctx: 'unopened pot' },
    hand: 'AA'
  },
  {
    label: 'BRAIN PARTIAL MATCH',
    spot: { street: 'PREFLOP', pos: 'EP', hero: ['Qh', 'Qd'], stack: 25, ctx: 'squeeze spot', betSize: '99x' },
    hand: 'QQ'
  },
  {
    label: 'BRAIN NO MATCH',
    spot: { street: 'FLOP', pos: 'BTN', hero: ['As', 'Ks'], board: ['Ah', '7d', '2c'], stack: 30, ctx: 'cbet' },
    hand: 'AKo'
  },
  {
    label: 'BRAIN NEEDS CLARIFICATION',
    spot: { street: 'PREFLOP', pos: 'EP', hero: ['Ks', '2s'], stack: 3, ctx: 'unopened pot' },
    hand: 'K2s'
  }
];

console.log('=== POKER BRAIN TRAINER RUNTIME ===\n');

for (const c of cases) {
  const result = buildBrainTrainerResult(lookup, c.spot, c.hand);
  console.log(`--- ${c.label} ---`);
  console.log('Status:', result.status);
  console.log('Trainer:', result.trainer?.actionRaw, '| grading:', result.trainer?.gradingAllowed);
  console.log('Mismatches:', result.mismatches?.length ? result.mismatches.join('; ') : 'none');
  console.log('Provenance:', result.trainer?.provenanceDebug || 'n/a');
  console.log('');
}

const conflict = mergeBrainAndTrainer({
  brainResult: { source: 'PREFLOP_ATLAS', explanation: 'brain raise', action: 'RAISE' },
  trainerResult: {
    status: 'EXACT_TRAINER_MATCH',
    trainer: { actionRaw: 'AI', gradingAllowed: true, provenanceDebug: 'TRAINER·UO' },
    mismatches: []
  }
});
console.log('--- TRAINER VS BRAIN CONFLICT ---');
console.log('Primary:', conflict.primarySource);
console.log('Brain preserved:', !!conflict.brain);
console.log('Trainer recommendation:', conflict.trainerRecommendation);
