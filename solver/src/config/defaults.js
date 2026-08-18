export const DEFAULTS = {
  iterations: 50000,
  seed: 1337,
  exhaustiveComboLimit: 200000,
  tableSize: 6,
  gameType: 'NLH',
  effectiveStackBB: 100,
  potBB: 0,
  street: 'preflop',
  debug: false
};

export const STREETS = ['preflop', 'flop', 'turn', 'river'];

export const ACTION_TYPES = ['fold', 'check', 'call', 'bet', 'raise', 'all_in'];

export const VERSION = 'solver-core';
export const API_VERSION = '1.0.0';