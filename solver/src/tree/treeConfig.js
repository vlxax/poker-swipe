// Canonical game-tree configuration for the heads-up NLH CFR solver. Supports
// a full preflop round (open / 3bet / 4bet / jam) and the three postflop
// streets. Preflop bet sizes are absolute raise-to amounts in BB; raise sizes
// are multipliers on the last raise-to (see preflopActions.js).

export const STREET_ORDER = ['flop', 'turn', 'river'];

// Default chance-branch abstraction applied when the caller leaves the preflop
// flop transition unbounded, keeping preflop trees tractable.
export const PREFLOP_DEFAULT_MAX_CHANCE_BRANCHES = 4;

export const PLAYER = ['hero', 'villain'];

export const DEFAULT_TREE_CONFIG = {
  maxRaisesPerStreet: 1,
  maxNodes: 200000,
  maxDepth: 40,
  maxIterations: 100000,
  maxChanceBranches: Infinity,
  firstToAct: 'hero',
  betSizes: {
    preflop: [2.5, 3.0],
    flop: [0.33, 0.75],
    turn: [0.5, 1.0],
    river: [0.5, 1.0]
  },
  raiseSizes: {
    preflop: [3.0],
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

  for (const street of [...STREET_ORDER, 'preflop']) {
    const b = (input.betSizes && input.betSizes[street]) || cfg.betSizes[street];
    const r = (input.raiseSizes && input.raiseSizes[street]) || cfg.raiseSizes[street];
    cfg.betSizes[street] = (b || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    cfg.raiseSizes[street] = (r || []).map(Number).filter((n) => Number.isFinite(n) && n > 1);
  }

  return cfg;
}