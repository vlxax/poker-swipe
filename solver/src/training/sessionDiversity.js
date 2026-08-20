// Session diversity helpers — avoid repeating tasks and near-duplicate spots.

export function spotFingerprint(spot) {
  const hero = spot.positions && spot.positions.hero ? spot.positions.hero : spot.position || '';
  return [
    spot.id,
    spot.street || '',
    hero,
    spot.concept || '',
    spot.stackDepth || '',
    spot.format || ''
  ].join('|');
}

export function cardFingerprintFromTaskId(id) {
  const m = String(id || '').match(/([2-9TJQKA]{1,2}[SO]?\d?)/gi);
  return m ? m.join('-') : String(id || '');
}

export function isTooSimilar(a, b) {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  if (a.street === b.street && a.concept === b.concept && a.position === b.position) return true;
  const fa = cardFingerprintFromTaskId(a.id);
  const fb = cardFingerprintFromTaskId(b.id);
  if (fa && fb && fa === fb) return true;
  return false;
}

export function diversityPenalty(spot, picked = [], recentHistory = []) {
  let penalty = 0;
  for (const p of picked) {
    if (p.spot.id === spot.id) penalty += 100;
    else if (isTooSimilar(p.spot, spot)) penalty += 8;
    else if (p.spot.street === spot.street && p.spot.concept === spot.concept) penalty += 3;
  }
  const last = recentHistory.slice(-3);
  for (const h of last) {
    if (h.spotId === spot.id) penalty += 15;
  }
  penalty += sessionRepetitionPenalty(spot, picked);
  return penalty;
}

export function sessionRepetitionPenalty(spot, picked = []) {
  let penalty = 0;
  for (const p of picked) {
    const s = p.spot || p;
    if (!s || !spot) continue;
    if (s.concept === spot.concept) penalty += 4;
    if (s.street === spot.street) penalty += 2;
    const posA = s.positions && s.positions.hero ? s.positions.hero : s.position;
    const posB = spot.positions && spot.positions.hero ? spot.positions.hero : spot.position;
    if (posA && posB && posA === posB) penalty += 1.5;
    if (s.stackDepth && spot.stackDepth && s.stackDepth === spot.stackDepth) penalty += 1;
    if (s.decisionType && spot.decisionType && s.decisionType === spot.decisionType) penalty += 0.5;
  }
  return penalty;
}
