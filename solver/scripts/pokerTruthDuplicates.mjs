#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  ROOT,
  readIndexHtml,
  loadCanonicalBrainPack,
  loadInlineBrainPackFromIndex,
  semanticPackDiff,
  normalizeFnBody,
  extractLegacyPush18FromIndex
} from './pokerTruthUtils.mjs';
import { pushFoldEval } from '../../ranges-ui/pushFold.js';

const OUT = path.join(ROOT, 'solver/tests/pokerTruthDuplicates.report.json');

function classifyPackPair() {
  const diffs = semanticPackDiff(loadCanonicalBrainPack(), loadInlineBrainPackFromIndex());
  if (diffs.length === 0) return 'IDENTICAL';
  return 'DRIFTED';
}

function classifyBrainEngine() {
  const fileBody = fs.readFileSync(path.join(ROOT, 'poker_brain.js'), 'utf8');
  const html = readIndexHtml();
  const inline = html.match(/function gradeDecision\(spot,action,size=null\)\{[\s\S]*?\n\}/);
  if (!inline) return { classification: 'UNKNOWN', note: 'inline gradeDecision not found in index.html' };
  const fileFn = fileBody.match(/function gradeDecision\(spot,action,size=null\)\{[\s\S]*?\n\}/);
  if (!fileFn) return { classification: 'UNKNOWN', note: 'gradeDecision not in poker_brain.js' };
  const a = normalizeFnBody(fileFn[0]);
  const b = normalizeFnBody(inline[0]);
  if (a === b) return { classification: 'IDENTICAL', note: 'inline gradeDecision matches poker_brain.js' };
  if (a.length > 0.9 * b.length && b.includes('gradeFromFreq')) {
    return { classification: 'DRIFTED', note: 'inline duplicate of poker_brain gradeDecision with possible edits' };
  }
  return { classification: 'WRAPPER', note: 'inline engine related but not byte-identical' };
}

function evalLegacyPush18(handClass, pos, bb, stage = 'MID', mode = 'PUSH') {
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

function classifyPushFold() {
  const hasLegacy = !!extractLegacyPush18FromIndex();
  if (!hasLegacy) return { classification: 'UNKNOWN' };
  const hands = ['AA', 'AKs', 'A5s', 'KQo', '72o', 'TT', 'J9s'];
  const pos = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const stacks = [8, 10, 12, 15, 20, 25, 30];
  let midMatch = 0;
  let midTotal = 0;
  let stageMismatch = 0;
  for (const hand of hands) {
    for (const p of pos) {
      for (const bb of stacks) {
        for (const mode of ['PUSH', 'CALL']) {
          const pf = pushFoldEval(hand, p, bb, mode);
          const leg = evalLegacyPush18(hand, p, bb, 'MID', mode);
          midTotal++;
          if (pf.label === leg.label && pf.p === leg.p) midMatch++;
          const bub = evalLegacyPush18(hand, p, bb, 'BUBBLE', mode);
          if (pf.label !== bub.label || pf.p !== bub.p) stageMismatch++;
        }
      }
    }
  }
  if (midMatch === midTotal && stageMismatch > 0) {
    return {
      classification: 'WRAPPER',
      note: 'pushFold.js matches legacy push18 at stage=MID; legacy adds BUBBLE/FT; runtime push18 may delegate to GTOBrainV19'
    };
  }
  if (midMatch === midTotal) return { classification: 'ALIAS', note: 'pushFold.js equivalent to legacy push18 at MID' };
  return { classification: 'DRIFTED', note: `MID matrix match ${midMatch}/${midTotal}` };
}

function classifyGtoBrainVersions() {
  const win = { window: {}, console };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'poker_brain_v20.js'), 'utf8'), win);
  const sameRef = win.GTOBrainV19 === win.GTOBrainV20;
  return {
    classification: sameRef ? 'ALIAS' : 'DRIFTED',
    note: sameRef ? 'GTOBrainV19 assigned to GTOBrainV20 in poker_brain_v20.js' : 'V19 and V20 differ'
  };
}

export function runPokerTruthDuplicates({ write = true } = {}) {
  const pairs = [
    {
      id: 'pushFold.js_vs_push18()',
      a: 'ranges-ui/pushFold.js',
      b: 'index.html push18 (legacy formula)',
      ...classifyPushFold()
    },
    {
      id: 'strategy_pack_v17.js_vs_inline_pack',
      a: 'strategy_pack_v17.js',
      b: 'index.html window.POKER_BRAIN_PACK',
      classification: classifyPackPair(),
      note: classifyPackPair() === 'IDENTICAL' ? 'semantic JSON payloads match' : 'semantic drift detected'
    },
    {
      id: 'poker_brain.js_vs_inline_engine',
      a: 'poker_brain.js',
      b: 'index.html inline gradeDecision',
      ...classifyBrainEngine()
    },
    {
      id: 'GTOBrainV19_vs_GTOBrainV20',
      a: 'poker_brain_v20.js GTOBrainV19',
      b: 'poker_brain_v20.js GTOBrainV20',
      ...classifyGtoBrainVersions()
    }
  ];
  const report = { generatedAt: new Date().toISOString(), pairs };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('pokerTruthDuplicates.mjs')) {
  runPokerTruthDuplicates();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
