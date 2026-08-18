// Multi-street hand-analysis benchmark. Analyzes three practical heads-up NLH
// hands that exercise distinct Hero decision streets (flop, turn, river sizing /
// bluff-catch) and reports runtime, tree size, iterations, convergence,
// exploitability, the chosen action and the EV spread across legal actions.
//
// Run with:
//   node scripts/benchmarkHand.js   (from solver/)
//
// The analyzer uses a capped chance abstraction (maxChanceBranches: 1) and fixed
// iterations so every spot is deterministic and fast. Exploitability is for the
// abstracted game, not a full-game value.
import { analyzeHand } from '../src/hand/handAnalyzer.js';

const base = {
  hero: 'hero',
  villain: 'villain',
  heroPosition: 'BTN',
  villainPosition: 'BB',
  effectiveStackBB: 100,
  ranges: { hero: { AA: 1, KK: 1, QQ: 1, JJ: 1 }, villain: { TT: 1, '99': 1, '88': 1, AKs: 1 } }
};

// A Hero decision is the "spot" of interest on each street. The rest of the hand
// is plain action leading into / away from that street so the analyzer has a real
// multi-street flow to replay.
const spots = [
  {
    name: 'flop decision · bet sizing',
    board: ['As', 'Kd', '2h', 'Qs', '3c'],
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },   // flop
      { player: 'villain', type: 'call', amountBB: 3.4 },
      { player: 'hero', type: 'check' },                 // turn
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'bet', amountBB: 6 },      // river
      { player: 'villain', type: 'fold' }
    ],
    focusStreet: 'flop'
  },
  {
    name: 'turn decision · second barrel',
    board: ['Jc', '8d', '4s', '9h', '2d'],
    actions: [
      { player: 'hero', type: 'check' },                 // flop
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'bet', amountBB: 5.5 },    // turn
      { player: 'villain', type: 'call', amountBB: 5.5 },
      { player: 'hero', type: 'check' },                 // river
      { player: 'villain', type: 'check' }
    ],
    focusStreet: 'turn'
  },
  {
    name: 'river decision · bluff-catch / sizing',
    board: ['7h', '6c', '2s', 'Tc', '3d'],
    actions: [
      { player: 'hero', type: 'check' },                 // flop
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },                 // turn
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'bet', amountBB: 6 },      // river
      { player: 'villain', type: 'call', amountBB: 6 }
    ],
    focusStreet: 'river'
  }
];

const iterationCounts = [30, 60];

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

const header = [
  { key: 'spot', label: 'spot' },
  { key: 'street', label: 'street' },
  { key: 'iterations', label: 'iterations' },
  { key: 'nodes', label: 'nodes' },
  { key: 'decisions', label: 'decisions' },
  { key: 'ms', label: 'ms' },
  { key: 'converged', label: 'conv' },
  { key: 'expl/BB', label: 'expl/BB' },
  { key: 'chosen', label: 'chosen' },
  { key: 'evSpread', label: 'evSpreadBB' }
];
const rows = [];

for (const { name, board, actions, focusStreet } of spots) {
  for (const iterations of iterationCounts) {
    const r = analyzeHand({ ...base, board, actions }, {
      adaptive: false, iterations, seed: 7, maxChanceBranches: 1
    });
    const d = r.decisions.find((x) => x.street === focusStreet);
    const evSpread = d && d.legalActions && d.legalActions.length > 0
      ? (Math.max(...d.legalActions.map((a) => a.evBB)) - Math.min(...d.legalActions.map((a) => a.evBB))).toFixed(4)
      : '-';
    rows.push({
      spot: name,
      street: focusStreet,
      iterations,
      nodes: d ? d.meta.treeNodeCount : '-',
      decisions: r.decisions.length,
      ms: d ? d.meta.durationMs : '-',
      converged: d && d.convergence ? (d.convergence.converged ? 'yes' : 'no') : '-',
      'expl/BB': d ? d.exploitabilityBB.toFixed(4) : '-',
      chosen: d && d.recommendedAction
        ? `${d.recommendedAction.type}${d.recommendedAction.sizePot != null ? ` ${(d.recommendedAction.sizePot * 100).toFixed(0)}%` : ''}`
        : '-',
      evSpread
    });
  }
}

const widths = header.map((col, i) => Math.max(col.label.length, ...rows.map((row) => String(row[col.key]).length)));
console.log(header.map((col, i) => pad(col.label, widths[i])).join(' | '));
console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
for (const row of rows) {
  console.log(header.map((col, i) => pad(row[col.key], widths[i])).join(' | '));
}

const total = rows.reduce((s, r) => s + r.ms, 0);
console.log(`\nTotal: ${total}ms across ${rows.length} hand analyses (seed=7, maxChanceBranches=1, adaptive=false).`);
console.log('evSpreadBB = best minus worst EV across Hero legal actions (sizing/line sensitivity).');
console.log('Smaller expl/BB = closer to a Nash equilibrium for the abstracted game.');