// Validation for a drill spot derived from a solved decision. A drill is only
// shipped to a user when it is (a) actually solved, (b) has enough distinct
// legal actions to be a real decision, and (c) is not strategically trivial.
// Requirements 8 and 22 — never fabricate a spot the solver could not validate.

// A decision is "trivial" when there is nothing worth choosing: fewer than two
// distinct actions, or every non-fold option sits inside a tiny EV band with no
// meaningful mixing, so any answer is effectively the same. These would be
// misleading as training material.
export function isTrivialDecision(decision = {}) {
  const legal = distinctActions(decision.legalActions);
  if (legal.length < 2) return true;

  const playable = legal.filter((a) => a.action && a.action.type !== 'fold');
  if (playable.length < 2) return true;

  // EV band across the playable (non-fold) actions.
  const evs = playable.map((a) => a.evBB).filter((n) => Number.isFinite(n));
  if (evs.length < 2) return true;
  const spread = Math.max(...evs) - Math.min(...evs);

  // No meaningful mixing and no real EV separation ⇒ any line is near-equivalent.
  const recommendedFrequency = decision.recommendedFrequency;
  const mixed = recommendedFrequency != null && recommendedFrequency > 0.2 && recommendedFrequency < 0.8;
  const meaningfulGap = spread > 0.02;

  return !(mixed || meaningfulGap);
}

// Full validation of a candidate drill decision. Returns { ok: true } or
// { ok: false, reason }.
export function validateDrillDecision(decision = {}) {
  if (decision.solved !== true) return { ok: false, reason: 'unsolved' };

  const legal = decision.legalActions || [];
  if (legal.length < 2) return { ok: false, reason: 'insufficient_actions' };
  if (!decision.recommendedAction) return { ok: false, reason: 'no_recommended_action' };

  // Every legal action must carry a determinable action + EV.
  for (const a of legal) {
    if (!a || !a.action) return { ok: false, reason: 'malformed_action' };
    if (a.action.type !== 'fold' && !Number.isFinite(a.evBB)) {
      return { ok: false, reason: 'missing_ev' };
    }
  }

  if (isTrivialDecision(decision)) return { ok: false, reason: 'trivial_spot' };

  return { ok: true, reason: 'valid' };
}

// Distinct actions in a decision's legal set, by action id.
export function distinctActions(legal = []) {
  const seen = new Set();
  const out = [];
  for (const a of legal) {
    if (!a || !a.id) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}