import { createGameState } from '../game/gameState.js';
import { calculateEquity } from '../equity/index.js';
import { evaluateAction } from './actionEvaluator.js';
import { classifyMistake } from './mistakeClassifier.js';
import { confidenceFor, solverConfidence } from './confidence.js';
import { solveCFR } from '../cfr/cfrSolver.js';
import { buildSolverExplanation } from '../explanations/explanationBuilder.js';
import { rangeEquilibrationResult } from './rangeEquilibration.js';
import { SolverError, assert } from '../api/errors.js';

export function analyzeDecision(input = {}) {
  if (input.mode === 'solver' || input.analysisMode === 'solver') {
    return analyzeDecisionSolver(input);
  }
  return analyzeDecisionHeuristic(input);
}

function analyzeDecisionHeuristic(input) {
  const state = createGameState(input);

  assert(state.villainRange, 'INVALID_RANGE', 'villainRange is required for decision analysis');
  assert(state.availableActions.length > 0, 'NO_AVAILABLE_ACTIONS', 'no available actions provided');

  // hot/cold showdown equity (no future-street / opponent response model)
  const equityResult = calculateEquity({
    heroHand: state.heroHand,
    villainRange: state.villainRange,
    board: state.board,
    street: state.street,
    deadCards: state.deadCards,
    iterations: input.iterations,
    seed: input.seed
  });
  const equity = equityResult.equity;

  const ctx = {
    potBB: state.potBB,
    equity,
    effectiveStackBB: state.effectiveStackBB,
    facingBetBB: input.facingBetBB
  };

  const actions = state.availableActions.map((action) => {
    const res = evaluateAction(action, ctx);
    return {
      action: { type: action.type, sizePot: action.sizePot, amountBB: action.amountBB },
      evBB: round(res.evBB, 4),
      analysisMethod: res.analysisMethod,
      ...(res.model ? { model: res.model } : {})
    };
  });

  // best action
  let best = actions.reduce((a, b) => (b.evBB > a.evBB ? b : a), actions[0]);

  let heroEV = null;
  let heroActionEntry = null;
  if (state.heroAction) {
    heroActionEntry = actions.find(
      (a) => a.action.type === state.heroAction.type &&
        (state.heroAction.sizePot == null || a.action.sizePot === state.heroAction.sizePot)
    ) || { action: state.heroAction, evBB: evaluateAction(state.heroAction, ctx).evBB, analysisMethod: 'heuristic' };
    heroEV = round(heroActionEntry.evBB, 4);
  }

  const bestEV = round(best.evBB, 4);
  const evLossBB = heroEV != null ? round(bestEV - heroEV, 4) : null;
  const classification = evLossBB != null ? classifyMistake({ evLossBB, potBB: state.potBB, preset: input.thresholdPreset || 'cash' }) : null;

  // overall analysisMethod: heuristic when any strategic assumption is used
  const analysisMethod = 'heuristic';
  const conf = confidenceFor({
    analysisMethod: equityResult.analysisMethod,
    simulations: equityResult.simulations,
    comboCount: null,
    heuristic: true,
    iterations: equityResult.simulations
  });

  return {
    version: 'solver-core',
    game: {
      street: state.street,
      heroPosition: state.heroPosition,
      villainPosition: state.villainPosition,
      potBB: state.potBB,
      effectiveStackBB: state.effectiveStackBB,
      spr: state.potBB > 0 ? round(state.effectiveStackBB / state.potBB, 3) : null,
      heroHand: state.heroHand,
      board: state.board
    },
    equity: equityResult,
    calculation: {
      bestAction: { type: best.action.type, sizePot: best.action.sizePot, amountBB: best.action.amountBB },
      heroAction: state.heroAction ? { type: state.heroAction.type, sizePot: state.heroAction.sizePot, amountBB: state.heroAction.amountBB } : null,
      actions,
      heroEV,
      bestEV,
      evLossBB,
      severity: classification ? classification.severity : null,
      mistakeSeverity: classification ? classification.mistakeSeverity : null,
      analysisMethod
    },
    explanation: {
      summary: null,
      why: [],
      keyConcept: null,
      recommendedPractice: null
    },
    meta: {
      version: 'solver-core',
      analysisMethod,
      equityMethod: equityResult.analysisMethod,
      simulations: equityResult.simulations,
      confidence: conf.label,
      confidenceScore: conf.confidence
    }
  };
}

// Solve-based decision analysis. Runs CFR over the postflop tree (fixed or
// adaptive) and returns a production-ready strategy + EV + exploitability +
// convergence + confidence + explanation result.
function analyzeDecisionSolver(input) {
  assert(input.heroRange, 'MISSING_INPUT', 'heroRange is required in solver mode');
  assert(input.villainRange, 'MISSING_INPUT', 'villainRange is required in solver mode');
  assert(input.board && input.board.length >= 3, 'INVALID_BOARD', 'solver mode requires a postflop board');

  const r = solveCFR(input, {
    iterations: input.iterations,
    seed: input.seed,
    algorithm: input.algorithm,
    adaptive: input.adaptive,
    minIterations: input.minIterations,
    maxIterations: input.maxIterations,
    checkEvery: input.checkEvery,
    exploitabilityTargetBB: input.exploitabilityTargetBB,
    strategyDeltaTarget: input.strategyDeltaTarget,
    evDeltaTargetBB: input.evDeltaTargetBB,
    rangeDeltaTarget: input.rangeDeltaTarget,
    stableChecksRequired: input.stableChecksRequired,
    maxSolveMs: input.maxSolveMs,
    signal: input.signal
  });

  const tree = r._tree;
  const cfg = tree.cfg;
  const rootActions = tree.root.actions || [];
  const amountById = {};
  for (const a of rootActions) amountById[a.id] = a.amountBB;

  // Build strategy + actionEV keyed by the root's real, legal action ids only.
  const strategy = {};
  const actionEV = {};
  const ordered = [];
  for (const [id, ev] of Object.entries(r.actionEV)) {
    const evBB = round(ev, 4);
    const freq = round(r.aggregateStrategy[id] || 0, 4);
    strategy[id] = freq;
    actionEV[id] = evBB;
    const shape = actionFromId(id);
    ordered.push({
      id,
      action: { ...shape, amountBB: amountById[id] != null ? round(amountById[id], 4) : null },
      evBB,
      frequency: freq
    });
  }
  ordered.sort((a, b) => b.evBB - a.evBB);

  const best = ordered[0] || null;
  const recommendedAction = best ? best.action : null;
  const recommendedFrequency = best ? best.frequency : null;

  const heroActionId = r.heroAction;
  const heroEntry = heroActionId != null && r.actionEV[heroActionId] != null
    ? ordered.find((o) => o.id === heroActionId)
    : null;
  const heroAction = heroEntry ? heroEntry.action : null;
  const heroActionFrequency = heroEntry ? heroEntry.frequency : null;
  const heroActionEVBB = heroEntry ? heroEntry.evBB : null;
  const bestActionEVBB = best ? best.evBB : null;
  const evLossBB = heroActionEVBB != null && bestActionEVBB != null ? round(bestActionEVBB - heroActionEVBB, 4) : null;

  const exploit = r.exploitability;
  const analysisMethod = r.algorithm === 'cfr_plus' ? 'cfr_plus' : 'cfr';

  const evSeparationBB = best && ordered[1] ? round(best.evBB - ordered[1].evBB, 4) : 0;
  const chanceCapped = cfg.maxChanceBranches != null && Number.isFinite(cfg.maxChanceBranches) && cfg.maxChanceBranches < Infinity;
  const streetBets = (cfg.betSizes && cfg.betSizes[r.game.street]) || [];
  const minBetSize = streetBets.length ? Math.min(...streetBets) : 1;

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
        preset: input.thresholdPreset || 'cash',
        confidence: conf.score
      })
    : null;

  const abstractions = {
    treeAbstraction: true,
    betAbstraction: cfg.betSizes,
    chanceMode: r.meta.chanceMode,
    chanceBranches: chanceCapped ? cfg.maxChanceBranches : null,
    rangeAbstraction: true
  };

  const explanation = buildSolverExplanation({
    best,
    bestFrequency: recommendedFrequency,
    heroAction,
    evLossBB,
    convergence: r.convergence,
    exploitabilityBB: exploit.exploitabilityPerPlayerBB,
    chanceBranches: abstractions.chanceBranches,
    confidence: conf
  });

  return {
    version: 'solver-core',
    solverMode: true,
    analysisMethod,
    game: {
      street: r.game.street,
      heroPosition: r.game.heroPosition,
      villainPosition: r.game.villainPosition,
      potBB: r.game.potBB,
      effectiveStackBB: r.game.effectiveStackBB,
      spr: r.game.potBB > 0 ? round(r.game.effectiveStackBB / r.game.potBB, 3) : null,
      board: r.game.board
    },
    equity: null,
    recommendedAction,
    recommendedFrequency,
    strategy,
    actionEV,
    heroAction,
    heroActionFrequency,
    heroActionEVBB,
    bestActionEVBB,
    evLossBB,
    exploitabilityBB: round(exploit.exploitabilityBB, 4),
    exploitabilityPerPlayerBB: round(exploit.exploitabilityPerPlayerBB, 4),
    convergence: r.convergence,
    rangeEquilibration: rangeEquilibrationResult(r.convergence.lastRangeDelta, r.meta.rangeDeltaTarget || 0.01),
    confidence: conf,
    abstractions,
    explanation,
    calculation: {
      bestAction: recommendedAction,
      heroAction,
      actions: ordered.map((o) => ({ action: o.action, evBB: o.evBB, frequency: o.frequency, analysisMethod })),
      heroEV: heroActionEVBB,
      bestEV: bestActionEVBB,
      evLossBB,
      severity: classification ? classification.severity : null,
      mistakeSeverity: classification ? classification.mistakeSeverity : null,
      evLossPctPot: classification ? classification.evLossPctPot : null,
      analysisMethod
    },
    meta: {
      version: 'solver-core',
      analysisMethod,
      algorithm: r.algorithm,
      iterations: r.iterations,
      adaptive: r.adaptive,
      exploitabilityBB: exploit.exploitabilityBB,
      exploitabilityPerPlayerBB: exploit.exploitabilityPerPlayerBB,
      convergence: r.convergence.status,
      stopReason: r.convergence.stopReason,
      tree: r.tree,
      confidence: conf.level,
      confidenceScore: conf.score,
      durationMs: r.meta.durationMs
    }
  };
}

function actionId(action) {
  if (!action) return null;
  if (action.type === 'bet') return `bet_${Math.round((action.sizePot || 0) * 100)}`;
  return action.type;
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

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}