// Canonical training concepts referenced by hand-analysis explanations. Each maps
// an internal key to a stable, English, user-facing name and a one-line definition
// a player can act on. Used by the explanation builder and the interesting-spot
// detector so both speak the same vocabulary.

const CONCEPTS = {
  blunder: {
    name: 'Blunder',
    definition: 'A large EV loss that costs multiple big blinds — worth dedicated review.'
  },
  mistake: {
    name: 'Mistake',
    definition: 'A play that loses measurable EV versus the best line in this spot.'
  },
  mixed_strategy: {
    name: 'Mixed strategy',
    definition: 'The solver plays multiple actions here — the spot is decided by frequencies, not one sizing.'
  },
  close_decision: {
    name: 'Close decision',
    definition: 'The top actions are nearly equal in EV — small factors decide the right play.'
  },
  sizing_efficiency: {
    name: 'Sizing efficiency',
    definition: 'Betting size materially changes expected value on this street.'
  },
  pot_geometry: {
    name: 'Pot geometry',
    definition: 'The stack-to-pot ratio (SPR) shapes how the hand should be bet across streets.'
  },
  value: {
    name: 'Range value',
    definition: 'Strong equity / nut-heavy range supports betting for value and building the pot.'
  },
  fold_equity: {
    name: 'Fold equity',
    definition: 'Limited showdown value means betting/bluffing wins pots opponents would otherwise claim.'
  },
  bluff_catch: {
    name: 'River bluff-catch',
    definition: 'Calling on the river hinges on the opponent\u2019s value-to-bluff ratio and blockers.'
  },
  range_advantage_and_sizing: {
    name: 'Range advantage and sizing',
    definition: 'Nut and range advantage on a board should drive bet size and frequency.'
  }
};

// Return the concept entry for a key, falling back to a generic concept.
export function conceptFor(key) {
  return CONCEPTS[key] || CONCEPTS.range_advantage_and_sizing;
}

export function conceptList(keys = []) {
  return keys.map((k) => conceptFor(k));
}