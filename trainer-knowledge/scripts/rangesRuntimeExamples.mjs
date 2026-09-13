#!/usr/bin/env node
/**
 * Runtime examples for trainer ranges integration (Stage 3A QA).
 * Run: node trainer-knowledge/scripts/rangesRuntimeExamples.mjs
 */
import {
  resetTrainerCache,
  lookupTrainerSpot,
  lookupTrainerHandAction,
  listCharts,
  getChartById
} from '../index.js';
import {
  buildTrainerMatrix,
  handDetailFromTrainer,
  selectionToTrainerQuery
} from '../adapters/rangesAdapter.js';
import { MATCH_STATUS } from '../status.js';

const lookup = {
  lookupSpot: lookupTrainerSpot,
  lookupHand: async (chartId, hand) => {
    const { lookupTrainerHand } = await import('../lookup.js');
    return lookupTrainerHand({ chartId, hand });
  },
  lookupHandAction: lookupTrainerHandAction,
  lookupCharts: (q) => lookupTrainerSpot(q),
  charts: listCharts(),
  getChartById
};

resetTrainerCache();

const examples = [
  {
    name: 'UO EP 2-4bb AA (EXACT)',
    sel: { dataSource: 'trainer', situation: 'uo_open', position: 'EP', stackBand: '2-4', trainerSourceMode: 'uo' },
    hand: 'AA'
  },
  {
    name: 'UO EP 2-4bb K2s (UNSELECTED)',
    sel: { dataSource: 'trainer', situation: 'uo_open', position: 'EP', stackBand: '2-4', trainerSourceMode: 'uo' },
    hand: 'K2s'
  },
  {
    name: 'Resteal callpush (PARTIAL metadata)',
    sel: { dataSource: 'trainer', situation: 'resteal', trainerSourceMode: 'callpush', trainerSpot: 'Resteal', position: 'BTN', stackBand: '25BB' },
    hand: 'A5s'
  },
  {
    name: 'Vs Squeeze 25BB (spot + sizing)',
    sel: { dataSource: 'trainer', situation: 'vs_squeeze', trainerSourceMode: 'vssqueeze', rawSpot: 'Caller_IP_R_Mid', position: 'Any_position', stackBand: '25BB', betSize: '5x' },
    hand: 'QQ'
  },
  {
    name: 'SB vs BB BB_Def (position group spot)',
    sel: { dataSource: 'trainer', situation: 'sb_vs_bb', trainerSourceMode: 'sbvsbb', trainerSpot: 'BB_Def', position: 'BB', stackBand: '20BB' },
    hand: 'JTs'
  }
];

console.log('=== RANGES TRAINER LOOKUP RUNTIME EXAMPLES ===\n');

for (const ex of examples) {
  const query = selectionToTrainerQuery(ex.sel);
  const spot = lookupTrainerSpot(query);
  const hand = await lookupTrainerHandAction({ ...query, hand: ex.hand });
  const matrix = await buildTrainerMatrix(lookup, ex.sel);
  const detail = await handDetailFromTrainer(lookup, ex.sel, ex.hand);

  console.log(`--- ${ex.name} ---`);
  console.log('Query:', JSON.stringify(query));
  console.log('Match:', spot.status, spot.mismatches?.length ? spot.mismatches : '');
  console.log('Chart:', spot.chart?.id || 'none');
  console.log('Hand:', ex.hand, '→', hand.action, '| grading:', hand.gradingAllowed, '| status:', hand.dataStatus);
  console.log('Provenance:', detail.provenanceDebug || 'n/a');
  console.log('Matrix gradable cells:', Object.values(matrix.cells).filter((c) => c.gradingAllowed).length);
  console.log('');
}

console.log('=== POSITION GROUP EXAMPLE ===');
const group = lookupTrainerSpot({ sourceMode: 'vssqueeze', heroPosition: 'EP', stack: '25BB', betSize: '5x' });
console.log('EP vs group chart', group.chart?.heroPosition?.raw, '→', group.status);

console.log('\n=== UNKNOWN / NO MATCH ===');
const none = lookupTrainerSpot({ sourceMode: 'uo', heroPosition: 'EP', stack: '999BB' });
console.log('EP 999BB UO →', none.status, none.chart?.id || 'no chart');
