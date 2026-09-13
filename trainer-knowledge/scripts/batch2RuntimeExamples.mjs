#!/usr/bin/env node
/**
 * Stage 4 — Batch 2 runtime lookup examples (manifest-exact dimensions).
 */
import { performance } from 'node:perf_hooks';
import { resetTrainerCache, lookupTrainerHandAction } from '../index.js';
import { formatProvenanceDebug } from '../provenance.js';

resetTrainerCache();

const examples = [
  { label: 'CALLPUSH BB 27.5BB', q: { sourceMode: 'callpush', heroPosition: 'BB', stack: '27.5BB', hand: 'AA' } },
  { label: 'VS1R BB 30-40BB AKs', q: { sourceMode: 'vs1r', heroPosition: 'BB', stack: '30-40BB', opponentPosition: 'BTN', hand: 'AKs' } },
  { label: 'VSSQUEEZE Any 25BB 5x QQ', q: { sourceMode: 'vssqueeze', rawSpot: 'Caller_IP_R_Mid', heroPosition: 'Any_position', stack: '25BB', betSize: '5x', hand: 'QQ' } },
  { label: 'HUANTE SB 20BB JTs', q: { sourceMode: 'huante', heroPosition: 'SB', stack: '20BB', hand: 'JTs' } },
  { label: 'VS1R1C Any 25BB', q: { sourceMode: 'vs1r1c', heroPosition: 'Any_position', stack: '25BB', hand: 'A5s' } },
  { label: 'VS3BET EP-LJ 25BB KK', q: { sourceMode: 'vs3bet', rawSpot: 'Hero_OOP_EP-LJ', heroPosition: 'EP-LJ', stack: '25BB', hand: 'KK' } },
  { label: 'VS2R Any 40BB 76s', q: { sourceMode: 'vs2r', heroPosition: 'Any_position', stack: '40BB', hand: '76s' } },
  { label: 'SBVSBB BB 20BB AI', q: { sourceMode: 'sbvsbb', rawSpot: 'BB_Def', heroPosition: 'BB', stack: '20BB', hand: 'JTs' } },
  { label: 'VS1RSHORT BB 12BB', q: { sourceMode: 'vs1rshort', heroPosition: 'BB', stack: '12BB', hand: 'KQo' } },
  { label: 'VS4BET CO 100BB', q: { sourceMode: 'vs4bet', heroPosition: 'CO', stack: '100BB', hand: 'QQ' } },
  { label: 'VSLIMP BTN 25BB', q: { sourceMode: 'vslimp', heroPosition: 'BTN', stack: '25BB', hand: 'A9s' } },
  { label: 'MIXED vs1r AKs', q: { sourceMode: 'vs1r', heroPosition: 'BB', stack: '30-40BB', opponentPosition: 'BTN', hand: 'AKs' } },
  { label: 'POSITION GROUP EP vs Any', q: { sourceMode: 'vssqueeze', heroPosition: 'EP', stack: '25BB', betSize: '5x', hand: 'JJ' } },
  { label: 'PARTIAL stack mismatch', q: { sourceMode: 'callpush', heroPosition: 'BB', stack: '999BB', hand: 'AA' } },
  { label: 'UNKNOWN orange action', q: { sourceMode: 'vs1rshort', heroPosition: 'BB', stack: '12BB', hand: 'T9o' } }
];

console.log('=== BATCH 2 HAND-LEVEL RUNTIME LOOKUPS ===\n');
const t0 = performance.now();
for (const ex of examples) {
  const r = lookupTrainerHandAction(ex.q);
  console.log(`--- ${ex.label} ---`);
  console.log('QUERY:', JSON.stringify(ex.q));
  console.log('MATCH STATUS:', r.status);
  console.log('TRAINER ACTION:', r.action);
  console.log('FREQUENCY:', r.strategies?.[0]?.frequency ?? (r.isMixed ? 'mixed' : '100'));
  console.log('GRADING ALLOWED:', r.gradingAllowed);
  console.log('CHART ID:', r.chart?.id || 'none');
  console.log('PROVENANCE:', formatProvenanceDebug(r.provenance || r.chart?.provenance) || 'n/a');
  if (r.isMixed && r.strategies) console.log('STRATEGIES:', JSON.stringify(r.strategies));
  if (r.mismatches?.length) console.log('MISMATCHES:', r.mismatches.join('; '));
  console.log('');
}
console.log(`Lookup time for ${examples.length} queries: ${(performance.now() - t0).toFixed(1)}ms`);
