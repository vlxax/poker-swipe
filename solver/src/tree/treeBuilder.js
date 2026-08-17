import { SolverError, assert } from '../api/errors.js';
import { validateTreeConfig } from './treeValidator.js';
import { normalizeTreeConfig, STREET_ORDER, nextStreet, PLAYER } from './treeConfig.js';
import { createActionNode } from './actionNode.js';
import { createTerminalNode, TERMINAL_TYPES } from './terminalNode.js';
import { createChanceNode, nextCardPool } from './chanceNode.js';
import { legalActions, applyAction, otherPlayer } from './betSizing.js';
import { expandRange } from '../ranges/rangeExpander.js';
import { GameTree } from './gameTree.js';

// Builds the explicit heads-up postflop game tree from config. Chance nodes deal
// a single next board card; showdown/all-in utilities are resolved lazily by the
// CFR utility layer using the hand evaluator.
export function buildGameTree(input = {}) {
  const game = validateTreeConfig(input);
  const cfg = normalizeTreeConfig(input);

  // Expand ranges once (blocked by board). Reused by the CFR solver.
  const heroComboSet = expandRange(game.heroRange, game.board);
  const villainComboSet = expandRange(game.villainRange, game.board);
  assert(heroComboSet.comboCount > 0, 'INVALID_RANGE', 'heroRange has no combos after blockers');
  assert(villainComboSet.comboCount > 0, 'INVALID_RANGE', 'villainRange has no combos after blockers');

  let counter = 0;
  const nextId = () => `n${counter++}`;

  // Split the initial pot equally between the two players so pot === committed sum.
  const halfPot = game.potBB / 2;
  const committed = { hero: halfPot, villain: halfPot };

  const stats = {
    nodeCount: 0,
    actionNodeCount: 0,
    chanceNodeCount: 0,
    terminalNodeCount: 0,
    maxDepth: 0
  };

  const buildStreet = (street, board, pot, comm, toCall, playerToAct, raises, lastAggressorAllIn, actionHistory, depth, streetActors = []) => {
    if (depth > cfg.maxDepth) {
      throw new SolverError('TREE_TOO_LARGE', 'tree depth exceeded maxDepth',
        { limit: cfg.maxDepth, suggestion: 'reduce bet/raise sizes or streets' });
    }

    const acts = legalActions({
      committed: comm, stack: game.effectiveStackBB, pot, playerToAct, street,
      raisesThisStreet: raises, lastAggressorAllIn, cfg
    });
    assert(acts.length > 0, 'INVALID_CONFIG', `no legal actions at ${street} for ${playerToAct}`);

    const node = createActionNode({
      id: nextId(), depth, street, board, playerToAct, pot, committed: comm,
      stack: game.effectiveStackBB, toCall, raisesThisStreet: raises,
      lastAggressorAllIn, actionHistory, actions: acts
    });

    register(node);

    for (const action of acts) {
      const child = buildActionChild(node, action, street, board, depth, streetActors);
      node.children.push(child);
    }
    return node;
  };

  const buildActionChild = (parent, action, street, board, depth, streetActors) => {
    const next = applyAction(
      { playerToAct: parent.playerToAct, committed: parent.committed, pot: parent.pot, stack: parent.stack, raisesThisStreet: parent.raisesThisStreet },
      action
    );
    const history = [...parent.actionHistory, action.id];
    const other = otherPlayer(parent.playerToAct);
    const newActors = streetActors.includes(parent.playerToAct) ? streetActors : [...streetActors, parent.playerToAct];

    if (action.type === 'fold') {
      return makeTerminal({
        terminalType: TERMINAL_TYPES.FOLD, winner: other, street, board,
        pot: next.pot, committed: next.committed, depth: depth + 1, history
      });
    }

    if (next.toCall > 0) {
      // Opponent still faces a bet: continue the betting round.
      return buildStreet(street, board, next.pot, next.committed, next.toCall, other,
        next.raisesThisStreet, next.lastAggressorAllIn, history, depth + 1, newActors);
    }

    // A check only closes the round as a check-back (the opponent already acted
    // this street). Otherwise the opponent still gets a free action (check/bet).
    const checkBack = streetActors.includes(other);
    if (action.type === 'check' && !checkBack) {
      return buildStreet(street, board, next.pot, next.committed, 0, other,
        next.raisesThisStreet, next.lastAggressorAllIn, history, depth + 1, newActors);
    }

    // Betting round complete. Both players matched.
    const rem0 = next.stack - next.committed.hero;
    const rem1 = next.stack - next.committed.villain;
    const bothAllIn = rem0 <= 0 && rem1 <= 0;

    if (street === 'river') {
      return makeTerminal({
        terminalType: TERMINAL_TYPES.SHOWDOWN, winner: null, street, board,
        pot: next.pot, committed: next.committed, depth: depth + 1, history
      });
    }

    if (bothAllIn) {
      // Both all-in before the river: resolve via runout enumeration in utility,
      // capped to the same chance-branch abstraction used elsewhere in the tree.
      return makeTerminal({
        terminalType: TERMINAL_TYPES.ALL_IN, winner: null, street, board,
        pot: next.pot, committed: next.committed, depth: depth + 1, history,
        chanceAbstraction: cfg.maxChanceBranches
      });
    }

    // Move to the next street via a chance node that deals the next card.
    return makeChance(street, board, next.pot, next.committed, depth + 1, history, game);
  };

  const makeChance = (street, board, pot, comm, depth, history, game) => {
    const ns = nextStreet(street);
    const fullPool = nextCardPool(board);
    // maxChanceBranches caps the number of dealt cards considered (a documented
    // chance-branch abstraction). Infinite/absent means enumerate the full deck.
    const pool = Number.isFinite(cfg.maxChanceBranches) && cfg.maxChanceBranches < Infinity
      ? fullPool.slice(0, cfg.maxChanceBranches)
      : fullPool;
    
    const node = createChanceNode({
      id: nextId(), depth, street: ns, board, pot, committed: comm,
      stack: game.effectiveStackBB, actionHistory: history, chanceCards: [], children: []
    });
    register(node);
    for (const card of pool) {
      const newBoard = [...board, card];
      const child = buildStreet(ns, newBoard, pot, { ...comm }, 0, cfg.firstToAct,
        0, false, [...history, `deal_${card}`], depth + 1, []);
      node.chanceCards.push(card);
      node.children.push(child);
    }
    return node;
  };

  const makeTerminal = ({ terminalType, winner, street, board, pot, committed, depth, history, chanceAbstraction = null }) => {
    const node = createTerminalNode({
      id: nextId(), depth, street, board, pot, committed, stack: game.effectiveStackBB,
      actionHistory: history, terminalType, winner, chanceAbstraction
    });
    register(node);
    return node;
  };

  const register = (node) => {
    stats.nodeCount++;
    if (node.type === 'ACTION') stats.actionNodeCount++;
    else if (node.type === 'CHANCE') stats.chanceNodeCount++;
    else if (node.type === 'TERMINAL') stats.terminalNodeCount++;
    if (node.depth > stats.maxDepth) stats.maxDepth = node.depth;
    if (stats.nodeCount > cfg.maxNodes) {
      throw new SolverError('TREE_TOO_LARGE', 'tree exceeds maxNodes', {
        estimatedNodes: stats.nodeCount,
        limit: cfg.maxNodes,
        suggestion: 'reduce ranges, bet sizes, streets or maxChanceBranches'
      });
    }
  };

  const root = buildStreet(
    game.street, game.board, game.potBB, committed, 0, cfg.firstToAct, 0, false, [], 0, []
  );

  return new GameTree({
    root,
    stats,
    game,
    cfg,
    heroCombos: heroComboSet.combos,
    villainCombos: villainComboSet.combos
  });
}