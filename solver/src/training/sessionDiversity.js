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
  return penalty;
}
