// Persistent leak profile: aggregates ANALYZED DECISIONS (not hand results) per
// concept. A won pot is not good play and a lost pot is not a mistake — only
// solver-measured EV loss from analyzed decisions feeds these numbers.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';

const TREND_MIN_SAMPLE = 4;

export function createLeakProfile({ concept, now = Date.now() } = {}) {
  return {
    concept,
    sampleSize: 0,
    mistakes: 0,
    totalEvLossBb: 0,
    avgEvLossBb: 0,
    highConfidenceMistakes: 0,
    recentMistakes: 0,
    recentEvLossBb: 0,
    firstFiveEvLossBb: null,
    latestFiveEvLossBb: null,
    lastSeenAt: now,
    trend: 'stable',
    priorityScore: 0,
    attempts: [] // rolling analyzer events (evLossBb, at, confidenceScore)
  };
}

// A leak event derived from one analyzed decision/candidate.
export function leakEventFromCandidate(candidate, now = Date.now()) {
  const evLossBb = candidate.sourceEvLossBb != null ? Number(candidate.sourceEvLossBb) : 0;
  const conf = candidate.confidence && candidate.confidence.score != null ? candidate.confidence.score : null;
  return {
    concept: candidate.concept,
    street: candidate.street,
    sourceHandId: candidate.sourceHandId,
    candidateId: candidate.id,
    evLossBb,
    severity: candidate.sourceSeverity || null,
    confidenceScore: conf,
    highConfidence: conf != null ? conf >= 0.6 : false,
    at: now,
    evLossBbKey: stableHash(candidate.id + '|' + now + '|' + evLossBb)
  };
}

// Record a leak event into a profile. Deterministic aggregate math only.
export function recordLeakEvent(profile, event) {
  const evLoss = Number.isFinite(event.evLossBb) ? event.evLossBb : 0;
  const p = profile.attempts || [];
  p.push(event);
  profile.attempts = p.slice(-40);

  profile.sampleSize = p.length;
  profile.mistakes = p.filter((e) => e.evLossBb > 0.0005).length;
  profile.totalEvLossBb = round(p.reduce((s, e) => s + (Number.isFinite(e.evLossBb) ? e.evLossBb : 0), 0), 4);
  profile.avgEvLossBb = profile.sampleSize ? round(profile.totalEvLossBb / profile.sampleSize, 4) : 0;
  profile.highConfidenceMistakes = p.filter((e) => e.highConfidence && e.evLossBb > 0.0005).length;

  // Recency: count mistakes in the last N events (and their total EV loss).
  const recent = p.slice(-5);
  profile.recentMistakes = recent.filter((e) => e.evLossBb > 0.0005).length;
  profile.recentEvLossBb = round(recent.reduce((s, e) => s + (Number.isFinite(e.evLossBb) ? e.evLossBb : 0), 0), 4);

  // Trend: compare the first 5 attempts vs the latest 5 attempts (requires enough
  // samples, requirement 15 — do not claim improvement without samples).
  if (p.length >= TREND_MIN_SAMPLE) {
    const half = Math.max(1, Math.floor(p.length / 2));
    const first = p.slice(0, half);
    const last = p.slice(-half);
    const fAvg = first.reduce((s, e) => s + (Number.isFinite(e.evLossBb) ? e.evLossBb : 0), 0) / first.length;
    const lAvg = last.reduce((s, e) => s + (Number.isFinite(e.evLossBb) ? e.evLossBb : 0), 0) / last.length;
    profile.firstFiveEvLossBb = round(fAvg, 4);
    profile.latestFiveEvLossBb = round(lAvg, 4);
    const diff = fAvg - lAvg;
    profile.trend = diff > 0.05 ? 'improving' : diff < -0.05 ? 'worsening' : 'stable';
  } else {
    profile.trend = 'stable';
  }

  if (event.at != null) profile.lastSeenAt = event.at;
  return profile;
}

// Rebuild a profile from a flat list of leak events.
export function buildLeakProfile({ concept, events = [], now = Date.now() } = {}) {
  const p = createLeakProfile({ concept, now });
  for (const e of events) recordLeakEvent(p, e);
  return p;
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export { TREND_MIN_SAMPLE };