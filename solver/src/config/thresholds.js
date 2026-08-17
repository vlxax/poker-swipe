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