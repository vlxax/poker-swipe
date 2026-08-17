import { hashCode } from '../equity/rng.js';

// An information set is identified by everything the acting player can observe:
// street, board, pot, effective stack, the amount to call, and the action history.
// Hidden opponent cards are deliberately NOT part of the key. In this first CFR
// version the player's own private hand is used as a hand bucket inside the set.

export function informationSetKey({
  street, board, pot, stack, toCall, actionHistory
}) {
  const hist = (actionHistory || []).join(',');
  return [String(street).toLowerCase(), (board || []).join(''), Number(pot), Number(stack), Number(toCall), hist].join('|');
}

// A stable numeric hash of the canonical key (used only for quick lookups).
export function informationSetHash(key) {
  return hashCode(String(key)).toString(16);
}

// Build a per-combo strategy/regret store for one information set.
export function emptyInfoSetStore(actionIds) {
  return {
    actionIds: [...actionIds],
    regrets: {},     // combo -> { actionId: number }
    strategySum: {}, // combo -> { actionId: number } (weighted average)
    currentStrategy: {} // combo -> { actionId: number }
  };
}