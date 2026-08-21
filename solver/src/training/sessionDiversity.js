// Session diversity helpers — avoid repeating tasks and near-duplicate spots.

export function normalizeCards(cards) {
  if (!Array.isArray(cards)) return '';
  return cards.map((c) => String(c || '')
    .replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c')
    .toUpperCase()).sort().join(',');
}

export function contentFingerprint(taskOrSpot) {
  const t = taskOrSpot || {};
  const hero = t.hero || t.heroCards || (t.positions && t.positions.hero ? t.positions.hero : t.position) || '';
  const villain = t.villain || (t.positions && t.positions.villain) || '';
  const board = normalizeCards(t.board);
  const heroCards = normalizeCards(t.hero || t.heroCards);
  const history = (t.history || []).map((h) => String(h.text || h.action || '')).join('|');
  const stack = t.heroStack != null ? t.heroStack : (t.effStack != null ? t.effStack : t.stackDepth || '');
  return [
    heroCards,
    board,
    t.street || '',
    String(hero),
    String(villain),
    String(stack),
    history,
    t.concept || ''
  ].join('::');
}

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
  const fa = contentFingerprint(a);
  const fb = contentFingerprint(b);
  if (fa && fb && fa === fb) return true;
  if (a.street === b.street && a.concept === b.concept && a.position === b.position) return true;
  const idFa = cardFingerprintFromTaskId(a.id);
  const idFb = cardFingerprintFromTaskId(b.id);
  if (idFa && idFb && idFa === idFb) return true;
  return false;
}

export function diversityPenalty(spot, picked = [], recentHistory = []) {
  let penalty = 0;
  for (const p of picked) {
    const other = p.spot || p;
    if (other.id === spot.id) penalty += 100;
    else if (isTooSimilar(other, spot)) penalty += 12;
    else if (other.street === spot.street && other.concept === spot.concept) penalty += 3;
  }
  const last = recentHistory.slice(-3);
  for (const h of last) {
    if (h.spotId === spot.id) penalty += 15;
    if (h.contentFingerprint && h.contentFingerprint === contentFingerprint(spot)) penalty += 20;
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
    if (contentFingerprint(s) === contentFingerprint(spot) && s.id !== spot.id) penalty += 10;
  }
  return penalty;
}

export function recentFingerprints(history = [], limit = 30) {
  const fps = new Set();
  for (const h of (history || []).slice(0, limit)) {
    if (h.contentFingerprint) fps.add(h.contentFingerprint);
  }
  return fps;
}
