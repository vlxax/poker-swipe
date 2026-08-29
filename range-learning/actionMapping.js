/**
 * Production action names → Strategy Map / Mistake Memory canonical actions.
 *
 * Status:
 *   SAFE        — same poker meaning, lossless
 *   ALIAS       — equivalent name, stored under the canonical SM action
 *   LOSSY       — would collapse distinct poker actions (we do not do this)
 *   UNSUPPORTED — not a gradable strategy action in production
 *
 * Do not silently collapse 3BET/4BET/AI into RAISE.
 */

export const ACTION_MAPPING_TABLE = [
  { production: 'FOLD', canonical: 'FOLD', status: 'SAFE' },
  { production: 'CALL', canonical: 'CALL', status: 'SAFE' },
  { production: 'RAISE', canonical: 'RAISE', status: 'SAFE' },
  { production: 'CHECK', canonical: 'CHECK', status: 'SAFE' },
  { production: 'BET', canonical: 'BET', status: 'SAFE' },
  { production: 'AI', canonical: 'AI', status: 'SAFE' },
  { production: 'ALLIN', canonical: 'AI', status: 'ALIAS' },
  { production: 'PUSH', canonical: 'PUSH', status: 'SAFE' },
  { production: '3BET', canonical: '3BET', status: 'SAFE' },
  { production: '4BET', canonical: '4BET', status: 'SAFE' },
  { production: 'UNSELECTED', canonical: 'FOLD', status: 'SAFE', note: 'Trainer-confirmed fold' },
  { production: 'nAI', canonical: null, status: 'UNSUPPORTED', note: 'Needs clarification; not gradable' },
  { production: 'LOW_PLAYABILITY', canonical: null, status: 'UNSUPPORTED', note: 'Not gradable' },
  { production: 'UO', canonical: null, status: 'UNSUPPORTED', note: 'Not gradable' }
];

const BY_PRODUCTION = new Map(ACTION_MAPPING_TABLE.map((row) => [row.production, row]));

export function mapProductionAction(raw) {
  if (raw == null || raw === '') {
    return { production: raw, canonical: null, status: 'UNSUPPORTED', note: 'empty' };
  }
  const key = String(raw).trim();
  const known = BY_PRODUCTION.get(key) || BY_PRODUCTION.get(key.toUpperCase());
  if (known) return { ...known, production: key };
  return {
    production: key,
    canonical: null,
    status: 'UNSUPPORTED',
    note: 'unknown production action; not invented or collapsed'
  };
}

export function isSupportedAction(raw) {
  const row = mapProductionAction(raw);
  return row.status === 'SAFE' || row.status === 'ALIAS';
}

/**
 * Convert a production policy object { FOLD: 0.5, RAISE: 0.5 } into a canonical
 * positive distribution. Invalid / unsupported keys are reported, not collapsed.
 */
export function mapProductionDistribution(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return { ok: false, distribution: null, errors: ['policy must be an object'], dropped: [] };
  }

  const distribution = {};
  const dropped = [];
  const errors = [];

  for (const [raw, value] of Object.entries(policy)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${raw}: non-finite frequency ${value}`);
      continue;
    }
    if (value < 0) {
      errors.push(`${raw}: negative frequency ${value}`);
      continue;
    }
    if (value === 0) continue;

    const mapped = mapProductionAction(raw);
    if (mapped.status === 'UNSUPPORTED' || mapped.canonical == null) {
      dropped.push({ production: raw, status: mapped.status, note: mapped.note });
      continue;
    }
    distribution[mapped.canonical] = (distribution[mapped.canonical] || 0) + value;
  }

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (errors.length) {
    return { ok: false, distribution: null, errors, dropped, total };
  }
  if (total === 0) {
    return { ok: false, distribution: null, errors: ['empty positive distribution'], dropped, total };
  }
  if (Math.abs(total - 1) > 0.001) {
    return {
      ok: false,
      distribution: null,
      errors: [`frequencies sum to ${total}, not 1`],
      dropped,
      total
    };
  }

  return { ok: true, distribution, errors: [], dropped, total };
}
