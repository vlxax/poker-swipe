import { createGameState } from '../game/gameState.js';
import { calculateEquity } from '../equity/index.js';
import { evaluateAction } from './actionEvaluator.js';
import { classifyMistake } from './mistakeClassifier.js';
import { confidenceFor } from './confidence.js';
import { solveCFR } from '../cfr/cfrSolver.js';
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
  const classification = evLossBB != null ? classifyMistake({ evLossBB, preset: input.thresholdPreset || 'cash' }) : null;

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

// Solve-based decision analysis. Requires both hero and villain ranges and runs
// CFR over the postflop tree to produce action EVs, best action and exploitability.
function analyzeDecisionSolver(input) {
  assert(input.heroRange, 'MISSING_INPUT', 'heroRange is required in solver mode');
  assert(input.villainRange, 'MISSING_INPUT', 'villainRange is required in solver mode');
  assert(input.board && input.board.length >= 3, 'INVALID_BOARD', 'solver mode requires a postflop board');

  const r = solveCFR(input, {
    iterations: input.iterations,
    seed: input.seed,
    algorithm: input.algorithm
  });

  const rootActions = (r._tree && r._tree.root.actions) || [];
  const amountById = {};
  for (const a of rootActions) amountById[a.id] = a.amountBB;

  const actions = Object.keys(r.actionEV).map((id) => {
    const shape = actionFromId(id);
    return {
      action: { ...shape, amountBB: amountById[id] != null ? round(amountById[id], 4) : null },
      evBB: round(r.actionEV[id], 4),
      analysisMethod: r.algorithm
    };
  }).sort((a, b) => b.evBB - a.evBB);

  let best = actions[0] || null;
  for (const a of actions) if (a.evBB > best.evBB) best = a;

  const heroActionId = r.heroAction;
  const heroActionEntry = heroActionId != null && r.actionEV[heroActionId] != null
    ? actions.find((a) => actionId(a.action) === heroActionId)
    : null;
  const heroEV = heroActionId != null && r.actionEV[heroActionId] != null
    ? round(r.actionEV[heroActionId], 4)
    : null;
  const bestEV = best ? best.evBB : null;
  const evLossBB = heroEV != null && bestEV != null ? round(bestEV - heroEV, 4) : null;
  const classification = evLossBB != null ? classifyMistake({ evLossBB, preset: input.thresholdPreset || 'cash' }) : null;

  const analysisMethod = r.algorithm;
  const conf = confidenceFor({
    analysisMethod,
    simulations: r.iterations,
    comboCount: r.tree.heroComboCount,
    heuristic: false,
    iterations: r.iterations
  });

  return {
    version: 'solver-core',
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
    calculation: {
      bestAction: best ? best.action : null,
      heroAction: heroActionEntry ? heroActionEntry.action : null,
      actions,
      heroEV,
      bestEV,
      evLossBB,
      severity: classification ? classification.severity : null,
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
      algorithm: r.algorithm,
      iterations: r.iterations,
      exploitabilityBB: r.exploitability.exploitabilityBB,
      exploitabilityPerPlayerBB: r.exploitability.exploitabilityPerPlayerBB,
      convergence: r.convergence.status,
      tree: r.tree,
      confidence: conf.label,
      confidenceScore: conf.confidence,
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