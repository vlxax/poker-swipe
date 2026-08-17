// CFR benchmark: measures solve time, tree size and exploitability convergence
// across representative heads-up postflop scenarios. Run with:
//   node scripts/benchmarkCfr.js   (from solver/)
//
// Multi-street scenarios use maxChanceBranches to keep the tree tractable; the
// reported exploitability is for the *abstracted* game, not a full-game value.
import { solveCFR } from '../src/cfr/cfrSolver.js';

const scenarios = [
  {
    name: 'river · 4 combos',
    input: {
      street: 'river',
      board: ['2c', '4d', '7h', '9s', 'Td'],
      heroRange: { AA: 1, KK: 1 },
      villainRange: { QQ: 1, JJ: 1 },
      pot: 10,
      effectiveStackBB: 10,
      heroPosition: 'BTN',
      villainPosition: 'BB',
      betSizes: { river: [0.5, 1] }
    },
    iterationCounts: [50, 200, 1000]
  },
  {
    name: 'turn · capped chance',
    input: {
      street: 'turn',
      board: ['2c', '4d', '7h', '9s'],
      heroRange: { AA: 1, KK: 1 },
      villainRange: { QQ: 1, JJ: 1 },
      pot: 10,
      effectiveStackBB: 10,
      heroPosition: 'BTN',
      villainPosition: 'BB',
      maxChanceBranches: 1,
      betSizes: { turn: [0.5], river: [0.5] }
    },
    iterationCounts: [50, 200, 1000]
  },
  {
    name: 'flop · capped chance',
    input: {
      street: 'flop',
      board: ['2c', '4d', '7h'],
      heroRange: { AA: 1, KK: 1 },
      villainRange: { QQ: 1, JJ: 1 },
      pot: 10,
      effectiveStackBB: 10,
      heroPosition: 'BTN',
      villainPosition: 'BB',
      maxChanceBranches: 1,
      betSizes: { flop: [0.5], turn: [0.5], river: [0.5] }
    },
    iterationCounts: [50, 200, 1000]
  }
];

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

const tableHeader = [
  { key: 'scenario', label: 'scenario' },
  { key: 'iterations', label: 'iterations' },
  { key: 'nodes', label: 'nodes' },
  { key: 'combos', label: 'combos' },
  { key: 'ms', label: 'ms' },
  { key: 'explPerPlayerBB', label: 'expl/BB' },
  { key: 'status', label: 'status' },
  { key: 'best', label: 'best' },
  { key: 'itPerSec', label: 'it/s' }
];
const rows = [];

for (const { name, input, iterationCounts } of scenarios) {
  for (const iterations of iterationCounts) {
    const r = solveCFR(input, { iterations, seed: 1 });
    rows.push({
      scenario: name,
      iterations,
      nodes: r.tree.nodeCount,
      combos: `${r.tree.heroComboCount}x${r.tree.villainComboCount}`,
      ms: r.meta.durationMs,
      explPerPlayerBB: r.exploitability.exploitabilityPerPlayerBB.toFixed(4),
      status: r.convergence.status,
      best: r.bestAction,
      itPerSec: Math.round(iterations / (r.meta.durationMs / 1000))
    });
  }
}

const widths = tableHeader.map((col, i) => Math.max(col.label.length, ...rows.map((row) => String(row[col.key]).length)));

console.log(tableHeader.map((col, i) => pad(col.label, widths[i])).join(' | '));
console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
for (const row of rows) {
  console.log(tableHeader.map((col, i) => pad(row[col.key], widths[i])).join(' | '));
}

const total = rows.reduce((s, r) => s + r.ms, 0);
console.log(`\nTotal: ${total}ms across ${rows.length} runs (seed=1).`);
console.log('Smaller expl/BB = closer to a Nash equilibrium for the abstracted game.');