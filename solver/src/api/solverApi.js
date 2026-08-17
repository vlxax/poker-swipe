import { calculateEquity } from '../equity/index.js';
import { evaluateCards } from '../cards/handEvaluator.js';
import { expandRange } from '../ranges/rangeExpander.js';
import { calculatePotOdds } from '../math/potOdds.js';
import { calculateRequiredEquity } from '../math/requiredEquity.js';
import { calculateSPR } from '../math/spr.js';
import { calculateCallEV, calculateBetEV, calculateRaiseEV } from '../math/ev.js';
import { analyzeDecision } from '../analysis/decisionAnalyzer.js';
import { buildExplanation } from '../explanations/explanationBuilder.js';
import { catchErrors } from './errors.js';
import {
  validateEquityInput, validateAnalyzeInput, validateHandInput, validateRangeInput
} from './validation.js';

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