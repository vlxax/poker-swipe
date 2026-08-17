// Canonical game-tree configuration for the heads-up postflop CFR solver.

export const STREET_ORDER = ['flop', 'turn', 'river'];

export const PLAYER = ['hero', 'villain'];

export const DEFAULT_TREE_CONFIG = {
  maxRaisesPerStreet: 1,
  maxNodes: 200000,
  maxDepth: 40,
  maxIterations: 100000,
  maxChanceBranches: Infinity,
  firstToAct: 'hero',
  betSizes: {
    flop: [0.33, 0.75],
    turn: [0.5, 1.0],
    river: [0.5, 1.0]
  },
  raiseSizes: {
    flop: [3.0],
    turn: [2.5],
    river: [2.5]
  }
};

export function nextStreet(street) {
  const i = STREET_ORDER.indexOf(String(street).toLowerCase());
  if (i < 0 || i >= STREET_ORDER.length - 1) return null;
  return STREET_ORDER[i + 1];
}

export function streetIndex(street) {
  return STREET_ORDER.indexOf(String(street).toLowerCase());
}

// Merge user config over defaults, normalizing bet/raise size arrays per street.
export function normalizeTreeConfig(input = {}) {
  const cfg = { ...DEFAULT_TREE_CONFIG };

  if (input.maxRaisesPerStreet != null) cfg.maxRaisesPerStreet = Number(input.maxRaisesPerStreet);
  if (input.maxNodes != null) cfg.maxNodes = Number(input.maxNodes);
  if (input.maxDepth != null) cfg.maxDepth = Number(input.maxDepth);
  if (input.maxIterations != null) cfg.maxIterations = Number(input.maxIterations);
  if (input.maxChanceBranches != null) cfg.maxChanceBranches = Number(input.maxChanceBranches);

  if (input.firstToAct) cfg.firstToAct = String(input.firstToAct).toLowerCase();

  for (const street of STREET_ORDER) {
    const b = (input.betSizes && input.betSizes[street]) || cfg.betSizes[street];
    const r = (input.raiseSizes && input.raiseSizes[street]) || cfg.raiseSizes[street];
    cfg.betSizes[street] = (b || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    cfg.raiseSizes[street] = (r || []).map(Number).filter((n) => Number.isFinite(n) && n > 1);
  }

  return cfg;
}