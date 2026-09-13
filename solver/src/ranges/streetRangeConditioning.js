// Street-by-street range conditioning: prior range → action filter → next street.
// Uses hand class / draws / missed draws / sizing — not a second equity engine.

import { classifyPostflopHand } from '../cards/postflopClassification.js';
import { expandClass } from '../cards/combinations.js';

const CONTINUE_BET = new Set(['overpair', 'top_pair', 'two_pair', 'set', 'trips', 'straight', 'flush', 'full_house', 'quads']);

export function comboClassOnBoard(handClass, board, blocked = []) {
  const combos = expandClass(handClass, blocked);
  if (!combos.length) return { keep: 1, classes: [] };
  const classes = combos.slice(0, 12).map((combo) => classifyPostflopHand(combo, board));
  return { keep: 1, classes };
}

export function weightAfterAction(handClass, { street, action, board = [], sizingPct = null, priorWeight = 1 } = {}) {
  const act = String(action || '').toLowerCase();
  const boardCards = board;
  let factor = 1;
  const sample = expandClass(handClass, []).slice(0, 4);
  const cls = sample[0] ? classifyPostflopHand(sample[0], boardCards) : null;

  if (act === 'fold') return 0;
  if (act === 'check') {
    if (cls && CONTINUE_BET.has(cls.made) && street === 'flop') factor = 0.55;
    else factor = 0.9;
  }
  if (act === 'call') {
    if (cls && (cls.flushDraw || cls.straightDraw || cls.made !== 'high_card')) factor = 1;
    else factor = sizingPct >= 75 ? 0.25 : 0.55;
    if (cls && cls.made === 'high_card' && !cls.flushDraw && !cls.straightDraw && street === 'river') {
      factor = 0.05;
    }
  }
  if (act === 'bet' || act === 'raise') {
    if (cls && (CONTINUE_BET.has(cls.made) || cls.comboDraw || cls.nutFlushDraw)) factor = 1;
    else if (cls && (cls.flushDraw || cls.openEnded)) factor = sizingPct >= 75 ? 0.7 : 0.85;
    else factor = sizingPct >= 100 ? 0.2 : 0.45;
  }
  if (street === 'river' && act === 'bet' && cls && cls.made === 'high_card' && !cls.flushDraw) {
    factor *= 0.6;
  }
  return Math.max(0, priorWeight * factor);
}

export function conditionRange(rangeWeights, steps = []) {
  let current = { ...rangeWeights };
  const trail = [{ street: 'preflop', range: { ...current } }];
  for (const step of steps) {
    const next = {};
    for (const [hc, w] of Object.entries(current)) {
      const nw = weightAfterAction(hc, { ...step, priorWeight: w });
      if (nw > 1e-6) next[hc] = nw;
    }
    current = next;
    trail.push({ street: step.street, action: step.action, range: { ...current } });
  }
  return { range: current, trail };
}

export function rangesEqual(a, b) {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (Math.abs((a[k] || 0) - (b[k] || 0)) > 1e-9) return false;
  return true;
}
