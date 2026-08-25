// Required query dimensions per trainer sourceMode — derived from charts-index + HC1 dataset.

/** @typedef {'heroPosition'|'stack'|'opponentPosition'|'betSize'|'rawSpot'|'trainerCanonicalId'|'hand'|'anteContext'} TrainerDimension */

/** @type {Record<string, { required: TrainerDimension[], optional: TrainerDimension[], notes?: string }>} */
export const SOURCE_MODE_REQUIREMENTS = {
  uo: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: [],
    notes: 'Unopened raise/fold — stack band (2-4 … 40+) + hero position'
  },
  vs1r: {
    required: ['heroPosition', 'stack', 'opponentPosition', 'hand'],
    optional: ['betSize'],
    notes: 'Facing single open — stack band + villain position'
  },
  vs1rshort: {
    required: ['heroPosition', 'stack', 'opponentPosition', 'rawSpot', 'hand'],
    optional: ['betSize'],
    notes: 'Short-stack facing open — rawSpot (e.g. Def_BB) required'
  },
  vs1r1c: {
    required: ['heroPosition', 'stack', 'opponentPosition', 'hand'],
    optional: ['betSize'],
    notes: 'Facing open + caller'
  },
  vs2r: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition', 'betSize'],
    notes: 'Facing two raises'
  },
  vs3bet: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition', 'betSize'],
    notes: 'Facing 3-bet'
  },
  vs4bet: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition', 'betSize'],
    notes: 'Facing 4-bet / push'
  },
  vssqueeze: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition'],
    notes: 'Facing squeeze'
  },
  vslimp: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition'],
    notes: 'Facing limp'
  },
  callpush: {
    required: ['heroPosition', 'stack', 'rawSpot', 'hand'],
    optional: [],
    notes: 'Call vs push / resteal — rawSpot Resteal typical'
  },
  sbvsbb: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition'],
    notes: 'SB vs BB blind battle'
  },
  huante: {
    required: ['heroPosition', 'stack', 'hand'],
    optional: ['opponentPosition', 'anteContext'],
    notes: 'Heads-up with ante'
  }
};

export function requiredDimensionsForMode(sourceMode) {
  return SOURCE_MODE_REQUIREMENTS[sourceMode]?.required || [];
}

export function checkQueryCompleteness(query = {}, sourceMode = null) {
  const mode = sourceMode || query.sourceMode;
  const spec = SOURCE_MODE_REQUIREMENTS[mode];
  if (!spec) {
    return { complete: false, missing: ['sourceMode'], mode };
  }
  const missing = spec.required.filter((dim) => {
    const v = query[dim];
    return v == null || v === '';
  });
  return { complete: missing.length === 0, missing, mode };
}
