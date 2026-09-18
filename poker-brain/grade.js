import { analyze } from './analyze.js';
import { spotFromContext } from './adapters/legacySpot.js';

/**
 * Grade user action via canonical pipeline; legacy letter grade preserved when executor provided.
 */
export function grade(input = {}, userAction = null, deps = {}) {
  const decision = analyze(input, { ...deps, traceEnabled: deps.traceEnabled ?? false });
  const action = userAction ?? input.action ?? input.chosenActionType ?? input.chosenAction?.type;
  const size = input.size ?? input.chosenSize ?? input.chosenAction?.sizePct ?? null;

  let legacy = null;
  if (typeof deps.legacyGradeDecision === 'function') {
    const spot = spotFromContext(decision.context || input.context || normalizeSpot(input));
    legacy = deps.legacyGradeDecision(spot, action, size);
  }

  const grading = {
    available: !!legacy,
    acceptedActions: decision.grading.acceptedActions,
    grade: legacy?.grade ?? null,
    legacyResult: legacy || null
  };

  return {
    ...decision,
    grading,
    legacyGrade: legacy
  };
}

function normalizeSpot(input) {
  const raw = input.raw || input;
  return raw.spot || raw.scenario || raw;
}
