// 169 hand-class matrix helpers (same layout as PokerBrainV33).

const MATRIX_RANKS = [...'AKQJT98765432'];

export function matrixClasses() {
  const out = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (r === c) out.push(MATRIX_RANKS[r] + MATRIX_RANKS[c]);
      else if (r < c) out.push(MATRIX_RANKS[r] + MATRIX_RANKS[c] + 's');
      else out.push(MATRIX_RANKS[c] + MATRIX_RANKS[r] + 'o');
    }
  }
  return out;
}

export function handHelpText(hand) {
  const h = String(hand || '').trim();
  if (h.length === 2) return `${h} — карманные ${h[0] === h[1] ? h[0] : h}`;
  if (h.endsWith('s')) return `${h} — одномастные ${h[0]}${h[1]}`;
  if (h.endsWith('o')) return `${h} — разномастные ${h[0]}${h[1]}`;
  return h;
}

export const MATRIX_RANKS_EXPORT = MATRIX_RANKS;

const ACTION_ORDER = ['FOLD', 'CALL', 'RAISE'];

export function policySegments(policy = {}) {
  return ACTION_ORDER.map((action) => ({
    action,
    frac: Math.max(0, Math.min(1, Number(policy[action]) || 0))
  })).filter((seg) => seg.frac > 0.001);
}

export function isMixedPolicy(policy = {}, threshold = 0.01) {
  return policySegments(policy).filter((seg) => seg.frac >= threshold).length > 1;
}

export function dominantBucket(policy = {}, situation = 'rfi') {
  const fold = policy.FOLD || 0;
  const call = policy.CALL || 0;
  const raise = policy.RAISE || 0;
  const play = call + raise;
  if (play < 0.15) return 'never';
  if (isMixedPolicy(policy)) return 'mixed';
  if (play >= 0.85) return 'always';
  if (play >= 0.15) return 'sometimes';
  return 'never';
}

export function legendActionsFromCells(cells = {}) {
  const seen = { FOLD: false, CALL: false, RAISE: false, MIXED: false };
  for (const cell of Object.values(cells)) {
    if (!cell || !cell.supported) continue;
    const policy = cell.policy || {};
    if ((policy.FOLD || 0) > 0.01) seen.FOLD = true;
    if ((policy.CALL || 0) > 0.01) seen.CALL = true;
    if ((policy.RAISE || 0) > 0.01) seen.RAISE = true;
    if (cell.isMixed) seen.MIXED = true;
  }
  return seen;
}

export function actionFrequencyRows(policy = {}, situation = 'rfi') {
  const raiseLabel = situation === 'rfi' ? 'Открываем' : 'Рейз';
  const labels = { FOLD: 'Фолд', CALL: 'Колл', RAISE: raiseLabel };
  return ACTION_ORDER
    .map((action) => ({
      action,
      label: labels[action],
      pct: Math.round((policy[action] || 0) * 100)
    }))
    .filter((row) => row.pct > 0);
}
