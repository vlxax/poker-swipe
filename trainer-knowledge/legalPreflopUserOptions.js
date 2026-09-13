// Legal preflop user-facing options from poker state (sourceMode).
// These are actions the player MAY take — NOT trainer strategy recommendations.
// Grading still comes ONLY from the confirmed Trainer cell action.

const BASE = {
  uo: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'],
  vs1r: ['ФОЛД', 'КОЛЛ', '3-БЕТ', 'ОЛЛ-ИН'],
  vs1rshort: ['ФОЛД', 'КОЛЛ', '3-БЕТ', 'ОЛЛ-ИН'],
  vs1r1c: ['ФОЛД', 'КОЛЛ', '3-БЕТ', 'ОЛЛ-ИН'],
  vs2r: ['ФОЛД', 'КОЛЛ', '3-БЕТ', 'ОЛЛ-ИН'],
  vs3bet: ['ФОЛД', 'КОЛЛ', '4-БЕТ', 'ОЛЛ-ИН'],
  vs4bet: ['ФОЛД', 'КОЛЛ', 'ОЛЛ-ИН'],
  vssqueeze: ['ФОЛД', 'КОЛЛ', '4-БЕТ', 'ОЛЛ-ИН'],
  vslimp: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ', 'ОЛЛ-ИН'],
  callpush: ['ФОЛД', 'КОЛЛ'],
  sbvsbb: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'],
  huante: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ', 'ОЛЛ-ИН']
};

/**
 * @param {string} sourceMode - trainer chart sourceMode
 * @param {string} correctChoice - mapped library/trainer correct label
 * @returns {string[]} deduped legal user options including the correct action
 */
export function legalPreflopUserOptions(sourceMode, correctChoice = null) {
  const mode = String(sourceMode || '').toLowerCase();
  const legal = [...(BASE[mode] || ['ФОЛД', 'КОЛЛ', 'РЕЙЗ', 'ОЛЛ-ИН'])];
  if (correctChoice && !legal.includes(correctChoice)) {
    legal.push(correctChoice);
  }
  return [...new Set(legal)];
}

/**
 * True when poker state genuinely allows only one legal action (e.g. facing jam for entire stack with no fold).
 * Trainer fold cells are NOT in this category — they always have meaningful alternatives in preflop spots.
 */
export function isGenuinelySingleLegalAction(sourceMode, options = []) {
  if (!options || options.length !== 1) return false;
  const mode = String(sourceMode || '').toLowerCase();
  // Preflop trainer spots always have at least fold + one other legal action.
  if (mode && BASE[mode] && BASE[mode].length > 1) return false;
  return true;
}

export function isMeaningfulTrainerDecision(task) {
  const opts = task?.options || [];
  const mode = task?.trainerMeta?.sourceMode;
  if (opts.length >= 2) return true;
  if (opts.length === 1 && isGenuinelySingleLegalAction(mode, opts)) return true;
  return false;
}
