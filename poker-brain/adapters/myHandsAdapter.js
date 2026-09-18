import { UNKNOWN, isUnknown } from '../context/DecisionContext.js';
import { normalizePosition, normalizeStreet } from '../context/positions.js';
import { normalizeActionHistory } from '../context/actionHistory.js';

function numOrUnknown(v) {
  if (v === null || v === undefined || v === '') return UNKNOWN;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : UNKNOWN;
}

function cardsOrUnknown(c) {
  if (!c) return UNKNOWN;
  if (Array.isArray(c) && c.length) return c;
  return UNKNOWN;
}

/**
 * Full imported hand → DecisionContext at hero decision point (richest path).
 */
export function decisionContextFromMyHand(hand, rawWrap = {}) {
  const h = hand || {};
  const actions = Array.isArray(h.actions) ? h.actions : [];
  const heroActs = actions.filter((a) => a.actor === 'HERO');
  const lastHero = heroActs.at(-1);
  const decisionIdx = lastHero ? actions.indexOf(lastHero) : actions.length - 1;
  const historyUpToDecision = actions.slice(0, decisionIdx + 1);
  const fullHistory = actions;

  const street = normalizeStreet(lastHero?.street || h.street || h.decisionStreet);
  const boardN = street === 'FLOP' ? 3 : street === 'TURN' ? 4 : street === 'RIVER' ? 5 : 0;
  const board = cardsOrUnknown(h.board);
  const boardSlice = Array.isArray(board) ? board.slice(0, boardN) : board;

  const villainPos = normalizePosition(h.villainPosition || h.villainSeat);
  const villains = [];
  if (!isUnknown(villainPos)) {
    const vs = h.startingStacks?.VILLAIN ?? h.startingStacks?.villain;
    villains.push({ position: villainPos, stackBB: numOrUnknown(vs) });
  }

  const heroPos = normalizePosition(h.heroPosition || h.heroSeat);
  const heroStack = numOrUnknown(h.startingStacks?.HERO ?? h.startingStacks?.hero ?? h.effectiveStack);

  return {
    street,
    game: {
      type: h.format || UNKNOWN,
      tableSize: /9/i.test(String(h.variant || '')) ? 9 : (/6/i.test(String(h.variant || '')) ? 6 : UNKNOWN),
      chipModel: h.format === 'MTT' ? 'MTT' : (h.format === 'CASH' ? 'CASH' : UNKNOWN),
      rake: numOrUnknown(h.rakeAmount),
      ante: numOrUnknown(h.ante),
      bounty: UNKNOWN
    },
    hero: {
      position: heroPos,
      stackBB: heroStack,
      cards: cardsOrUnknown(h.hero)
    },
    villains,
    effectiveStackBB: numOrUnknown(h.effectiveStack),
    potBB: numOrUnknown(lastHero?.potBefore ?? h.pot),
    board: boardSlice,
    actionHistory: normalizeActionHistory(fullHistory.length ? fullHistory : historyUpToDecision, 'myhands'),
    decisionActionIndex: decisionIdx,
    facing: {
      type: UNKNOWN,
      aggressorPosition: villainPos,
      amountBB: numOrUnknown(lastHero?.size)
    },
    tournament: {
      icm: h.tournamentId ? true : UNKNOWN,
      payouts: UNKNOWN,
      playersRemaining: UNKNOWN,
      bountyContext: UNKNOWN
    },
    source: {
      feature: 'myhands',
      taskId: UNKNOWN,
      handId: h.sourceHandId || UNKNOWN
    },
    startingStacks: h.startingStacks || {},
    _raw: { ...rawWrap, hand: h, mode: 'myhands' }
  };
}
