// Spaced repetition for trainer-backed preflop mistakes.

const DEFAULT_INTERVALS_MS = [
  5 * 60 * 1000,
  30 * 60 * 1000,
  4 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000
];

export function trainerMistakeFingerprint(taskOrMeta) {
  const meta = taskOrMeta?.trainerMeta || taskOrMeta;
  if (!meta?.chartId || !meta?.hand) return null;
  return `trainer:${meta.sourceMode}:${meta.chartId}:${meta.hand}`;
}

export function createSpacedReviewEntry({ fingerprint, taskId, skills = [], now = Date.now() } = {}) {
  return {
    fingerprint,
    taskId,
    skills: [...skills],
    attempts: 0,
    successes: 0,
    urgency: 1,
    createdAt: now,
    nextDueAt: now + DEFAULT_INTERVALS_MS[0],
    lastGrade: null
  };
}

export function recordSpacedReviewOutcome(entry, { correct, now = Date.now() } = {}) {
  if (!entry) return null;
  const next = { ...entry, attempts: entry.attempts + 1, lastGrade: correct ? 'EXCELLENT' : 'MISTAKE' };
  if (correct) {
    next.successes += 1;
    next.urgency = Math.max(0.1, next.urgency * 0.55);
    const idx = Math.min(next.successes, DEFAULT_INTERVALS_MS.length - 1);
    next.nextDueAt = now + DEFAULT_INTERVALS_MS[idx];
  } else {
    next.urgency = Math.min(3, next.urgency + 0.5);
    next.nextDueAt = now + DEFAULT_INTERVALS_MS[0];
  }
  return next;
}

export function dueSpacedReviews(store, { now = Date.now(), limit = 3 } = {}) {
  const all = typeof store.loadSpacedReviews === 'function'
    ? store.loadSpacedReviews()
    : (store._spacedReviews || []);
  return all
    .filter((e) => e.nextDueAt <= now)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit);
}

export function upsertSpacedReview(store, entry) {
  const list = typeof store.loadSpacedReviews === 'function'
    ? [...(store.loadSpacedReviews() || [])]
    : [...(store._spacedReviews || [])];
  const idx = list.findIndex((e) => e.fingerprint === entry.fingerprint);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  if (typeof store.saveSpacedReviews === 'function') store.saveSpacedReviews(list);
  else store._spacedReviews = list;
  return list;
}
