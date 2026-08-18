// Personalised progress per concept (requirements 14–15). Mastery is a solver /
// EV-based measure of decision quality, NOT XP or levels: it reflects how close
// the user's recent answers are to the optimal EV of the drilled spots. Trend
// compares the earliest vs the latest attempts and is only reported once enough
// samples exist (never claim improvement on no evidence).

const MIN_SAMPLE = 3;          // attempts before a mastery score is trustworthy
const EV_REF_BB = 1.0;         // avg EV loss (BB) that halves the EV quality term
const RECENT_WINDOW = 10;      // rolling window for optimal / near-optimal rates

export function createConceptProgress({ concept, now = Date.now() } = {}) {
  return {
    concept,
    attempts: 0,
    correctCount: 0,            // EXCELLENT
    nearCorrectCount: 0,        // EXCELLENT + GOOD
    totalEvLossBb: 0,
    avgEvLossBb: 0,
    optimalRate: null,
    nearOptimalRate: null,
    firstFiveEvLossBb: null,
    latestFiveEvLossBb: null,
    trend: 'stable',
    masteryScore: null,
    lastAttemptAt: now,
    attemptsHistory: [] // rolling { grade, evLossBb, at }
  };
}

// Record one graded drill answer into a concept's progress.
export function recordAttempt(progress, { grade, evLossBb, now = Date.now() } = {}) {
  const p = progress || createConceptProgress({});
  const loss = Number.isFinite(Number(evLossBb)) ? Math.max(0, Number(evLossBb)) : 0;
  const recent = (p.attemptsHistory || []).slice();
  recent.push({ grade: grade || 'INACCURACY', evLossBb: loss, at: now });

  const window = recent.slice(-RECENT_WINDOW);
  p.attemptsHistory = window;
  p.attempts = recent.length;

  const optimal = window.filter((a) => a.grade === 'EXCELLENT').length;
  const near = window.filter((a) => a.grade === 'EXCELLENT' || a.grade === 'GOOD').length;
  p.correctCount = optimal;
  p.nearCorrectCount = near;
  p.optimalRate = window.length ? round(optimal / window.length, 4) : null;
  p.nearOptimalRate = window.length ? round(near / window.length, 4) : null;

  p.totalEvLossBb = round(window.reduce((s, a) => s + a.evLossBb, 0), 4);
  p.avgEvLossBb = window.length ? round(p.totalEvLossBb / window.length, 4) : 0;

  // Trend: earliest vs latest halves (requires enough attempts).
  if (recent.length >= 4) {
    const half = Math.max(1, Math.floor(recent.length / 2));
    const first = recent.slice(0, half);
    const last = recent.slice(-half);
    const fAvg = avgEv(first);
    const lAvg = avgEv(last);
    p.firstFiveEvLossBb = round(fAvg, 4);
    p.latestFiveEvLossBb = round(lAvg, 4);
    const diff = fAvg - lAvg;
    p.trend = diff > 0.05 ? 'improving' : diff < -0.05 ? 'worsening' : 'stable';
  } else {
    p.trend = 'stable';
  }

  // Mastery: solver/EV-based quality. Requires enough attempts.
  const evQuality = clamp(1 - p.avgEvLossBb / EV_REF_BB, 0, 1);
  const decisionQuality = p.optimalRate != null && p.nearOptimalRate != null
    ? 0.5 * p.optimalRate + 0.5 * p.nearOptimalRate
    : 0;
  p.masteryScore = recent.length >= MIN_SAMPLE
    ? round(clamp(100 * decisionQuality * evQuality, 0, 100), 1)
    : null;

  if (now != null) p.lastAttemptAt = now;
  return p;
}

export function buildProgress({ concept, attempts = [], now = Date.now() } = {}) {
  const p = createConceptProgress({ concept, now });
  for (const a of attempts) recordAttempt(p, { grade: a.grade, evLossBb: a.evLossBb, now: a.at });
  return p;
}

function avgEv(list) {
  if (!list.length) return 0;
  return list.reduce((s, a) => s + a.evLossBb, 0) / list.length;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export { MIN_SAMPLE, EV_REF_BB, RECENT_WINDOW };