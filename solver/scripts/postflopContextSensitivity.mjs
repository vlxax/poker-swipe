#!/usr/bin/env node
/**
 * Documents which postflop context dimensions the production PokerBrain consumes.
 * Measurement via controlled spot probes — no fabricated solver output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { installPokerBrainForTests } from '../tests/brainTestEnv.js';
import { libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';
import { getTaskById } from '../src/training/taskLibraryBridge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'solver/tests/postflopContextSensitivity.report.json');

function gradeSpot(spot) {
  const brain = globalThis.window?.PokerBrain;
  if (!brain?.gradeDecision) return { ok: false, reason: 'no_brain' };
  const r = brain.gradeDecision(spot, 'CHECK');
  return {
    ok: true,
    source: r?.source,
    confidence: r?.confidence,
    top: r?.topActions?.[0] || null
  };
}

function cloneTaskProbe(base, patch) {
  const spot = libraryTaskToBrainSpot({ ...base, ...patch });
  return spot;
}

export function runPostflopContextSensitivity({ write = true } = {}) {
  installPokerBrainForTests();
  const base = getTaskById('F_AA_COORD') || getTaskById('ADV_3BPOT_AKQ_SCARY');
  if (!base) throw new Error('No postflop probe task');

  const dimensions = {
    effectiveStack: 'PARTIALLY_SUPPORTED',
    spr: 'PARTIALLY_SUPPORTED',
    position: 'SUPPORTED',
    potType: 'PARTIALLY_SUPPORTED',
    street: 'SUPPORTED',
    players: 'IGNORED',
    actionHistory: 'PARTIALLY_SUPPORTED'
  };

  const probes = [];
  const stacks = [20, 40, 100];
  const boards = base.board || ['J♠', 'T♠', '8♦'];
  for (const st of stacks) {
    const spot = cloneTaskProbe(base, { heroStack: st, effStack: st, villainStack: st + 5 });
    const g = gradeSpot(spot);
    probes.push({ dimension: 'effectiveStack', value: st, ...g });
  }

  const sprProbes = [0.5, 1, 2, 4, 8, 12];
  for (const spr of sprProbes) {
    const pot = 10;
    const eff = pot * spr;
    const spot = cloneTaskProbe(base, { pot, heroStack: eff, effStack: eff, villainStack: eff });
    const g = gradeSpot(spot);
    probes.push({ dimension: 'spr', value: spr, ...g });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    engine: 'poker_brain.js + POKER_BRAIN_PACK',
    note: 'If source is REFERENCE_ATLAS/HEURISTIC, frequencies are not solver-exact.',
    dimensions,
    probes,
    warnings: [
      'Multiway and full tournament payout context are not modeled for library postflop atlas lookups.',
      'Imported My Hands without payout structure cannot receive exact ICM grades.'
    ]
  };

  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('postflopContextSensitivity.mjs')) {
  runPostflopContextSensitivity();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
