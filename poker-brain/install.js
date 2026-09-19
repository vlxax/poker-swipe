/**
 * Browser install: attach canonical analyze/grade to window.PokerBrain.
 */
import { createPokerBrainEngine } from './index.js';
import { ENGINE_VERSION } from './version.js';
import { analyzeWithTrace } from './analyze.js';
import { traceDecision } from './trace.js';
import { explainRangeCellForRanges } from './integrations/rangesBrainVm.js';
import { lookupReferencePolicy } from '../ranges-ui/referenceRanges.js';

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
  PB.unifiedEngine = ENGINE_VERSION;
  PB.engineVersion = ENGINE_VERSION;
  PB.trace = (input, opts = {}) => traceDecision(analyzeWithTrace(input, {
    legacyGradeDecision,
    legacyNodeFor,
    classOf,
    pack,
    referenceLookupPolicy: lookupReferencePolicy,
    ...opts
  }));
  PB.explainRangeCell = (meta, hand, opts = {}) => explainRangeCellForRanges(meta, hand, {
    pack,
    classOf,
    referenceLookupPolicy: lookupReferencePolicy,
    legacyNodeFor,
    ...opts
  });

  const prevAnalyzeHand = PB.analyzeHand?.bind(PB);
  if (prevAnalyzeHand) {
    PB.analyzeHand = (hand) => {
      const base = prevAnalyzeHand(hand) || {};
      try {
        const unified = engine.analyze({ mode: 'myhands', hand, handId: hand.sourceHandId }, {
          referenceLookupPolicy: lookupReferencePolicy
        });
        return {
          ...base,
          unifiedDecision: unified,
          brainVm: {
            recommendation: unified.recommendation,
            grading: unified.grading,
            contextQuality: unified.contextQuality,
            provenance: unified.provenance,
            brainKnows: unified.brainKnows,
            strategySourceKnows: unified.strategySourceKnows,
            ignoredMaterialFields: unified.contextCompatibility?.ignoredMaterialFields,
            missingMaterialFields: unified.contextCompatibility?.missingMaterialFields,
            conflicts: unified.conflicts,
            equity: unified.equity,
            engineVersion: unified.engineVersion
          }
        };
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
