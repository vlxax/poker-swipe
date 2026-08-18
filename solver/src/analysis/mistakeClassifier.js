import { classifyLoss, classifySeverity, PRESET_THRESHOLDS, SEVERITY_ORDER } from '../config/thresholds.js';

// Classifies an EV loss (in BB) into a GOOD..BLUNDER category (legacy) plus an
// explicit severity scale (negligible..severe). The severity scale and thresholds
// live in config, so marketing-style wording never enters the math. `potBB` lets
// the loss also be expressed as a fraction of the pot.
export function classifyMistake({ evLossBB = 0, potBB = null, preset = 'cash', confidence = null }) {
  const category = classifyLoss(evLossBB, preset);
  const severity = classifySeverity(evLossBB, preset);
  const thresholds = PRESET_THRESHOLDS[preset] || PRESET_THRESHOLDS.cash;
  const evLossPctPot = potBB != null && potBB > 0 ? evLossBB / potBB : null;
  const conf = confidence != null ? confidence : classificationConfidence(evLossBB, category);
  return {
    severity: category,
    evLossBB: round(evLossBB, 4),
    evLossPctPot: evLossPctPot != null ? round(evLossPctPot, 4) : null,
    mistakeSeverity: severity,
    mistakeSeverityIndex: SEVERITY_ORDER.indexOf(severity),
    confidence: round(conf, 2),
    threshold: thresholds[category].maxLossBB
  };
}

// Baseline confidence in the classification itself. Very small or very large EV
// losses are classified with high confidence; mid-range losses are less certain.
function classificationConfidence(evLossBB, category) {
  if (category === 'GOOD' || category === 'BLUNDER') return 0.95;
  if (category === 'INACCURACY') return 0.7;
  return 0.8;
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}