// Multi-street hand analysis: reconstruct a played heads-up NLH hand from its
// recorded actions, re-solve each Hero decision spot with CFR (carrying the real
// pot / committed split / outstanding bet), and aggregate the results into a
// single reviewable analysis: per-decision EV + strategy + explanation, total EV
// lost, the biggest mistake, and interesting training spots.
//
// This is the high-level entry point for PokerSwipe's "My Hands" analysis. It is
// deterministic when given a seed, performance-guarded (max nodes / solve time /
// adaptive iterations / cancellation / chance pruning), and never mutates its
// input.

import { replayHand } from './replayHand.js';
import { buildHandExplanation } from './handExplanation.js';
import { inspectDecision, detectInterestingSpots } from './interestingSpots.js';
import { solveCFR } from '../cfr/cfrSolver.js';
import { classifyMistake } from '../analysis/mistakeClassifier.js';
import { solverConfidence } from '../analysis/confidence.js';
import { SolverError, assert } from '../api/errors.js';

const STREET_ORDER = ['flop', 'turn', 'river'];

// Default chance-abstraction for hand analysis. Full enumeration of turn/river
// runouts is expensive; cap the branches so a hand can be analyzed in seconds
// while keeping the approximation explicit in the reliability note.
const DEFAULT_MAX_CHANCE_BRANCHES = 1;

export function analyzeHand(input = {}, options = {}) {
  const start = Date.now();

  // ---- Normalize the caller's shorthand into the replay + solver inputs. ----
  const hero = input.hero || 'hero';
  const villain = input.villain || 'villain';
  const heroPosition = input.positions?.hero || input.heroPosition || 'BTN';
  const villainPosition = input.positions?.villain || input.villainPosition || 'BB';
  const effectiveStackBB = input.stacks?.effectiveStackBB
    ?? input.stacks?.effective
    ?? input.stacks
    ?? input.effectiveStackBB;

  assert(effectiveStackBB != null, 'MISSING_INPUT', 'effectiveStackBB (or stacks.effectiveStackBB) is required');
  assert(Number.isFinite(Number(effectiveStackBB)) && Number(effectiveStackBB) > 0,
    'INVALID_STACK', 'effectiveStackBB must be a positive number');

  const heroRange = input.ranges?.hero ?? input.heroRange;
  const villainRange = input.ranges?.villain ?? input.villainRange;
  assert(heroRange != null, 'MISSING_INPUT', 'ranges.hero (or heroRange) is required');
  assert(villainRange != null, 'MISSING_INPUT', 'ranges.villain (or villainRange) is required');

  const preflopActions = input.preflopActions || [];
  const actions = input.actions || [];
  const board = input.board || [];

  // ---- 1. Reconstruct the hand flow into Hero decision spots. ----
  const replayed = replayHand({
    hero,
    villain,
    heroPosition,
    villainPosition,
    effectiveStackBB,
    blinds: input.blinds,
    preflopActions,
    actions,
    board
  });

  if (replayed.decisions.length === 0) {
    throw new SolverError('INVALID_INPUT',
      'no Hero postflop decision spots found in the hand (nothing to analyze)');
  }

  // ---- 2. Re-solve each Hero decision with CFR. ----
  const solverCfg = solverConfig(input, options);
  const decisions = replayed.decisions.map((spot) =>
    solveDecision({
      spot,
      heroRange,
      villainRange,
      heroPosition,
      villainPosition,
      config: solverCfg,
      thresholdPreset: input.thresholdPreset
    })
  );

  // ---- 3. Aggregate. ----
  const solved = decisions.filter((d) => d.solved);
  const totalEvLossBB = round(
    solved.reduce((sum, d) => sum + (d.evLossBB != null ? d.evLossBB : 0), 0),
    4
  );

  let biggestMistake = null;
  for (const d of solved) {
    if (d.evLossBB == null) continue;
    if (!biggestMistake || d.evLossBB > biggestMistake.evLossBB) {
      biggestMistake = { street: d.street, decisionIndex: d.index, evLossBB: d.evLossBB };
    }
  }

  const interestingSpots = detectInterestingSpots(decisions);

  return {
    hand: {
      street: replayed.terminal ? replayed.terminal.street : null,
      board,
      effectiveStackBB: Number(effectiveStackBB),
      heroPosition,
      villainPosition
    },
    decisions,
    totalEvLossBB,
    biggestMistake,
    interestingSpots,
    summary: summarize({ decisions: solved, totalEvLossBB, biggestMistake, decisionsCount: replayed.decisions.length }),
    terminal: replayed.terminal,
    meta: {
      version: 'solver-core',
      analyzedDecisions: decisions.length,
      solvedDecisions: solved.length,
      totalEvLossBB,
      durationMs: Date.now() - start,
      adaptive: solverCfg.adaptive,
      maxChanceBranches: solverCfg.maxChanceBranches,
      seed: solverCfg.seed
    }
  };
}

// Normalize the analyzer config over the solver defaults, applying the
// performance guards (chance cap default, adaptive convergence default).
function solverConfig(input, options) {
  const cfg = input.config || {};
  const adaptive = cfg.adaptive != null ? cfg.adaptive
    : options.adaptive != null ? options.adaptive : true;
  const maxChanceBranches = cfg.maxChanceBranches != null
    ? cfg.maxChanceBranches
    : options.maxChanceBranches != null ? options.maxChanceBranches : DEFAULT_MAX_CHANCE_BRANCHES;
  return {
    adaptive,
    maxChanceBranches,
    seed: cfg.seed ?? options.seed ?? 12345,
    maxSolveMs: cfg.maxSolveMs ?? options.maxSolveMs ?? 0,
    signal: cfg.signal ?? options.signal ?? null,
    iterations: cfg.iterations ?? options.iterations ?? 'adaptive',
    algorithm: cfg.algorithm ?? options.algorithm ?? 'cfr',
    minIterations: cfg.minIterations ?? options.minIterations,
    maxIterations: cfg.maxIterations ?? options.maxIterations,
    checkEvery: cfg.checkEvery ?? options.checkEvery,
    exploitabilityTargetBB: cfg.exploitabilityTargetBB ?? options.exploitabilityTargetBB,
    strategyDeltaTarget: cfg.strategyDeltaTarget ?? options.strategyDeltaTarget,
    evDeltaTargetBB: cfg.evDeltaTargetBB ?? options.evDeltaTargetBB,
    rangeDeltaTarget: cfg.rangeDeltaTarget ?? options.rangeDeltaTarget,
    stableChecksRequired: cfg.stableChecksRequired ?? options.stableChecksRequired,
    betSizes: cfg.betSizes ?? options.betSizes,
    raiseSizes: cfg.raiseSizes ?? options.raiseSizes,
    maxRaisesPerStreet: cfg.maxRaisesPerStreet ?? options.maxRaisesPerStreet,
    maxNodes: cfg.maxNodes ?? options.maxNodes,
    maxDepth: cfg.maxDepth ?? options.maxDepth
  };
}

// Solve a single Hero decision spot and map the CFR result into the analysis
// shape used by the explanation + interesting-spot layers.
function solveDecision({ spot, heroRange, villainRange, heroPosition, villainPosition, config, thresholdPreset }) {
  const solveInput = {
    street: spot.street,
    board: spot.board,
    potBB: spot.potBB,
    effectiveStackBB: spot.effectiveStackBB,
    heroRange,
    villainRange,
    heroPosition,
    villainPosition,
    startingCommitted: spot.startingCommitted,
    firstToAct: 'hero',
    heroAction: spot.heroAction,
    betSizes: config.betSizes,
    raiseSizes: config.raiseSizes,
    maxRaisesPerStreet: config.maxRaisesPerStreet,
    maxNodes: config.maxNodes,
    maxDepth: config.maxDepth,
    maxChanceBranches: config.maxChanceBranches
  };

  const solveOptions = {
    adaptive: config.adaptive,
    iterations: config.iterations,
    seed: config.seed,
    maxSolveMs: config.maxSolveMs,
    signal: config.signal,
    algorithm: config.algorithm,
    minIterations: config.minIterations,
    maxIterations: config.maxIterations,
    checkEvery: config.checkEvery,
    exploitabilityTargetBB: config.exploitabilityTargetBB,
    strategyDeltaTarget: config.strategyDeltaTarget,
    evDeltaTargetBB: config.evDeltaTargetBB,
    rangeDeltaTarget: config.rangeDeltaTarget,
    stableChecksRequired: config.stableChecksRequired
  };

  let r;
  try {
    r = solveCFR(solveInput, solveOptions);
  } catch (err) {
    return failedDecision(spot, err);
  }

  const tree = r._tree;
  const cfg = tree.cfg;
  const rootActions = tree.root.actions || [];
  const amountById = {};
  for (const a of rootActions) amountById[a.id] = a.amountBB;

  const strategy = {};
  const actionEV = {};
  const ordered = [];
  for (const [id, ev] of Object.entries(r.actionEV)) {
    const evBB = round(ev, 4);
    const freq = round(r.aggregateStrategy[id] || 0, 4);
    strategy[id] = freq;
    actionEV[id] = evBB;
    ordered.push({
      id,
      action: { ...actionFromId(id), amountBB: amountById[id] != null ? round(amountById[id], 4) : null },
      evBB,
      frequency: freq
    });
  }
  ordered.sort((a, b) => b.evBB - a.evBB);

  const best = ordered[0] || null;
  const recommendedAction = best ? best.action : null;
  const recommendedFrequency = best ? best.frequency : null;
  const recommendedSizeBB = recommendedAction && recommendedAction.amountBB != null
    ? round(recommendedAction.amountBB, 4) : null;

  const exactId = heroActionIdFor(spot.heroAction);
  let heroActionId = exactId;
  if (!(heroActionId != null && r.actionEV[heroActionId] != null)) {
    const nearest = nearestActionId(spot.heroAction, ordered);
    if (nearest != null) heroActionId = nearest;
  }
  const heroMapped = exactId !== heroActionId;
  const heroEntry = heroActionId != null && r.actionEV[heroActionId] != null
    ? ordered.find((o) => o.id === heroActionId) : null;
  const actionTaken = spot.heroAction
    ? { ...spot.heroAction, amountBB: betAmountBB(spot.heroAction, spot.potBB) }
    : null;
  const heroActionFrequency = heroEntry ? heroEntry.frequency : null;
  const heroEV = heroEntry ? heroEntry.evBB : null;
  const bestEV = best ? best.evBB : null;
  const evLossBB = heroEV != null && bestEV != null ? round(bestEV - heroEV, 4) : null;

  const exploit = r.exploitability;
  const chanceCapped = Number.isFinite(cfg.maxChanceBranches) && cfg.maxChanceBranches < Infinity;
  const streetBets = (cfg.betSizes && cfg.betSizes[r.game.street]) || [];
  const minBetSize = streetBets.length ? Math.min(...streetBets) : 1;

  const evSeparationBB = best && ordered[1] ? round(best.evBB - ordered[1].evBB, 4) : 0;
  const conf = solverConfidence({
    converged: r.convergence.converged,
    stopReason: r.convergence.stopReason,
    exploitabilityBB: exploit.exploitabilityPerPlayerBB,
    iterations: r.convergence.iterationsRun,
    minIterations: r.meta.minIterations != null ? r.meta.minIterations : 200,
    chanceAbstraction: chanceCapped ? cfg.maxChanceBranches : Infinity,
    betAbstraction: minBetSize,
    rangeAbstraction: 0,
    evSeparationBB
  });

  const classification = evLossBB != null
    ? classifyMistake({
        evLossBB,
        potBB: r.game.potBB,
        preset: thresholdPreset || 'cash',
        confidence: conf.score
      })
    : null;

  const explanation = buildHandExplanation({
    street: spot.street,
    potBB: r.game.potBB,
    spr: r.game.potBB > 0 ? round(r.game.effectiveStackBB / r.game.potBB, 3) : null,
    actionTaken,
    recommendedAction,
    recommendedFrequency,
    legalActions: ordered,
    evLossBB,
    evSeparationBB,
    equity: null,
    confidence: conf,
    convergence: r.convergence,
    exploitabilityBB: exploit.exploitabilityPerPlayerBB,
    chanceBranches: chanceCapped ? cfg.maxChanceBranches : null,
    analysisMethod: r.algorithm,
    mistakeSeverity: classification ? classification.mistakeSeverity : null
  });

  return {
    index: spot.index,
    solved: true,
    street: spot.street,
    board: spot.board,
    potBB: round(r.game.potBB, 4),
    effectiveStackBB: r.game.effectiveStackBB,
    spr: r.game.potBB > 0 ? round(r.game.effectiveStackBB / r.game.potBB, 3) : null,
    actionTaken,
    actionTakenId: heroActionId,
    heroActionMapped: heroMapped,
    heroActionFrequency,
    legalActions: ordered,
    strategy,
    actionEV,
    recommendedAction,
    recommendedSizeBB,
    recommendedFrequency,
    heroEV,
    bestEV,
    evLossBB,
    severity: classification ? classification.severity : null,
    mistakeSeverity: classification ? classification.mistakeSeverity : null,
    evSeparationBB,
    confidence: conf,
    convergence: r.convergence,
    exploitabilityBB: round(exploit.exploitabilityBB, 4),
    equity: null,
    explanation,
    meta: {
      analysisMethod: r.algorithm,
      iterations: r.iterations,
      adaptive: r.adaptive,
      durationMs: r.meta.durationMs,
      treeNodeCount: tree.stats ? tree.stats.nodeCount : tree.nodeCount,
      maxChanceBranches: chanceCapped ? cfg.maxChanceBranches : null
    }
  };
}

// A decision spot that could not be solved (e.g. tree too large, cancelled,
// no legal actions). Recorded so the hand review stays useful and transparent.
function failedDecision(spot, err) {
  return {
    index: spot.index,
    solved: false,
    street: spot.street,
    board: spot.board,
    potBB: spot.potBB,
    effectiveStackBB: spot.effectiveStackBB,
    actionTaken: spot.heroAction || null,
    error: {
      code: err && err.code ? err.code : 'INTERNAL',
      message: err && err.message ? err.message : String(err)
    },
    evLossBB: null,
    explanation: null
  };
}

// Concise, factual overall hand summary.
function summarize({ decisions, totalEvLossBB, biggestMistake, decisionsCount }) {
  const solved = decisions.length;
  const parts = [];
  parts.push(`Analyzed ${solved} of ${decisionsCount} Hero decision spot${decisionsCount === 1 ? '' : 's'} across ${streetRange(decisions)}.`);
  if (totalEvLossBB > 0.0005) {
    parts.push(`Total EV lost vs. optimal: ${bb(totalEvLossBB)}.`);
    if (biggestMistake) {
      parts.push(`Biggest mistake: ${bb(biggestMistake.evLossBB)} on the ${biggestMistake.street}.`);
    }
  } else if (solved > 0) {
    parts.push('No significant EV losses found — the chosen lines were close to optimal in the abstraction used.');
  }
  return parts.join(' ');
}

function streetRange(decisions) {
  const streets = decisions.map((d) => d.street).filter(Boolean);
  if (streets.length === 0) return 'n/a';
  const uniq = [...new Set(streets)].sort((a, b) => STREET_ORDER.indexOf(a) - STREET_ORDER.indexOf(b));
  return uniq.join(' → ');
}

function actionFromId(id) {
  if (id === 'check') return { type: 'check' };
  if (id === 'fold') return { type: 'fold' };
  if (id === 'call') return { type: 'call' };
  if (id === 'all_in') return { type: 'all_in' };
  if (id.startsWith('bet_')) return { type: 'bet', sizePot: Number(id.slice(4)) / 100 };
  if (id.startsWith('raise_')) return { type: 'raise', sizePot: Number(id.slice(6)) / 100 };
  return { type: id };
}

// Map a Hero action into the tree's action-id space (postflop). A bet/raise maps
// to bet_<sizePot*100> / raise_<sizePot*100>; everything else uses its type.
function heroActionIdFor(action) {
  if (!action) return null;
  if (action.type === 'bet') return `bet_${Math.round((action.sizePot || 0) * 100)}`;
  if (action.type === 'raise') return `raise_${Math.round((action.sizePot || 0) * 100)}`;
  return action.type;
}

// When a Hero action's exact size is not in the tree abstraction, snap to the
// nearest legal bet/raise size so an EV can still be reported. Returns the
// closest action id, or the action type for non-aggressive actions.
function nearestActionId(action, ordered) {
  if (!action) return null;
  if (action.type === 'bet' || action.type === 'raise') {
    const candidates = ordered.filter((o) => o.action.type === action.type && o.action.sizePot != null);
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let bestDiff = Math.abs(best.action.sizePot - action.sizePot);
    for (let i = 1; i < candidates.length; i++) {
      const d = Math.abs(candidates[i].action.sizePot - action.sizePot);
      if (d < bestDiff) { best = candidates[i]; bestDiff = d; }
    }
    return best.id;
  }
  return action.type;
}

// Reconstruct the amount added for a bet (sizePot * pot) so consumers have a BB
// figure; non-bet actions carry no amount here.
function betAmountBB(action, potBB) {
  if (!action) return null;
  if (action.type === 'bet' && action.sizePot != null && potBB != null) {
    return round(action.sizePot * potBB, 4);
  }
  return null;
}

function bb(n) {
  return `${Number(n).toFixed(2)} BB`;
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}