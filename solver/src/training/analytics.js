// Analytics adapter (requirement P0). A thin event sink decoupled from the
// business logic: the training layer records semantic events, the adapter routes
// them to the training store (and could send them to a remote backend). Business
// logic never depends on localStorage directly — it calls this adapter. Events
// are versioned with a stable name + payload so downstream consumers are stable.

const EVENT_NAMES = new Set([
  'assessment_started',
  'assessment_completed',
  'training_generated',
  'spot_shown',
  'spot_answered',
  'session_completed',
  'drill_error',
  'profile_updated',
  'session_started'
]);

export function isKnownEvent(name) {
  return EVENT_NAMES.has(name);
}

export function createAnalytics({ store = null, now = Date.now, transport = null } = {}) {
  function track(name, payload = {}) {
    const event = {
      name: isKnownEvent(name) ? name : 'custom_' + name,
      payload: payload || {},
      at: now()
    };
    // Persist locally (best-effort, never throws into the caller).
    if (store && typeof store.addAnalyticsEvent === 'function') {
      try { store.addAnalyticsEvent(event); } catch (_) { /* ignore */ }
    }
    // Optional remote transport (e.g. beacon/fetch). Keep it non-blocking.
    if (typeof transport === 'function') {
      try { transport(event); } catch (_) { /* ignore */ }
    }
    return event;
  }

  return {
    track,
    assessmentStarted: () => track('assessment_started'),
    assessmentCompleted: (result) => track('assessment_completed', {
      answered: result && result.answered,
      total: result && result.total,
      overall: result && result.overall,
      weakest: result && result.weakestSkill
    }),
    trainingGenerated: (plan) => track('training_generated', {
      count: plan && plan.total,
      primary: plan && plan.primaryConcept
    }),
    spotShown: (spot) => track('spot_shown', {
      spotId: spot && spot.id,
      concept: spot && spot.concept,
      street: spot && spot.street,
      difficulty: spot && spot.difficulty
    }),
    spotAnswered: (result) => track('spot_answered', {
      spotId: result && result.drillId,
      concept: result && result.concept,
      grade: result && result.grade,
      evLossBb: result && result.evLossBb
    }),
    sessionCompleted: (summary) => track('session_completed', {
      solved: summary && summary.solved,
      avgLossBb: summary && summary.avgLossBb,
      nearOptimal: summary && summary.nearOptimalCount
    }),
    sessionStarted: () => track('session_started'),
    drillError: (reason) => track('drill_error', { reason }),
    profileUpdated: (profile) => track('profile_updated', {
      overall: profile && profile.overall,
      weakest: profile && profile.weakest && profile.weakest.skill
    })
  };
}