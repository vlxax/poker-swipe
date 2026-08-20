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
