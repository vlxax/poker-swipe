import { normalizeDecisionContext, adapters } from './context/normalize.js';
import { resolvePokerDomain } from './routing/resolvePokerDomain.js';
import { collectPokerEvidence } from './evidence/collectPokerEvidence.js';
import { resolvePokerEvidence } from './evidence/resolvePokerEvidence.js';
import { buildDecisionResult } from './contracts/DecisionResult.js';
import { createBrainTrace } from './trace.js';
import { spotFromContext } from './adapters/legacySpot.js';

function normalizeInput(input) {
  if (input?.context && input.context.hero) return input.context;
  const feature = input?.source?.feature || input?.mode;
  if (feature && adapters[feature]) return adapters[feature](input);
  return normalizeDecisionContext(input);
}

export function analyze(input = {}, deps = {}) {
  const context = normalizeInput(input);
  const domain = resolvePokerDomain(context);
  const enrichedContext = { ...context, domain };

  const fullDeps = {
    pack: deps.pack,
    classOf: deps.classOf,
    legacyNodeFor: deps.legacyNodeFor,
    pushFoldEval: deps.pushFoldEval,
    spotFromContext,
    ...deps
  };

  const collected = collectPokerEvidence(enrichedContext, domain, fullDeps);
  const resolved = resolvePokerEvidence(enrichedContext, collected);

  const trace = deps.traceEnabled
    ? createBrainTrace({ domain, context: enrichedContext, collected, resolved })
    : null;

  const result = buildDecisionResult({
    context: enrichedContext,
    domain,
    resolved,
    collected,
    trace
  });
  return { ...result, context: enrichedContext };
}
