// Poker Brain ↔ Trainer Knowledge adapter (preflop spots).

import { MATCH_STATUS, TRAINER_STATUS, canGradeWithTrainerAction } from '../status.js';
import { selectionToTrainerQuery } from './rangesAdapter.js';
import { formatProvenanceDebug } from '../provenance.js';
import { buildTrainerQueryFromCanonical } from '../canonicalTrainerQuery.js';

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

function uoStackBand(stackBb) {
  const n = parseFloat(String(stackBb).replace(/bb/i, ''));
  if (!Number.isFinite(n)) return null;
  if (n <= 4) return '2-4';
  if (n <= 6) return '4-6';
  if (n <= 8) return '6-8';
  if (n <= 10) return '8-10';
  if (n <= 12) return '10-12';
  if (n <= 15) return '12-15';
  if (n <= 18) return '15-18';
  if (n <= 25) return '18-25';
  if (n <= 40) return '25-40';
  return '40+';
}

export function inferTrainerQueryFromSpot(spot = {}, handClass = null) {
  const streetRaw = String(spot.street || 'PREFLOP').toUpperCase();
  const street = streetRaw === 'ПРЕФЛОП' ? 'PREFLOP' : streetRaw;
  if (street !== 'PREFLOP' && street !== 'PRE') return null;

  // Prefer structured canonical spot when available (P0 architecture).
  if (spot._canonical || spot.position || spot.history?.length) {
    const canonical = spot._canonical || spot;
    const built = buildTrainerQueryFromCanonical(canonical, handClass);
    if (built.query && built.complete) {
      return built.query;
    }
    if (built.query) {
      return { ...built.query, _incomplete: true, _missing: built.missing };
    }
  }

  // Legacy structured fields only — no concept/tag/description inference.
  const rawPos = String(spot.pos || spot.heroSeat || spot.position || '').split(/\s|vs/i)[0].toUpperCase();
  const heroPosition = POS_MAP[rawPos] || rawPos;
  const stackRaw = spot.stack ?? spot.effStack ?? null;
  const stack = spot.sourceMode === 'uo' && stackRaw != null
    ? uoStackBand(stackRaw)
    : (stackRaw != null ? `${stackRaw}BB` : null);

  return {
    heroPosition,
    stack,
    opponentPosition: spot.villainSeat || spot.villainPosition || spot.villain || spot.opener || null,
    betSize: spot.betSize || spot.sizing || null,
    sourceMode: spot.sourceMode || spot.trainerSourceMode || null,
    rawSpot: spot.rawSpot || spot.trainerSpot || null,
    trainerCanonicalId: spot.trainerCanonicalId || null,
    hand: handClass
  };
}

export function brainTrainerStatusFromMatch(matchStatus, handResult) {
  if (!matchStatus || matchStatus === MATCH_STATUS.NO_TRAINER_DATA) {
    return 'NO_TRAINER_DATA';
  }
  if (handResult?.dataStatus === TRAINER_STATUS.NEEDS_CLARIFICATION || !handResult?.gradingAllowed) {
    return 'TRAINER_DATA_NEEDS_CLARIFICATION';
  }
  if (matchStatus === MATCH_STATUS.EXACT_TRAINER_MATCH) return 'EXACT_TRAINER_MATCH';
  if (matchStatus === MATCH_STATUS.PARTIAL_TRAINER_MATCH || matchStatus === MATCH_STATUS.GROUP_POSITION_MATCH) {
    return 'PARTIAL_TRAINER_MATCH';
  }
  return 'NO_TRAINER_DATA';
}

export function buildBrainTrainerResult(lookup, spot, handClass) {
  const query = inferTrainerQueryFromSpot(spot, handClass);
  if (!query) {
    return { status: 'NO_TRAINER_DATA', query: null, trainer: null, mismatches: [] };
  }
  if (query._incomplete) {
    return {
      status: 'PARTIAL_TRAINER_MATCH',
      query,
      trainer: null,
      mismatches: query._missing || ['incomplete canonical dimensions'],
      chartId: null
    };
  }

  const fullQuery = { ...selectionToTrainerQuery({
    dataSource: 'trainer',
    position: query.heroPosition,
    stackBand: query.stack,
    trainerSourceMode: query.sourceMode,
    trainerSpot: query.rawSpot,
    opener: query.opponentPosition,
    betSize: query.betSize
  }), hand: handClass };

  const spotMatch = lookup.lookupSpot(fullQuery);
  const handMatch = lookup.lookupHandAction(fullQuery);
  const status = brainTrainerStatusFromMatch(spotMatch.status, handMatch);

  return {
    status,
    query: fullQuery,
    mismatches: spotMatch.mismatches || [],
    chartId: spotMatch.chart?.id || null,
    trainer: handMatch.action
      ? {
          actionRaw: handMatch.action,
          dataStatus: handMatch.dataStatus,
          gradingAllowed: handMatch.gradingAllowed,
          provenance: handMatch.provenance || spotMatch.chart?.provenance,
          provenanceDebug: formatProvenanceDebug(handMatch.provenance || spotMatch.chart?.provenance)
        }
      : null,
    spotMatchStatus: spotMatch.status
  };
}

export function mergeBrainAndTrainer({ brainResult, trainerResult }) {
  const out = {
    brain: brainResult ? { ...brainResult, source: brainResult.source || 'POKER_BRAIN' } : null,
    trainer: trainerResult || null,
    primarySource: 'POKER_BRAIN'
  };

  if (trainerResult?.status === 'EXACT_TRAINER_MATCH' && trainerResult.trainer?.gradingAllowed) {
    out.primarySource = 'TRAINER';
    out.trainerRecommendation = trainerResult.trainer.actionRaw;
    out.explanation = `Тренерская база: ${trainerResult.trainer.actionRaw} (${trainerResult.trainer.provenanceDebug || 'TRAINER'})`;
  } else if (trainerResult?.status === 'PARTIAL_TRAINER_MATCH') {
    const dims = (trainerResult.mismatches || []).join('; ') || 'dimension mismatch';
    out.trainerNote = `PARTIAL trainer match — ${dims}`;
    out.explanation = brainResult?.explanation || '';
  } else if (trainerResult?.status === 'TRAINER_DATA_NEEDS_CLARIFICATION') {
    out.trainerNote = `Trainer label ${trainerResult.trainer?.actionRaw || 'unknown'} — NEEDS_CLARIFICATION`;
    out.explanation = brainResult?.explanation || '';
  } else {
    out.explanation = brainResult?.explanation || '';
  }

  return out;
}
