import { calculateEquity } from '../equity/index.js';
import { evaluateCards } from '../cards/handEvaluator.js';
import { expandRange } from '../ranges/rangeExpander.js';
import { calculatePotOdds } from '../math/potOdds.js';
import { calculateRequiredEquity } from '../math/requiredEquity.js';
import { calculateSPR } from '../math/spr.js';
import { calculateCallEV, calculateBetEV, calculateRaiseEV } from '../math/ev.js';
import { analyzeDecision } from '../analysis/decisionAnalyzer.js';
import { buildExplanation } from '../explanations/explanationBuilder.js';
import { catchErrors, SolverError } from './errors.js';
import {
  validateEquityInput, validateAnalyzeInput, validateHandInput, validateRangeInput,
  validateSolverInput, validateSolverModeInput
} from './validation.js';
import { buildGameTree } from '../tree/treeBuilder.js';
import { solveCFR as solveCFRCore } from '../cfr/cfrSolver.js';

function gameSummary(tree) {
  return {
    street: tree.game.street,
    board: tree.game.board,
    potBB: tree.game.potBB,
    effectiveStackBB: tree.game.effectiveStackBB,
    heroPosition: tree.game.heroPosition,
    villainPosition: tree.game.villainPosition,
    firstToAct: tree.cfg.firstToAct
  };
}

function rootActions(tree) {
  const root = tree.root;
  return (root.actions || []).map((a) => ({
    id: a.id, type: a.type, sizePot: a.sizePot, amountBB: a.amountBB
  }));
}

// Accept either a prior solveCFR result (carrying _trainer/_tree) or raw input.
function ensureSolverResult(arg, options) {
  if (arg && arg._trainer && arg._tree) return arg;
  return solveCFRCore(arg, options);
}

export const PokerSwipeSolver = {
  version: 'solver-core',

  async analyzeDecision(input) {
    return catchErrors(() => {
      validateAnalyzeInput(input);
      const decision = analyzeDecision(input);
      decision.explanation = buildExplanation({
        bestAction: decision.calculation.bestAction,
        heroAction: decision.calculation.heroAction,
        actions: decision.calculation.actions,
        evLossBB: decision.calculation.evLossBB,
        severity: decision.calculation.severity,
        street: decision.game.street,
        heroPosition: decision.game.heroPosition,
        villainPosition: decision.game.villainPosition,
        equity: decision.equity ? decision.equity.equity : null,
        potBB: decision.game.potBB
      });
      return decision;
    })(input);
  },

  // Build the postflop game tree (heads-up) from config and return an inspection
  // summary plus the root action set. This never runs CFR.
  async buildTree(input) {
    return catchErrors(() => {
      validateSolverInput(input);
      const tree = buildGameTree(input);
      return {
        game: gameSummary(tree),
        tree: tree.summary(),
        root: {
          type: tree.root.type,
          playerToAct: tree.root.playerToAct,
          actions: rootActions(tree)
        }
      };
    })(input);
  },

  // Vanilla CFR / CFR+ solve. Returns strategies, action EVs, exploitability,
  // convergence and tree summary. The internal `_trainer`/`_tree` fields (when
  // kept) let getStrategy/getActionEV reuse a solve without re-solving.
  async solveCFR(input, options = {}) {
    return catchErrors(() => {
      validateSolverInput(input);
      const r = solveCFRCore(input, options);
      return {
        algorithm: r.algorithm,
        iterations: r.iterations,
        game: r.game,
        rootStrategy: r.rootStrategy,
        aggregateStrategy: r.aggregateStrategy,
        actionEV: r.actionEV,
        bestAction: r.bestAction,
        heroAction: r.heroAction,
        heroEV: r.heroEV,
        bestEV: r.bestEV,
        evLossBB: r.evLossBB,
        exploitability: r.exploitability,
        convergence: r.convergence,
        tree: r.tree,
        meta: r.meta,
        _trainer: r._trainer,
        _tree: r._tree
      };
    })(input, options);
  },

  // Dispatcher for strategic solvers. Currently the only strategic method is CFR,
  // so `solve` is an alias that normalizes the algorithm option.
  async solve(input, options = {}) {
    return catchErrors(() => {
      validateSolverInput(input);
      const algorithm = String(options.algorithm || 'cfr').toLowerCase();
      if (!['cfr', 'cfr_plus'].includes(algorithm)) {
        throw new SolverError('INVALID_CONFIG', `unsupported algorithm: ${algorithm}`);
      }
      return this.solveCFR(input, { ...options, algorithm });
    })(input, options);
  },

  // Root / aggregate strategy for a solved (or freshly solved) game.
  async getStrategy(arg, options = {}) {
    return catchErrors(() => {
      const r = ensureSolverResult(arg, options);
      return { rootStrategy: r.rootStrategy, aggregateStrategy: r.aggregateStrategy };
    })(arg, options);
  },

  // Action EV at the root for a solved (or freshly solved) game.
  async getActionEV(arg, options = {}) {
    return catchErrors(() => {
      const r = ensureSolverResult(arg, options);
      return { actionEV: r.actionEV, bestAction: r.bestAction };
    })(arg, options);
  },

  async calculateEquity(input) {
    return catchErrors(() => {
      validateEquityInput(input);
      return calculateEquity(input);
    })(input);
  },

  async evaluateHand(input) {
    return catchErrors(() => {
      const { cards } = validateHandInput(input);
      const res = evaluateCards(cards);
      return {
        category: res.category,
        value: res.value,
        bestFiveCards: res.cards,
        valid: res.valid
      };
    })(input);
  },

  async expandRange(input) {
    return catchErrors(() => {
      validateRangeInput(input);
      const ex = expandRange(input.range || input.villainRange, input.blockedCards || []);
      return {
        combos: ex.combos.map((c) => ({ cards: c.cards, weight: c.weight, class: c.class })),
        totalWeight: ex.totalWeight,
        comboCount: ex.comboCount
      };
    })(input);
  },

  async calculatePotOdds(input) {
    return catchErrors(() => {
      const odds = calculatePotOdds(input);
      const required = calculateRequiredEquity(input);
      return { potOdds: odds, requiredEquity: required };
    })(input);
  },

  async calculateEV(input) {
    return catchErrors(() => {
      const out = { analysisMethod: 'exact' };
      if (input.actionType === 'call') out.evBB = calculateCallEV(input);
      else if (input.actionType === 'bet') {
        out.evBB = calculateBetEV(input);
        out.analysisMethod = 'heuristic';
      } else if (input.actionType === 'raise') {
        out.evBB = calculateRaiseEV(input);
        out.analysisMethod = 'heuristic';
      } else {
        throw new Error('actionType must be call|bet|raise');
      }
      return out;
    })(input);
  },

  async calculateSPR(input) {
    return catchErrors(() => {
      return { spr: calculateSPR(input) };
    })(input);
  }
};

export default PokerSwipeSolver;