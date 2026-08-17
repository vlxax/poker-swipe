# PokerSwipe Solver Core

A DOM-independent, pure-math poker analysis engine. No browser globals, no UI,
no MutationObserver — only deterministic calculations that can be unit-tested
with `node --test`.

## Honest positioning

This is **not** a GTO solver and makes **no claim** of Nash equilibrium.

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

## Layout

```
solver/
  src/
    index.js           Public facade (default + named export)
    api/               Public API methods, validation, structured errors
    cards/             Card parsing, deck, combinatorics, hand evaluator
    ranges/            Range parsing, expansion, blockers, weights
    equity/            Seeded RNG, Monte Carlo, exhaustive, engine
    math/              Pot odds, required equity, SPR, EV, bet sizing
    game/              Game state, action state, streets, positions
    analysis/          Decision analyzer, action evaluation, mistakes, confidence
    explanations/      Human-readable explanation builder
    config/            Thresholds, default bet sizes, defaults
  data/                Preflop ranges, default bet sizes (JSON)
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

## Range notation

Pair `AA`, offsuit `AKo`, suited `AKs`, `T9s`. Non-pair hands **must** include
an `s`/`o` suffix. Weights are per class (e.g. `{ AA: 1, AKo: 1 }`).

## Determinism

Monte Carlo uses a seeded RNG (`mulberry32`); the core never calls
`Math.random`. Pass `seed` to reproduce a run exactly.

## Running tests

```bash
cd solver
node --test 'tests/**/*.test.js'
```

## Limitations

- Hot/cold equity only — no post-flop betting-tree / opponent-response model.
- Bet/raise EV uses heuristic fold-equity assumptions (reported as `heuristic`).
- Explanations are template-rendered from numeric facts, not generated prose.