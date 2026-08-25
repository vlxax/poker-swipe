// Canonical spot → structured trainer query. No concept/tag/description guessing.

import { trainerCanonicalId } from './spotMapper.js';
import { checkQueryCompleteness } from './sourceModeRequirements.js';
import { parseTrainerStack, uoStackBandFromBb } from './stackParser.js';

const POS_MAP = {
  UTG: 'EP',
  'UTG+1': 'EP',
  EP: 'EP',
  MP: 'MP',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB'
};

export function mapHeroPosition(pos) {
  if (!pos) return null;
  const raw = String(pos).split(/\s|vs/i)[0].trim().toUpperCase();
  return POS_MAP[raw] || raw;
}

function extractBetSizeFromText(text = '') {
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*x\b/i);
  return m ? `${m[1]}x` : null;
}

function preflopTexts(canonical) {
  return (canonical.history || [])
    .filter((h) => /ПРЕФЛОП|preflop/i.test(h.street || ''))
    .map((h) => String(h.text || ''));
}

/**
 * Infer sourceMode + rawSpot from structured preflop action history only.
 * Does NOT read concept, tags, or question fields.
 */
export function analyzePreflopStructure(canonical) {
  const hero = mapHeroPosition(canonical.position);
  const villain = mapHeroPosition(canonical.villain);
  const texts = preflopTexts(canonical);
  const blob = texts.join(' | ').toLowerCase();

  const opens = (blob.match(/\bopen\b|открыл|\bрейз\b/g) || []).length;
  const threeBets = (blob.match(/3-bet|3-бет|3bet/g) || []).length;
  const fourBets = (blob.match(/4-bet|4-бет|4bet/g) || []).length;
  const squeezes = (blob.match(/squeeze|сквиз/g) || []).length;
  const limps = (blob.match(/limp|лимп/g) || []).length;
  const callers = (blob.match(/\bcall\b|колл/g) || []).length;
  const pushes = (blob.match(/push|пуш|all-in|олл-ин/g) || []).length;
  const betSize = canonical.openSizeBB != null
    ? `${canonical.openSizeBB}x`
    : extractBetSizeFromText(blob);

  if (/сфолдили|unopened|первый в раздаче|fold to you|до тебя все/i.test(blob)) {
    return { sourceMode: 'uo', rawSpot: null, betSize: null, trainerCanonicalId: 'uo::open' };
  }

  if (hero === 'SB' && villain === 'BB' && opens === 0 && limps === 0 && squeezes === 0) {
    return { sourceMode: 'sbvsbb', rawSpot: null, betSize: null, trainerCanonicalId: trainerCanonicalId('sbvsbb', null) };
  }

  if (pushes >= 1 && /resteal|call vs push|колл.*пуш/i.test(blob)) {
    return { sourceMode: 'callpush', rawSpot: 'Resteal', betSize: null, trainerCanonicalId: trainerCanonicalId('callpush', 'Resteal') };
  }

  if (squeezes >= 1) {
    return { sourceMode: 'vssqueeze', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vssqueeze', null) };
  }

  if (fourBets >= 1) {
    return { sourceMode: 'vs4bet', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vs4bet', null) };
  }

  if (threeBets >= 1) {
    return { sourceMode: 'vs3bet', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vs3bet', null) };
  }

  if (limps >= 1 && opens === 0) {
    return { sourceMode: 'vslimp', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vslimp', null) };
  }

  if (opens >= 2) {
    return { sourceMode: 'vs2r', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vs2r', null) };
  }

  if (opens === 1 && callers >= 1) {
    return { sourceMode: 'vs1r1c', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vs1r1c', null) };
  }

  if (hero === 'BB' && opens >= 1) {
    return {
      sourceMode: 'vs1rshort',
      rawSpot: 'Def_BB',
      betSize,
      trainerCanonicalId: trainerCanonicalId('vs1rshort', 'Def_BB')
    };
  }

  if (opens === 1) {
    return { sourceMode: 'vs1r', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('vs1r', null) };
  }

  if (/heads-up|hu\b|двое|1 на 1/i.test(blob) || canonical.table === 'HU') {
    return { sourceMode: 'huante', rawSpot: null, betSize, trainerCanonicalId: trainerCanonicalId('huante', null) };
  }

  return { sourceMode: null, rawSpot: null, betSize: null, trainerCanonicalId: null, blocked: 'UNCLASSIFIED_PREFLOP' };
}

function resolveStackForQuery(canonical, preflop) {
  const eff = canonical.effStack ?? canonical.heroStack ?? null;
  if (preflop.sourceMode === 'uo' && eff != null) {
    return uoStackBandFromBb(eff);
  }
  if (eff != null) {
    const sem = parseTrainerStack(`${eff}BB`);
    if (sem.type === 'EXACT') return `${eff}BB`;
    return sem.raw || `${eff}BB`;
  }
  return null;
}

/**
 * Build trainer lookup query from canonical spot + optional hand class.
 * @returns {{ query: object|null, complete: boolean, missing: string[], blocked: string|null, preflop: object }}
 */
export function buildTrainerQueryFromCanonical(canonical, handClass = null) {
  if (!canonical) {
    return { query: null, complete: false, missing: ['canonical'], blocked: 'NO_CANONICAL', preflop: null };
  }
  const street = String(canonical.street || '').toUpperCase();
  if (street !== 'ПРЕФЛОП' && street !== 'PREFLOP') {
    return { query: null, complete: false, missing: ['street'], blocked: 'POSTFLOP', preflop: null };
  }

  const preflop = analyzePreflopStructure(canonical);
  if (!preflop.sourceMode) {
    return { query: null, complete: false, missing: ['sourceMode'], blocked: preflop.blocked || 'NO_SOURCE_MODE', preflop };
  }

  const query = {
    heroPosition: mapHeroPosition(canonical.position),
    stack: resolveStackForQuery(canonical, preflop),
    opponentPosition: mapHeroPosition(canonical.villain),
    betSize: preflop.betSize,
    sourceMode: preflop.sourceMode,
    rawSpot: preflop.rawSpot,
    trainerCanonicalId: preflop.trainerCanonicalId,
    hand: handClass
  };

  const { complete, missing } = checkQueryCompleteness(query, preflop.sourceMode);
  return {
    query,
    complete,
    missing,
    blocked: complete ? null : 'PARTIAL_DIMENSIONS',
    preflop
  };
}
