#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './pokerTruthUtils.mjs';
import { pushFoldEval, PUSH_STACKS } from '../../ranges-ui/pushFold.js';
import { matrixClasses } from '../../ranges-ui/matrix.js';

const OUT = path.join(ROOT, 'solver/tests/pushFoldEquivalence.report.json');

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const STAGES = ['MID', 'BUBBLE', 'FT'];
const MODES = ['PUSH', 'CALL'];

function legacyPush18(handClass, pos, bb, stage, mode) {
  const R18 = '23456789TJQKA';
  const c = handClass;
  const pair = c.length === 2;
  const a = R18.indexOf(c[0]);
  const b = R18.indexOf(c[1] || c[0]);
  let x = pair
    ? 54 + a * 3.3
    : 18 + a * 2.4 + b * 0.75 + (c.endsWith('s') ? 6 : 0)
      + (Math.abs(a - b) <= 2 ? 4 : 0) + (c[0] === 'A' ? 5 : 0);
  x += ({ UTG: -11, HJ: -6, CO: 0, BTN: 8, SB: 12, BB: 3 }[pos] || 0);
  x += (12 - bb) * 3.4;
  x += (stage === 'BUBBLE' ? -5 : stage === 'FT' ? -7 : 0);
  x += mode === 'CALL' ? -9 : 0;
  x = Math.max(3, Math.min(97, Math.round(x)));
  const label =
    x >= 66 ? (mode === 'CALL' ? 'CALL' : 'PUSH') : x >= 38 ? 'MIX' : 'FOLD';
  return { p: x, label };
}

export function runPushFoldEquivalence({ write = true } = {}) {
  const hands = matrixClasses();
  const stacks = [...new Set([...PUSH_STACKS, 8, 12, 18, 22, 28])].sort((a, b) => a - b);
  const divergences = [];
  let midComparable = 0;
  let midMatch = 0;

  for (const hand of hands) {
    for (const pos of POSITIONS) {
      for (const bb of stacks) {
        for (const mode of MODES) {
          const canon = pushFoldEval(hand, pos, bb, mode);
          const legMid = legacyPush18(hand, pos, bb, 'MID', mode);
          midComparable++;
          if (canon.label === legMid.label && canon.p === legMid.p) midMatch++;
          else {
            divergences.push({
              hand,
              pos,
              bb,
              stage: 'MID',
              mode,
              pushFold: canon,
              push18: legMid
            });
          }
          for (const stage of ['BUBBLE', 'FT']) {
            const leg = legacyPush18(hand, pos, bb, stage, mode);
            if (canon.label !== leg.label || canon.p !== leg.p) {
              divergences.push({
                hand,
                pos,
                bb,
                stage,
                mode,
                pushFold: canon,
                push18: leg,
                reason: 'pushFold.js omits tournament stage adjustment present in push18()'
              });
            }
          }
        }
      }
    }
  }

  const midOnlyDivergences = divergences.filter((d) => d.stage === 'MID');
  const report = {
    generatedAt: new Date().toISOString(),
    canonicalImplementation: 'ranges-ui/pushFold.js',
    legacyImplementation: 'index.html push18() formula',
    runtimeNote:
      'index.html wraps push18 with GTOBrainV19 when available — not covered by this matrix',
    midStage: {
      comparable: midComparable,
      matches: midMatch,
      divergences: midOnlyDivergences.length
    },
    stageAdjustedDivergences: divergences.filter((d) => d.stage !== 'MID').length,
    totalDivergenceRecords: divergences.length,
    pushFoldCanonical: midOnlyDivergences.length === 0,
    push18LegacyDuplicate: midOnlyDivergences.length === 0,
    samples: divergences.slice(0, 40)
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('pushFoldEquivalence.mjs')) {
  runPushFoldEquivalence();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
