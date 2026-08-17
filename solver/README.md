# PokerSwipe Solver Core

A DOM-independent, pure-math poker analysis engine. No browser globals, no UI,
no MutationObserver — only deterministic calculations that can be unit-tested
with `node --test`.

## Honest positioning

This is **not** a full-game GTO solver and makes **no claim** of Nash equilibrium
for the real poker game. It does contain a **real regret-matching CFR core**
(Vanilla CFR and CFR+) that solves the *abstracted* game tree exactly, plus a
deterministic exploitation (best-response) metric. Exploitability is always
reported for the abstracted tree, never for the real game.

The engine computes well-defined poker mathematics (hand strength, card-removal
ranges, hot/cold equity, pot odds, required equity, SPR, EV of simple lines) and
combines them with **documented strategic heuristics** for decision guidance.

Every calculation that involves a strategy assumption reports which method was
used so callers never mistake an approximation for an exact answer:

| `analysisMethod` | Meaning |
| --- | --- |
| `exact` | Enumerated all possible outcomes — no sampling. |
| `monte_carlo` | Seeded, reproducible Monte Carlo sampling. |
| `heuristic` | Uses a strategic model/fold-equity assumption, not pure math. |
| `cfr` | Counterfactual regret minimization (Vanilla CFR), abstracted tree. |
| `cfr_plus` | CFR+ (regrets clamped ≥ 0, linear averaging optional). |

## Layout

```
solver/
  src/
    index.js           Public facade (default + named export)
    api/               Public API methods, validation, structured errors
    cards/             Card parsing, deck, combinatorics, hand evaluator
    ranges/            Range parsing, expansion, blockers, weights, propagation
    equity/            Seeded RNG, Monte Carlo, exhaustive, engine
    math/              Pot odds, required equity, SPR, EV, bet sizing
    game/              Game state, action state, streets, positions
    tree/              Postflop game tree: nodes, betting, chance, information sets
    cfr/               CFR/CFR+ trainer, regret matching, strategy, exploitability
    analysis/          Decision analyzer, action evaluation, mistakes, confidence
    explanations/      Human-readable explanation builder
    config/            Thresholds, default bet sizes, defaults
  data/                Preflop ranges, default bet sizes (JSON)
  scripts/             Benchmark script (npm run benchmark:cfr)
  tests/               node --test suite (ESM)
```

## Public API

All methods are async and return either a result object or a structured error
`{ error: { code, message, details? } }` — they never reject on invalid input.

- `evaluateHand({ cards })` — best five-card hand category.
- `calculateEquity({ heroHand, villainRange, board?, street?, iterations?, seed? })`
  — equity vs. a range; reports `analysisMethod` and `simulations`.
- `expandRange({ range, blockedCards? })` — expands a range into concrete combos.
- `calculatePotOdds({ potBeforeBet, bet, call })` — pot odds + required equity.
- `calculateEV({ actionType, ... })` — EV of a `call`, `bet`, or `raise` line.
- `calculateSPR({ pot, stack })` — stack-to-pot ratio.
- `analyzeDecision({ ... })` — full decision: per-action EV, best line, severity
  (GOOD/INACCURACY/MISTAKE/BLUNDER), confidence, and a rendered explanation.
  Pass `{ mode: 'solver' }` (with `heroRange` + `villainRange` and a postflop
  board) to run the CFR core instead of the heuristic path. In solver mode it
  returns a production analysis: `strategy` + `actionEV` (root actor, legal
  actions only), `recommendedAction` + `recommendedFrequency`, `evLossBB`,
  `exploitabilityBB`/`exploitabilityPerPlayerBB`, `convergence`, a private
  `rangeEquilibration` check, solver-aware `confidence`, `abstractions`, a
  rendered `explanation`, and `calculation.mistakeSeverity` on the
  negligible/small/medium/large/severe scale. Set `adaptive: true` (or
  `iterations: 'adaptive'`) to use automated convergence detection.

### Strategic (CFR) methods

All take a heads-up postflop config and are seedable/deterministic:

```js
{
  street: 'flop' | 'turn' | 'river',
  board: ['2c', '4d', '7h', ...],
  heroRange: { AA: 1, KK: 1 },
  villainRange: { QQ: 1, JJ: 1 },
  pot, effectiveStackBB, heroPosition, villainPosition,
  betSizes?: { flop: [0.5], turn: [0.5], river: [0.5] },
  maxChanceBranches?: 1,          // cap dealt cards per street (chance abstraction)
  maxRaisesPerStreet?: 2,         // raise depth cap
  heroAction?: { type, sizePot }  // the line hero actually took (for evLossBB)
}
```

- `buildTree(input)` — builds the game tree and returns a summary plus the root
  action set (no CFR run). Use it to inspect the abstraction before solving.
- `solveCFR(input, options)` — Vanilla CFR solve. Options: `{ iterations, seed,
  algorithm: 'cfr'|'cfr_plus', linearAveraging }`. For **adaptive** (automated
  convergence detection) use `{ adaptive: true }` or `iterations: 'adaptive'`,
  plus optional `{ minIterations, maxIterations, checkEvery,
  exploitabilityTargetBB, strategyDeltaTarget, evDeltaTargetBB,
  rangeDeltaTarget, stableChecksRequired }`. Safety limits: `{ maxSolveMs }`
  stops at a time budget (`stopReason: 'time_limit'`), and `{ signal }` (an
  AbortSignal-like `{ aborted }`) aborts with a `CANCELLED` error. Returns
  `{ algorithm, iterations, adaptive, game, rootStrategy, aggregateStrategy,
  actionEV, bestAction, heroAction, heroEV, bestEV, evLossBB, exploitability,
  convergence, tree, meta }`. The internal `_trainer`/`_tree` fields are included
  so `getStrategy` / `getActionEV` can reuse a solve.
- `solve(input, options)` — dispatcher (currently aliases CFR; normalizes the
  `algorithm` option).
- `getStrategy(resultOrInput, options?)` — `{ rootStrategy, aggregateStrategy }`
  from a prior `solveCFR` result, or re-solves from raw input.
- `getActionEV(resultOrInput, options?)` — `{ actionEV, bestAction }`.

Result highlights:

- `aggregateStrategy` — reach-weighted average action frequencies at the root.
- `actionEV` — per-action EV (BB) for the root actor under the average strategy.
- `evLossBB` — `bestEV - heroEV` when `heroAction` is provided (mistake metric).
- `exploitability` — `{ heroBR, villainBR, heroEV, villainEV, exploitabilityBB,
  exploitabilityPerPlayerBB }` via best response against the average strategy.
- `convergence` — fixed mode: `{ status: 'early'|'approximate'|'converged',
  delta, samples }`. Adaptive mode also returns `{ converged, iterationsRun,
  stopReason: 'converged'|'max_iterations'|'time_limit', exploitabilityBB,
  exploitabilityHistory, strategyDelta, evDeltaBB, regretDelta, meanAbsRegret,
  stableChecks, lastRangeDelta }`.
- `meta` — `analysisMethod`, `treeAbstraction`, `betAbstraction`, `chanceMode:
  'enumerated'|'capped'`, `rangeAbstraction`, `adaptive`, `iterationsRun`,
  `minIterations`, `rangeDeltaTarget`, `stopReason`, `durationMs`.

### Adaptive convergence

Set `adaptive: true` (or `iterations: 'adaptive'`) to stop as soon as several
**consecutive** checkpoints are stable, instead of running a fixed iteration
count. Every `checkEvery` iterations (past `minIterations`) the solver samples
several independent signals together — strategy delta, action-EV delta, per-player
exploitability, and a range-equilibration (reach-stability) check — and only
declares convergence after `stableChecksRequired` consecutive checkpoints where
**all** signals are within their targets. Convergence is never declared on a
single metric. The run is bounded by `minIterations`/`maxIterations` and the
optional `maxSolveMs` time budget, and can be aborted via `signal`.

`rangeEquilibration` is an **internal validation metric**: it measures how stable
each combo's (private) reach weight into its decision nodes has become. It never
exposes private ranges — it only verifies the reach profile has stopped moving,
which is a signal that the CFR strategies have equilibrated.

### Solver confidence & explanations

Solver results use a solver-aware confidence (`meta.confidence` /
`confidence.level`) that only reports `high` when the solver **converged** and the
abstraction is fine enough; non-converged or coarse-abstraction runs are capped
below `high`. The rendered `explanation` (solver mode) is a PokerSwipe prose
structure `{ summary, why, alternative, reliability }` and never claims "exact
GTO" or "perfect play".

## Abstractions (honesty flags)

The solver solves the *abstracted* game exactly, and every result is labelled:

- `treeAbstraction: true` — depth/count caps (`maxDepth`, `maxNodes`) can prune.
- `betAbstraction: true` — only the sizes in `betSizes`/`raiseSizes` are legal.
- `chanceMode: 'enumerated'|'capped'` — cards are dealt enumeratively (no
  sampling). When `maxChanceBranches` is finite the mode is `'capped'`: only that
  many cards per street are dealt, and **all-in EV is marginalized over the same
  capped branches** so the tree and its payoffs stay consistent.
- `rangeAbstraction: true` — ranges are weighted classes; per-combo granularity
  is kept internally but reach is weighted by combo weight.

A smaller `exploitabilityPerPlayerBB` means closer to a Nash equilibrium **for
the abstracted tree** — it is not a real-game exploitability figure.

## Range notation

Pair `AA`, offsuit `AKo`, suited `AKs`, `T9s`. Non-pair hands **must** include
an `s`/`o` suffix. Weights are per class (e.g. `{ AA: 1, AKo: 1 }`).

## Determinism

Monte Carlo uses a seeded RNG (`mulberry32`); the CFR core uses an enumerative
traversal with no sampling. Pass `seed` to reproduce a run exactly.

## Benchmark

```bash
cd solver
npm run benchmark:cfr
```

Prints solve time, tree size, iterations/sec and exploitability for a river,
turn and flop scenario, showing exploitability decreasing with iterations, and
a fixed-vs-adaptive comparison showing how many iterations automated convergence
detection saves.

## Running tests

```bash
cd solver
node --test 'tests/**/*.test.js'
```

## Limitations

- Heads-up postflop only (no multiway, ICM/PKO/PLO/bounty, no preflop).
- Hot/cold equity only — no post-flop betting-tree / opponent-response model.
- Bet/raise EV uses heuristic fold-equity assumptions (reported as `heuristic`).
- CFR solves an *abstracted* tree, not the real game; see Abstractions above.
- Explanations are template-rendered from numeric facts, not generated prose.