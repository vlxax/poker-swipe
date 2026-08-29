// Adapter: trainer knowledge → ranges-ui matrix / hand detail format.

import { TRAINER_STATUS, MATCH_STATUS, canGradeWithTrainerAction } from '../status.js';
import { formatProvenanceDebug } from '../provenance.js';

const MATRIX_RANKS = [...'AKQJT98765432'];

function matrixClasses() {
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

export const TRAINER_USER_LABEL = 'Тренерская база';
export const TRAINER_DISCLAIMER =
  'Данные из тренерской базы PokerSwipe. Gray/UNSELECTED = FOLD (trainer-confirmed). nAI, orange, yellow, and mixed cells remain context-dependent.';

const SOURCE_MODE_LABELS = {
  uo: 'UO open',
  callpush: 'Call vs Push / Resteal',
  vs1r: 'Vs 1 Raise',
  vssqueeze: 'Vs Squeeze',
  huante: 'HU + Ante',
  vs1r1c: 'Vs 1R + 1 Caller',
  vs3bet: 'Vs 3-Bet',
  vs2r: 'Vs 2 Raises',
  sbvsbb: 'SB vs BB',
  vs1rshort: 'Vs 1R short',
  vs4bet: 'Vs 4-Bet',
  vslimp: 'Vs Limp'
};

const ACTION_DISPLAY = {
  AI: { label: 'AI', bucket: 'always', color: 'trainer-ai' },
  RAISE: { label: 'Рейз', bucket: 'always', color: 'trainer-raise' },
  nAI: { label: 'nAI', bucket: 'unknown', color: 'trainer-unknown' },
  UNSELECTED: { label: 'Фолд', bucket: 'never', color: 'trainer-fold', normalizedAction: 'FOLD' },
  LOW_PLAYABILITY: { label: 'LOW+', bucket: 'unknown', color: 'trainer-unknown' },
  UO: { label: 'UO', bucket: 'unknown', color: 'trainer-unknown' }
};

function cellFromTrainerHand(handRec) {
  if (!handRec) {
    return {
      hand: null,
      supported: false,
      bucket: 'never',
      bucketLabel: 'Нет данных',
      action: null,
      actionLabel: '—',
      trainerActionRaw: null,
      dataStatus: TRAINER_STATUS.MISSING_TRAINER_DATA,
      gradingAllowed: false
    };
  }

  const raw = handRec.actionRaw;
  const status = handRec.dataStatus || TRAINER_STATUS.NEEDS_CLARIFICATION;
  const display = ACTION_DISPLAY[raw] || { label: raw || '?', bucket: 'unknown', color: 'trainer-unknown' };
  const normalizedAction = display.normalizedAction || (raw === 'UNSELECTED' ? 'FOLD' : raw);

  if (!raw || status === TRAINER_STATUS.NEEDS_CLARIFICATION || !canGradeWithTrainerAction(raw, normalizedAction)) {
    return {
      hand: handRec.hand,
      supported: true,
      bucket: display.bucket,
      bucketLabel: raw === 'UNSELECTED' ? 'FOLD' : (raw || 'NEEDS_CLARIFICATION'),
      action: null,
      actionLabel: display.label,
      trainerActionRaw: raw,
      normalizedAction: raw === 'UNSELECTED' ? 'FOLD' : null,
      dataStatus: status,
      gradingAllowed: false,
      isMixed: false,
      unavailable: !raw
    };
  }

  return {
    hand: handRec.hand,
    supported: true,
    bucket: display.bucket,
    bucketLabel: display.label,
    action: normalizedAction,
    actionLabel: display.label,
    trainerActionRaw: raw,
    normalizedAction,
    dataStatus: status,
    gradingAllowed: true,
    isMixed: false,
    play: normalizedAction === 'FOLD' ? 0 : 1
  };
}

function normalizeStackValue(rawStack) {
  if (rawStack == null || rawStack === '') return null;
  const s = String(rawStack).trim();
  if (s.includes('-') || s.includes('+')) return s;
  if (/bb$/i.test(s)) return s.replace(/bb$/i, 'BB');
  return `${s}BB`;
}

export function selectionToTrainerQuery(sel) {
  const q = {
    heroPosition: sel.position || null,
    stack: normalizeStackValue(sel.stackBand ?? sel.stack),
    opponentPosition: sel.opener || sel.opponent || null,
    betSize: sel.betSize || sel.sizing || null,
    sourceMode: sel.trainerSourceMode || sel.sourceMode || null,
    sourceGroup: sel.sourceGroup || sel.trainerSourceGroup || null,
    rawSpot: sel.trainerSpot || sel.rawSpot || null,
    trainerCanonicalId: sel.trainerCanonicalId || null
  };

  if (sel.situation === 'uo_open' || sel.situation === 'rfi' && sel.dataSource === 'trainer' && sel.trainerSourceMode === 'uo') {
    q.sourceMode = 'uo';
    if (!q.sourceGroup) q.sourceGroup = 'UO';
  }

  const situationToMode = {
    call_vs_push: 'callpush',
    resteal: 'callpush',
    vs_squeeze: 'vssqueeze',
    vs_open: 'vs1r',
    vs_3bet: 'vs3bet',
    vs_4bet: 'vs4bet',
    sb_vs_bb: 'sbvsbb',
    hu_ante: 'huante',
    vs_limp: 'vslimp'
  };
  if (!q.sourceMode && sel.situation) {
    q.sourceMode = situationToMode[sel.situation] || null;
  }
  if (!q.rawSpot && sel.trainerSpotLabel) q.rawSpot = sel.trainerSpotLabel;

  return q;
}

export function inventoryTrainer(charts = []) {
  const uoPositions = new Set();
  const uoStacks = new Set();
  const modes = new Map();

  for (const c of charts) {
    if (c.sourceMode === 'uo') {
      if (c.heroPosition?.raw) uoPositions.add(c.heroPosition.raw);
      if (c.stack?.raw) uoStacks.add(c.stack.raw);
    }
    if (!modes.has(c.sourceMode)) {
      modes.set(c.sourceMode, { spots: new Set(), stacks: new Set(), positions: new Set() });
    }
    const m = modes.get(c.sourceMode);
    if (c.spot?.rawSpot) m.spots.add(c.spot.rawSpot);
    if (c.stack?.raw) m.stacks.add(c.stack.raw);
    if (c.heroPosition?.raw) m.positions.add(c.heroPosition.raw);
  }

  const sortStacks = (arr) =>
    [...arr].sort((a, b) => {
      const na = parseFloat(String(a).replace(/[^\d.]/g, '')) || 0;
      const nb = parseFloat(String(b).replace(/[^\d.]/g, '')) || 0;
      return na - nb;
    });

  return {
    positions: ['EP', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'BB', 'SB'],
    uoPositions: sortStacks(uoPositions),
    uoStacks: sortStacks(uoStacks),
    sourceModes: [...modes.keys()].sort(),
    modeInventory: Object.fromEntries(
      [...modes.entries()].map(([mode, v]) => [
        mode,
        {
          label: SOURCE_MODE_LABELS[mode] || mode,
          spots: [...v.spots].sort(),
          stacks: sortStacks(v.stacks),
          positions: [...v.positions].sort()
        }
      ])
    ),
    chartCount: charts.length
  };
}

export async function buildTrainerMatrix(lookup, sel) {
  const query = selectionToTrainerQuery(sel);
  const spot = lookup.lookupSpot(query);

  if (!spot.chart) {
    return {
      cells: {},
      found: 0,
      supported: false,
      sourceType: 'trainer',
      matchStatus: spot.status,
      mismatches: spot.mismatches || []
    };
  }

  const chart = spot.chart;
  const cells = {};
  let found = 0;

  for (const hand of matrixClasses()) {
    const handRec = await lookup.lookupHand(chart.id, hand);
    const cell = cellFromTrainerHand(handRec ? { ...handRec, hand } : null);
    if (cell.supported) found++;
    cells[hand] = cell;
  }

  return {
    cells,
    found,
    supported: true,
    sourceType: 'trainer',
    sourceLabel: TRAINER_USER_LABEL,
    rangeId: chart.id,
    matchStatus: spot.status,
    mismatches: spot.mismatches || [],
    chartMeta: {
      sourceMode: chart.sourceMode,
      rawSpot: chart.spot?.rawSpot,
      stack: chart.stack?.raw,
      heroPosition: chart.heroPosition,
      opponentPosition: chart.opponentPosition,
      betSize: chart.betSize?.raw,
      dataStatus: chart.dataStatus
    },
    provenance: chart.provenance,
    provenanceDebug: formatProvenanceDebug(chart.provenance)
  };
}

export async function handDetailFromTrainer(lookup, sel, hand) {
  const result = await lookup.lookupHandAction({ ...selectionToTrainerQuery(sel), hand });
  const cell = cellFromTrainerHand(
    result.action != null || result.dataStatus
      ? { hand, actionRaw: result.action, dataStatus: result.dataStatus, gradingAllowed: result.gradingAllowed }
      : null
  );

  return {
    hand,
    actionLabel: cell.actionLabel,
    actionCode: cell.action,
    trainerActionRaw: cell.trainerActionRaw,
    dataStatus: cell.dataStatus,
    gradingAllowed: cell.gradingAllowed,
    bucketLabel: cell.bucketLabel,
    matchStatus: result.status,
    mismatches: result.mismatches || [],
    sourceLabel: TRAINER_USER_LABEL,
    provenance: result.provenance || result.chart?.provenance,
    provenanceDebug: formatProvenanceDebug(result.provenance || result.chart?.provenance),
    unavailable: cell.unavailable || false
  };
}

export function lookupTrainerRange(lookup, sel) {
  const spot = lookup.lookupSpot(selectionToTrainerQuery(sel));
  return spot.chart ? { ...spot.chart, matchStatus: spot.status, mismatches: spot.mismatches } : null;
}

export { MATCH_STATUS, TRAINER_STATUS, ACTION_DISPLAY, SOURCE_MODE_LABELS };
