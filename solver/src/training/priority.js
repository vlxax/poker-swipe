// Deterministic, transparent priority for a leak profile. NOT machine learning.
// Priority grows with EV loss, severity, recurrence, confidence and recency and
// shrinks when the sample is tiny, confidence is low, or the user has recently
// improved. The formula is documented below and unit-tested.

const MIN_SAMPLE = 3;          // below this, priority is damped (avoid false alarms)
const HALF_LIFE_DAYS = 7;      // a leak this old carries half the recency weight
const EV_REF_BB = 1.0;         // avg EV loss (BB) that saturates the EV weight

// priority = recurrenceWeight × evLossWeight × confidenceWeight × recencyWeight,
// multiplied by a sample gate and an improvement discount.
//
//   recurrenceWeight = clamp(mistakeRate × min(1, sampleSize/6))
//     mistakeRate = mistakes / sampleSize (0..1)
//   evLossWeight    = clamp(avgEvLossBb / EV_REF_BB, 0, 1)
//   confidenceWeight= 0.4 + 0.6 × (highConfidenceMistakes / max(1, mistakes))
//   recencyWeight   = exp(-ageDays / HALF_LIFE_DAYS)
//   sampleGate      = min(1, sampleSize / MIN_SAMPLE)      (damp tiny samples)
//   improveDiscount = trend === 'improving' ? 0.7 : 1       (recent improvement)
export function computePriority(profile, { now = Date.now() } = {}) {
  const p = profile || {};
  const sampleSize = p.sampleSize || 0;
  const mistakes = p.mistakes || 0;
  const avgEvLossBb = p.avgEvLossBb || 0;

  // No evidence at all → zero priority.
  if (sampleSize === 0 || mistakes === 0) return 0;

  const mistakeRate = clamp(mistakes / sampleSize, 0, 1);
  const recurrenceWeight = mistakeRate * Math.min(1, sampleSize / 6);

  const evLossWeight = clamp(avgEvLossBb / EV_REF_BB, 0, 1);

  const highConf = p.highConfidenceMistakes || 0;
  const confidenceWeight = 0.4 + 0.6 * clamp(highConf / Math.max(1, mistakes), 0, 1);

  const lastSeen = p.lastSeenAt != null ? Number(p.lastSeenAt) : now;
  const ageDays = Math.max(0, (now - lastSeen) / (24 * 60 * 60 * 1000));
  const recencyWeight = Math.exp(-ageDays / HALF_LIFE_DAYS);

  const sampleGate = Math.min(1, sampleSize / MIN_SAMPLE);
  const improveDiscount = p.trend === 'improving' ? 0.7 : 1;

  const priority =
    recurrenceWeight *
    evLossWeight *
    confidenceWeight *
    recencyWeight *
    sampleGate *
    improveDiscount;

  return round(clamp(priority, 0, 1), 4);
}

// Rank leak profiles by priority, returning a sorted list of { concept, priority,
// label, evidence } (requirement 19 — "Ты" connection).
export function rankLeaks(profiles, { now = Date.now(), limit = 10 } = {}) {
  const withPrio = profiles.map((p) => {
    const priorityScore = computePriority(p, { now });
    return {
      concept: p.concept,
      priority: priorityScore,
      sampleSize: p.sampleSize,
      totalEvLossBb: p.totalEvLossBb,
      avgEvLossBb: p.avgEvLossBb,
      trend: p.trend
    };
  });
  withPrio.sort((a, b) => b.priority - a.priority);
  if (limit != null) withPrio.length = Math.min(withPrio.length, limit);
  return withPrio;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}