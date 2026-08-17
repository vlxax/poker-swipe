// Node model for the game tree. Nodes are plain objects carrying the exact
// pot/stack/board state plus solution fields populated later by the CFR solver.
//
// Types:
//   ACTION    — a player must choose among availableActions.
//   CHANCE    — the next board card is dealt (children keyed by card).
//   TERMINAL  — the game ended (fold / showdown / all_in).

export const NODE_TYPES = {
  ACTION: 'ACTION',
  CHANCE: 'CHANCE',
  TERMINAL: 'TERMINAL'
};

export function makeNode({
  id,
  type,
  depth,
  street,
  board,
  playerToAct = null,
  pot = 0,
  committed = { hero: 0, villain: 0 },
  stack = 0,
  toCall = 0,
  raisesThisStreet = 0,
  lastAggressorAllIn = false,
  actionHistory = [],
  actions = [],
  children = [],
  terminalType = null,
  winner = null,
  chanceCards = [],
  chanceAbstraction = null
}) {
  return {
    id,
    type,
    depth,
    street,
    board,
    playerToAct,
    pot,
    committed,
    stack,
    toCall,
    raisesThisStreet,
    lastAggressorAllIn,
    actionHistory,
    actions,
    children,
    // Terminal fields.
    terminalType,
    winner,
    heroPayoff: null,
    villainPayoff: null,
    // The capped cards-per-street abstraction this all-in terminal was built
    // under (mirrors cfg.maxChanceBranches); used to marginalize all-in EV.
    chanceAbstraction,
    // Chance fields.
    chanceCards,
    // Solution fields (populated by the CFR solver).
    ranges: null,
    strategy: null,
    regrets: null,
    strategySum: null,
    reachProbabilities: null
  };
}