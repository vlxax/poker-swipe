// Structural validation of a built 169-class range matrix.
//
// Catches the defect classes that a plain "did we get an object back" check
// misses: missing cells, wrong combo accounting, offsuit played more than the
// same suited hand, kicker/pair holes, and ranges that are empty or universal.

import { matrixClasses, MATRIX_RANKS_EXPORT as RANKS } from './matrix.js';

export const TOTAL_COMBOS = 1326;
const MONOTONIC_TOLERANCE = 0.03;

export function comboCount(hand) {
  const h = String(hand);
  if (h.length === 2) return 6;
  return h.endsWith('s') ? 4 : 12;
}

export function handShape(hand) {
  const h = String(hand);
  if (h.length === 2) return 'pairs';
  return h.endsWith('s') ? 'suited' : 'offsuit';
}

export function rangeStats(cells) {
  const stats = {
    classes: 0,
    combos: 0,
    playCombos: 0,
    playPct: 0,
    pairs: { classes: 0, combos: 0, playCombos: 0 },
    suited: { classes: 0, combos: 0, playCombos: 0 },
    offsuit: { classes: 0, combos: 0, playCombos: 0 },
    always: { classes: 0, combos: 0 },
    sometimes: { classes: 0, combos: 0 },
    never: { classes: 0, combos: 0 }
  };
  for (const hand of matrixClasses()) {
    const cell = cells[hand];
    if (!cell) continue;
    const n = comboCount(hand);
    const play = Number(cell.play) || 0;
    const shape = handShape(hand);
    stats.classes++;
    stats.combos += n;
    stats.playCombos += play * n;
    stats[shape].classes++;
    stats[shape].combos += n;
    stats[shape].playCombos += play * n;
    const bucket = cell.bucket === 'always' || cell.bucket === 'sometimes' ? cell.bucket : 'never';
    stats[bucket].classes++;
    stats[bucket].combos += n;
  }
  stats.playCombos = Math.round(stats.playCombos * 100) / 100;
  stats.playPct = Math.round((stats.playCombos / TOTAL_COMBOS) * 1000) / 10;
  return stats;
}

export function rangeFingerprint(cells) {
  return matrixClasses()
    .map((hand) => {
      const cell = cells[hand];
      return cell ? Math.round((Number(cell.play) || 0) * 1000) : 'x';
    })
    .join(',');
}

function play(cells, hand) {
  const cell = cells[hand];
  return cell ? Number(cell.play) || 0 : null;
}

// Situations differ in what "bottom of the range" is allowed to look like.
// Opening ranges must not shove trash; a big blind closing the action with
// pot odds legitimately continues with hands an opener would never raise.
const BOTTOM_LIMIT = {
  opening: 0.5,
  defending: 0.85
};

export function validateRangeMatrix(cells, options = {}) {
  const { profile = 'opening', requireFullCoverage = true } = options;
  const errors = [];
  const warnings = [];
  const all = matrixClasses();

  const missing = all.filter((hand) => !cells[hand] || cells[hand].supported === false);
  if (requireFullCoverage && missing.length) {
    errors.push(`missing ${missing.length} hand classes (e.g. ${missing.slice(0, 3).join(', ')})`);
  }

  const stats = rangeStats(cells);
  if (requireFullCoverage) {
    if (stats.classes !== 169) errors.push(`expected 169 classes, got ${stats.classes}`);
    if (stats.combos !== TOTAL_COMBOS) errors.push(`expected ${TOTAL_COMBOS} combos, got ${stats.combos}`);
    if (stats.pairs.classes !== 13) errors.push(`expected 13 pair classes, got ${stats.pairs.classes}`);
    if (stats.suited.classes !== 78) errors.push(`expected 78 suited classes, got ${stats.suited.classes}`);
    if (stats.offsuit.classes !== 78) errors.push(`expected 78 offsuit classes, got ${stats.offsuit.classes}`);
    if (stats.pairs.combos !== 78) errors.push(`expected 78 pair combos, got ${stats.pairs.combos}`);
    if (stats.suited.combos !== 312) errors.push(`expected 312 suited combos, got ${stats.suited.combos}`);
    if (stats.offsuit.combos !== 936) errors.push(`expected 936 offsuit combos, got ${stats.offsuit.combos}`);
  }

  if (stats.playPct <= 0) errors.push('range is empty');
  if (stats.playPct >= 99.5) errors.push('range plays every hand');

  const aa = play(cells, 'AA');
  const kk = play(cells, 'KK');
  if (aa !== null && aa < 0.85) errors.push(`AA is played only ${(aa * 100).toFixed(0)}% of the time`);
  if (kk !== null && kk < 0.8) errors.push(`KK is played only ${(kk * 100).toFixed(0)}% of the time`);

  const trash = play(cells, '72o');
  const limit = BOTTOM_LIMIT[profile] ?? BOTTOM_LIMIT.opening;
  if (trash !== null && trash > limit) {
    errors.push(`72o is played ${(trash * 100).toFixed(0)}% of the time (limit ${(limit * 100).toFixed(0)}%)`);
  }

  // Suited must never be played less than the identical offsuit holding.
  for (let i = 0; i < 13; i++) {
    for (let j = i + 1; j < 13; j++) {
      const s = play(cells, `${RANKS[i]}${RANKS[j]}s`);
      const o = play(cells, `${RANKS[i]}${RANKS[j]}o`);
      if (s === null || o === null) continue;
      if (s + MONOTONIC_TOLERANCE < o) {
        errors.push(`${RANKS[i]}${RANKS[j]}s played less than ${RANKS[i]}${RANKS[j]}o`);
      }
    }
  }

  // Pairs must be monotone in rank.
  for (let i = 0; i + 1 < 13; i++) {
    const hi = play(cells, RANKS[i] + RANKS[i]);
    const lo = play(cells, RANKS[i + 1] + RANKS[i + 1]);
    if (hi === null || lo === null) continue;
    if (hi + MONOTONIC_TOLERANCE < lo) {
      errors.push(`${RANKS[i]}${RANKS[i]} played less than ${RANKS[i + 1]}${RANKS[i + 1]}`);
    }
  }

  // Kickers must be monotone inside a suitedness family.
  for (const suffix of ['s', 'o']) {
    for (let i = 0; i < 13; i++) {
      for (let j = i + 1; j + 1 < 13; j++) {
        const strong = play(cells, `${RANKS[i]}${RANKS[j]}${suffix}`);
        const weak = play(cells, `${RANKS[i]}${RANKS[j + 1]}${suffix}`);
        if (strong === null || weak === null) continue;
        if (strong + MONOTONIC_TOLERANCE < weak) {
          errors.push(`${RANKS[i]}${RANKS[j]}${suffix} played less than ${RANKS[i]}${RANKS[j + 1]}${suffix}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats, fingerprint: rangeFingerprint(cells) };
}

export function validationProfileFor(situation, heroPosition) {
  if (situation === 'vs_open' || situation === 'vs_3bet') return 'defending';
  if (situation === 'push_fold' && String(heroPosition).toUpperCase() === 'BB') return 'defending';
  return 'opening';
}
