import { createGameState } from '../game/gameState.js';
import { calculateEquity } from '../equity/index.js';
import { evaluateAction } from './actionEvaluator.js';
import { classifyMistake } from './mistakeClassifier.js';
import { confidenceFor } from './confidence.js';
import { SolverError, assert } from '../api/errors.js';

export function analyzeDecision(input = {}) {
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

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}