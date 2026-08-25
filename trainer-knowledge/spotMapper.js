// Trainer raw spot → canonical id + optional PokerSwipe alias. Never discard raw names.

import { SPOT_MAP_STATUS } from './status.js';

/** Obvious exact mappings only — no guessing. */
const EXACT_SPOT_ALIASES = {
  Def_BB: { pokerswipeSituation: 'bb_defend', confidence: 'exact' },
  BB_Def: { pokerswipeSituation: 'bb_defend', confidence: 'exact' },
  Open_Push: { pokerswipeSituation: 'push_fold', confidence: 'exact' },
  Resteal: { pokerswipeSituation: 'resteal', confidence: 'exact' },
  vs_4Bet_Push: { pokerswipeSituation: 'vs_4bet', confidence: 'exact' },
  BB_ISO: { pokerswipeSituation: 'iso', confidence: 'partial' },
  SB_UO: { pokerswipeSituation: null, confidence: 'partial', note: 'UO label preserved' }
};

const SOURCE_MODE_DEFAULTS = {
  vs1r: { pokerswipeSituation: 'vs_open', confidence: 'partial' },
  vs1rshort: { pokerswipeSituation: 'vs_open', confidence: 'partial' },
  vs1r1c: { pokerswipeSituation: 'vs_open', confidence: 'partial' },
  vs3bet: { pokerswipeSituation: 'vs_3bet', confidence: 'partial' },
  vs4bet: { pokerswipeSituation: 'vs_4bet', confidence: 'partial' },
  vs2r: { pokerswipeSituation: 'vs_3bet', confidence: 'partial' },
  vssqueeze: { pokerswipeSituation: 'vs_squeeze', confidence: 'partial' },
  vslimp: { pokerswipeSituation: 'vs_limp', confidence: 'partial' },
  sbvsbb: { pokerswipeSituation: 'sb_vs_bb', confidence: 'partial' },
  callpush: { pokerswipeSituation: 'call_vs_push', confidence: 'partial' },
  huante: { pokerswipeSituation: 'hu_ante', confidence: 'partial' }
};

export function trainerCanonicalId(sourceMode, rawSpot) {
  const mode = String(sourceMode || 'unknown').trim() || 'unknown';
  const spot = String(rawSpot || '').trim();
  if (spot) return `${mode}::${spot}`;
  return `${mode}::(no_spot)`;
}

export function mapTrainerSpot({ sourceMode, rawSpot, sourceGroup = null }) {
  const raw = String(rawSpot || '').trim();
  const mode = String(sourceMode || '').trim();
  const canonicalId = trainerCanonicalId(mode, raw);

  if (raw === 'UO' || sourceGroup === 'UO') {
    return {
      rawSpot: raw || 'UO',
      trainerCanonicalId: 'uo::open',
      pokerswipeAlias: 'rfi',
      mapStatus: SPOT_MAP_STATUS.MAPPED_PARTIAL,
      mapNote: 'UO dataset — open range by position/stack; UO label NEEDS_CLARIFICATION'
    };
  }

  if (raw && EXACT_SPOT_ALIASES[raw]) {
    const alias = EXACT_SPOT_ALIASES[raw];
    return {
      rawSpot: raw || null,
      trainerCanonicalId: canonicalId,
      pokerswipeAlias: alias.pokerswipeSituation,
      mapStatus:
        alias.confidence === 'exact' ? SPOT_MAP_STATUS.MAPPED_EXACT : SPOT_MAP_STATUS.MAPPED_PARTIAL,
      mapNote: alias.note || null
    };
  }

  if (!raw && mode && SOURCE_MODE_DEFAULTS[mode]) {
    const alias = SOURCE_MODE_DEFAULTS[mode];
    return {
      rawSpot: null,
      trainerCanonicalId: canonicalId,
      pokerswipeAlias: alias.pokerswipeSituation,
      mapStatus: SPOT_MAP_STATUS.MAPPED_PARTIAL,
      mapNote: `Inferred from source_mode=${mode} only`
    };
  }

  if (raw && mode) {
    return {
      rawSpot: raw,
      trainerCanonicalId: canonicalId,
      pokerswipeAlias: null,
      mapStatus: SPOT_MAP_STATUS.UNMAPPED_TRAINER_SPOT,
      mapNote: null
    };
  }

  if (sourceGroup === 'UO') {
    return {
      rawSpot: 'UO',
      trainerCanonicalId: 'uo::open',
      pokerswipeAlias: 'rfi',
      mapStatus: SPOT_MAP_STATUS.MAPPED_PARTIAL,
      mapNote: 'UO dataset — open range by position/stack; UO label NEEDS_CLARIFICATION'
    };
  }

  return {
    rawSpot: raw || null,
    trainerCanonicalId: canonicalId,
    pokerswipeAlias: null,
    mapStatus: SPOT_MAP_STATUS.UNMAPPED_TRAINER_SPOT,
    mapNote: null
  };
}
