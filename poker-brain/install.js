/**
 * Browser install: attach canonical analyze/grade to window.PokerBrain.
 */
import { createPokerBrainEngine } from './index.js';

function install() {
  const PB = window.PokerBrain;
  if (!PB) return;

  const legacyGradeDecision = PB.gradeDecision?.bind(PB);
  const legacyNodeFor = PB.nodeFor?.bind(PB);
  const classOf = PB.classOf?.bind(PB);
  const pack = window.POKER_BRAIN_PACK;

  const engine = createPokerBrainEngine({
    pack,
    classOf,
    legacyNodeFor,
    legacyGradeDecision
  });

  PB._legacyGradeDecision = legacyGradeDecision;
  PB.analyze = (input, opts) => engine.analyze(input, {
    traceEnabled: opts?.trace ?? false,
    legacyGradeDecision,
    legacyNodeFor,
    classOf,
    pack,
    ...opts
  });
  PB.grade = (input, userAction, opts) => engine.grade(input, userAction, {
    traceEnabled: opts?.trace ?? false,
    legacyGradeDecision,
    legacyNodeFor,
    classOf,
    pack,
    ...opts
  });
  PB.unifiedEngine = 'POKERBRAIN_UNIFIED_DECISION_ENGINE_V1';

  const prevAnalyzeHand = PB.analyzeHand?.bind(PB);
  if (prevAnalyzeHand) {
    PB.analyzeHand = (hand) => {
      const base = prevAnalyzeHand(hand) || {};
      try {
        const unified = engine.analyze({ mode: 'myhands', hand });
        return { ...base, unifiedDecision: unified };
      } catch (_) {
        return base;
      }
    };
  }
}

if (typeof window !== 'undefined') {
  install();
}

export { install };
