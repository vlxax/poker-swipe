export const CATEGORY_ORDER = ['GOOD', 'INACCURACY', 'MISTAKE', 'BLUNDER'];

export const DEFAULT_THRESHOLDS = {
  GOOD: { maxLossBB: 0.05 },
  INACCURACY: { maxLossBB: 0.25 },
  MISTAKE: { maxLossBB: 1.0 },
  BLUNDER: { maxLossBB: Infinity }
};

export const PRESET_THRESHOLDS = {
  cash: {
    GOOD: { maxLossBB: 0.05 },
    INACCURACY: { maxLossBB: 0.25 },
    MISTAKE: { maxLossBB: 1.0 },
    BLUNDER: { maxLossBB: Infinity }
  },
  mtt: {
    GOOD: { maxLossBB: 0.05 },
    INACCURACY: { maxLossBB: 0.25 },
    MISTAKE: { maxLossBB: 1.0 },
    BLUNDER: { maxLossBB: Infinity }
  },
  shortStack: {
    GOOD: { maxLossBB: 0.03 },
    INACCURACY: { maxLossBB: 0.15 },
    MISTAKE: { maxLossBB: 0.6 },
    BLUNDER: { maxLossBB: Infinity }
  }
};

export function classifyLoss(lossBB, preset = 'cash') {
  const table = PRESET_THRESHOLDS[preset] || DEFAULT_THRESHOLDS;
  const loss = Math.max(0, lossBB);
  if (loss < table.GOOD.maxLossBB) return 'GOOD';
  if (loss < table.INACCURACY.maxLossBB) return 'INACCURACY';
  if (loss < table.MISTAKE.maxLossBB) return 'MISTAKE';
  return 'BLUNDER';
}

// Mistake severity is a separate, config-driven scale (negligible..severe).
// It is used for the solver EV-loss report and is decoupled from the GOOD..BLUNDER
// category labels so marketing-style wording never lives in the math itself.
export const SEVERITY_ORDER = ['negligible', 'small', 'medium', 'large', 'severe'];

export const PRESET_SEVERITY_THRESHOLDS = {
  cash: {
    negligible: { maxLossBB: 0.05, maxLossPctPot: 0.02 },
    small: { maxLossBB: 0.25, maxLossPctPot: 0.05 },
    medium: { maxLossBB: 1.0, maxLossPctPot: 0.15 },
    large: { maxLossBB: 3.0, maxLossPctPot: 0.3 },
    severe: { maxLossBB: Infinity, maxLossPctPot: Infinity }
  },
  mtt: {
    negligible: { maxLossBB: 0.05, maxLossPctPot: 0.02 },
    small: { maxLossBB: 0.25, maxLossPctPot: 0.05 },
    medium: { maxLossBB: 1.0, maxLossPctPot: 0.15 },
    large: { maxLossBB: 3.0, maxLossPctPot: 0.3 },
    severe: { maxLossBB: Infinity, maxLossPctPot: Infinity }
  },
  shortStack: {
    negligible: { maxLossBB: 0.03, maxLossPctPot: 0.015 },
    small: { maxLossBB: 0.15, maxLossPctPot: 0.03 },
    medium: { maxLossBB: 0.6, maxLossPctPot: 0.1 },
    large: { maxLossBB: 1.8, maxLossPctPot: 0.2 },
    severe: { maxLossBB: Infinity, maxLossPctPot: Infinity }
  }
};

export function classifySeverity(lossBB, preset = 'cash') {
  const table = PRESET_SEVERITY_THRESHOLDS[preset] || PRESET_SEVERITY_THRESHOLDS.cash;
  const loss = Math.max(0, lossBB);
  for (const s of SEVERITY_ORDER) {
    if (loss < table[s].maxLossBB) return s;
  }
  return 'severe';
}