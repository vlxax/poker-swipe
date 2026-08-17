import { SolverError, assert } from '../api/errors.js';
import { validateTreeConfig, preflopBlindAssignment } from './treeValidator.js';
import { normalizeTreeConfig, STREET_ORDER, nextStreet, PLAYER, PREFLOP_DEFAULT_MAX_CHANCE_BRANCHES } from './treeConfig.js';
import { boardLengthForStreet } from '../game/street.js';
import { createActionNode } from './actionNode.js';
import { createTerminalNode, TERMINAL_TYPES } from './terminalNode.js';
import { createChanceNode, nextCardPool } from './chanceNode.js';
import { deckAfter } from '../cards/deck.js';
import { legalActions, applyAction, otherPlayer } from './betSizing.js';
import { preflopLegalActions, preflopApplyAction } from '../preflop/preflopActions.js';
import { expandRange } from '../ranges/rangeExpander.js';
import { GameTree } from './gameTree.js';

// Builds the explicit heads-up NLH game tree from config. Postflop rounds use
// single-card chance nodes for turn/river; a preflop round opens with blinds and
// transitions to the flop via a (chance-abstraction-capped) run of flop deals.
// Showdown/all-in utilities are resolved lazily by the CFR utility layer.
export function buildGameTree(input = {}) {
  const game = validateTreeConfig(input);
  const cfg = normalizeTreeConfig(input);
  const isPreflop = game.street === 'preflop';

  // Chance-branch abstraction. Postflop defaults to full enumeration (Infinity)
  // as before; a preflop tree caps the flop deal by default to stay tractable.
  if (isPreflop && !(Number.isFinite(cfg.maxChanceBranches) && cfg.maxChanceBranches < Infinity)) {
    cfg.maxChanceBranches = PREFLOP_DEFAULT_MAX_CHANCE_BRANCHES;
  }
  const chanceCap = cfg.maxChanceBranches;

  // Expand ranges once (blocked by board). Reused by the CFR solver.
  const heroComboSet = expandRange(game.heroRange, game.board);
  const villainComboSet = expandRange(game.villainRange, game.board);
  assert(heroComboSet.comboCount > 0, 'INVALID_RANGE', 'heroRange has no combos after blockers');
  assert(villainComboSet.comboCount > 0, 'INVALID_RANGE', 'villainRange has no combos after blockers');

  let counter = 0;
  const nextId = () => `n${counter++}`;

  // Initial committed split keeps pot === committed.hero + committed.villain.
  let committed;
  let rootFirstToAct = cfg.firstToAct;
  if (isPreflop) {
    const { sbPos, bbPos, firstToAct } = preflopBlindAssignment(game.heroPosition, game.villainPosition);
    committed = { hero: sbPos === 'hero' ? game.blinds.sb : game.blinds.bb, villain: bbPos === 'villain' ? game.blinds.bb : game.blinds.sb };
    rootFirstToAct = firstToAct;
  } else {
    const halfPot = game.potBB / 2;
    committed = { hero: halfPot, villain: halfPot };
  }

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
      return makeTerminal({
        terminalType: TERMINAL_TYPES.ALL_IN, winner: null, street, board,
        pot: next.pot, committed: next.committed, depth: depth + 1, history,
        chanceAbstraction: chanceCap
      });
    }

    // Move to the next street via chance nodes that deal the remaining cards.
    return advanceStreet(street, board, next.pot, next.committed, depth + 1, history, game);
  };

  const buildPreflop = (street, board, pot, comm, toCall, playerToAct, raises, lastAggressorAllIn, lastRaiseTo, actionHistory, depth, streetActors = []) => {
    if (depth > cfg.maxDepth) {
      throw new SolverError('TREE_TOO_LARGE', 'tree depth exceeded maxDepth',
        { limit: cfg.maxDepth, suggestion: 'reduce bet/raise sizes or streets' });
    }

    const acts = preflopLegalActions({
      committed: comm, stack: game.effectiveStackBB, playerToAct,
      raisesThisStreet: raises, lastAggressorAllIn, lastRaiseTo, cfg
    });
    assert(acts.length > 0, 'INVALID_CONFIG', `no legal preflop actions for ${playerToAct}`);

    const node = createActionNode({
      id: nextId(), depth, street, board, playerToAct, pot, committed: comm,
      stack: game.effectiveStackBB, toCall, raisesThisStreet: raises,
      lastAggressorAllIn, actionHistory, actions: acts, lastRaiseTo
    });

    register(node);

    for (const action of acts) {
      const child = buildPreflopChild(node, action, street, board, depth, streetActors);
      node.children.push(child);
    }
    return node;
  };

  const buildPreflopChild = (parent, action, street, board, depth, streetActors) => {
    const next = preflopApplyAction(
      {
        playerToAct: parent.playerToAct, committed: parent.committed, pot: parent.pot,
        stack: parent.stack, raisesThisStreet: parent.raisesThisStreet, lastRaiseTo: parent.lastRaiseTo
      },
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
      // Opponent still faces a bet: continue the preflop round.
      return buildPreflop(street, board, next.pot, next.committed, next.toCall, other,
        next.raisesThisStreet, next.lastAggressorAllIn, next.lastRaiseTo, history, depth + 1, newActors);
    }

    // A check or limp only closes the round if the other player already acted.
    const checkBack = streetActors.includes(other);
    if (next.toCall === 0 && !checkBack) {
      return buildPreflop(street, board, next.pot, next.committed, 0, other,
        next.raisesThisStreet, next.lastAggressorAllIn, next.lastRaiseTo, history, depth + 1, newActors);
    }

    // Preflop round complete (both matched, no outstanding bet).
    const rem0 = next.stack - next.committed.hero;
    const rem1 = next.stack - next.committed.villain;
    const bothAllIn = rem0 <= 0 && rem1 <= 0;

    if (bothAllIn) {
      // Both all-in preflop: resolve via runout enumeration (equity showdown).
      return makeTerminal({
        terminalType: TERMINAL_TYPES.ALL_IN, winner: null, street, board,
        pot: next.pot, committed: next.committed, depth: depth + 1, history,
        chanceAbstraction: chanceCap
      });
    }

    // Transition to the flop via chance nodes that deal the three flop cards.
    // Preflop trees resolve the flop transition by equity (check-down to river)
    // instead of building the full postflop betting tree, keeping them tractable.
    return advanceStreet('preflop', [], next.pot, next.committed, depth + 1, history, game, true);
  };

  // Deal the remaining board cards needed to reach the next street's board
  // length, then open the next betting round. One card per chance node so the
  // CFR traversal's hand-collision filtering works unchanged. When
  // `equityAtFlop` is set (preflop transition) a single chance node deals
  // `chanceCap` complete flops, each resolving through an equity terminal rather
  // than a postflop betting round.
  const advanceStreet = (street, board, pot, comm, depth, history, game, equityAtFlop = false) => {
    if (equityAtFlop && street === 'preflop') {
      const flops = cappedCombinations(deckAfter([]), 3, chanceCap);
      const node = createChanceNode({
        id: nextId(), depth, street: 'flop', board: [], pot, committed: comm,
        stack: game.effectiveStackBB, actionHistory: history, chanceCards: [], children: []
      });
      register(node);
      for (const flop of flops) {
        node.chanceCards.push(flop);
        node.children.push(makeTerminal({
          terminalType: TERMINAL_TYPES.EQUITY, winner: null, street: 'flop', board: flop,
          pot, committed: comm, depth: depth + 1,
          history: [...history, `deal_${flop.join('')}`], chanceAbstraction: chanceCap
        }));
      }
      return node;
    }

    const ns = street === 'preflop' ? 'flop' : nextStreet(street);
    const targetLen = boardLengthForStreet(ns);
    const remCards = targetLen - board.length;
    if (remCards <= 0) {
      return buildStreet(ns, board, pot, { ...comm }, 0, cfg.firstToAct,
        0, false, history, depth, []);
    }

    const fullPool = nextCardPool(board);
    const pool = Number.isFinite(chanceCap) && chanceCap < Infinity
      ? fullPool.slice(0, chanceCap)
      : fullPool;

    const node = createChanceNode({
      id: nextId(), depth, street: ns, board, pot, committed: comm,
      stack: game.effectiveStackBB, actionHistory: history, chanceCards: [], children: []
    });
    register(node);
    for (const card of pool) {
      const newBoard = [...board, card];
      const child = advanceStreet(street, newBoard, pot, { ...comm }, depth + 1,
        [...history, `deal_${card}`], game, equityAtFlop);
      node.chanceCards.push(card);
      node.children.push(child);
    }
    return node;
  };

  // Deterministically generate the first `cap` k-card combinations (lexicographic).
  // Used to cap the number of flops dealt in a preflop transition, keeping the
  // tree's chance-branch abstraction tractable and reproducible.
  const cappedCombinations = (cards, k, cap) => {
    const out = [];
    const n = cards.length;
    const rec = (start, acc) => {
      if (out.length >= cap) return;
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (let i = start; i < n && out.length < cap; i++) rec(i + 1, [...acc, cards[i]]);
    };
    rec(0, []);
    return out;
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

  let root;
  if (isPreflop) {
    root = buildPreflop(
      'preflop', [], game.potBB, committed,
      Math.max(0, committed.villain - committed.hero), rootFirstToAct, 0, false, 0, [], 0, []
    );
  } else {
    root = buildStreet(
      game.street, game.board, game.potBB, committed, 0, cfg.firstToAct, 0, false, [], 0, []
    );
  }

  return new GameTree({
    root,
    stats,
    game,
    cfg,
    heroCombos: heroComboSet.combos,
    villainCombos: villainComboSet.combos
  });
}