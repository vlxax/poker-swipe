import { classifyLoss, PRESET_THRESHOLDS } from '../config/thresholds.js';

// Classifies an EV loss (in BB) into GOOD / INACCURACY / MISTAKE / BLUNDER.
export function classifyMistake({ evLossBB = 0, preset = 'cash' }) {
  const category = classifyLoss(evLossBB, preset);
  const thresholds = PRESET_THRESHOLDS[preset] || PRESET_THRESHOLDS.cash;
  return {
    severity: category,
    evLossBB: round(evLossBB, 4),
    threshold: thresholds[category].maxLossBB
  };
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}