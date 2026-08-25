// Central trainer stack-band parser — explicit semantics, no arbitrary flattening.

export const UO_RAISE_THRESHOLD_BB = 18;

/**
 * @typedef {Object} StackSemantics
 * @property {'EXACT'|'RANGE'|'MINIMUM'|'CONTEXT'|'UNKNOWN'} type
 * @property {string} raw
 * @property {number} [bb]
 * @property {number} [minBb]
 * @property {number} [maxBb]
 * @property {string} [contextKind]
 * @property {string} [note]
 */

/** @param {string|null|undefined} stackRaw */
export function parseTrainerStack(stackRaw) {
  const raw = String(stackRaw || '').trim();
  if (!raw) return { type: 'UNKNOWN', raw };

  if (raw.toLowerCase().startsWith('vs_')) {
    return parseContextStack(raw);
  }

  const normalized = raw.toUpperCase().replace(/BBPLUS/g, 'BB+').replace(/PLUS/g, '+');

  const plusMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*BB\+$/);
  if (plusMatch) {
    return { type: 'MINIMUM', raw, minBb: parseFloat(plusMatch[1]) };
  }

  const rangeMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*BB$/);
  if (rangeMatch) {
    return {
      type: 'RANGE',
      raw,
      minBb: parseFloat(rangeMatch[1]),
      maxBb: parseFloat(rangeMatch[2])
    };
  }

  const exactMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*BB$/);
  if (exactMatch) {
    return { type: 'EXACT', raw, bb: parseFloat(exactMatch[1]) };
  }

  return { type: 'UNKNOWN', raw };
}

/** @param {string} raw */
function parseContextStack(raw) {
  const body = raw.slice(3);
  const openMatch = body.match(/^(\d+(?:\.\d+)?)\s*BB/i);
  if (openMatch && /_\dx/i.test(body)) {
    return {
      type: 'CONTEXT',
      raw,
      contextKind: 'VS_OPEN',
      bb: parseFloat(openMatch[1]),
      note: 'Villain/spot stack context — not used for UO green nAI/RAISE rule'
    };
  }
  const rangeMatch = body.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*BB/i);
  if (rangeMatch) {
    return {
      type: 'CONTEXT',
      raw,
      contextKind: 'VS_RANGE',
      minBb: parseFloat(rangeMatch[1]),
      maxBb: parseFloat(rangeMatch[2]),
      note: 'Villain/spot stack context — not used for UO green nAI/RAISE rule'
    };
  }
  return { type: 'CONTEXT', raw, contextKind: 'VS_UNKNOWN' };
}

/** @param {StackSemantics} semantics @param {number} bb */
export function stackContainsBb(semantics, bb) {
  const t = semantics.type;
  if (t === 'EXACT') return semantics.bb === bb;
  if (t === 'RANGE') return semantics.minBb <= bb && bb <= semantics.maxBb;
  if (t === 'MINIMUM') return bb >= semantics.minBb;
  if (t === 'CONTEXT' && semantics.bb != null) return semantics.bb === bb;
  if (t === 'CONTEXT' && semantics.minBb != null) {
    return semantics.minBb <= bb && bb <= semantics.maxBb;
  }
  return false;
}

/** @param {number} queryBb @param {StackSemantics} recordSemantics */
export function matchQueryToRecord(queryBb, recordSemantics) {
  if (recordSemantics.type === 'EXACT') {
    return recordSemantics.bb === queryBb ? 'exact' : 'none';
  }
  if (recordSemantics.type === 'RANGE') {
    const { minBb, maxBb } = recordSemantics;
    return queryBb >= minBb && queryBb <= maxBb ? 'band' : 'none';
  }
  if (recordSemantics.type === 'MINIMUM') {
    return queryBb >= recordSemantics.minBb ? 'band' : 'none';
  }
  return 'none';
}

/** @param {string} queryRaw @param {StackSemantics[]} records */
export function matchQueryToRecords(queryRaw, records) {
  const query = parseTrainerStack(queryRaw);
  if (query.type === 'EXACT') {
    const queryBb = query.bb;
    const matches = records.filter((r) => matchQueryToRecord(queryBb, r) !== 'none');
    if (matches.length === 0) return { kind: 'none', ambiguous: false, matches: 0 };
    if (matches.length === 1) {
      return { kind: matchQueryToRecord(queryBb, matches[0]), ambiguous: false, matches: 1 };
    }
    return { kind: 'band', ambiguous: true, matches: matches.length };
  }

  const exactRaw = records.filter((r) => r.raw === query.raw);
  if (exactRaw.length === 1) return { kind: 'exact', ambiguous: false, matches: 1 };
  if (exactRaw.length > 1) return { kind: 'exact', ambiguous: true, matches: exactRaw.length };

  return { kind: 'none', ambiguous: false, matches: 0 };
}

/**
 * Resolve green legend action from stack semantics per SOURCE_NOTES.
 * @param {string|null|undefined} stackRaw
 * @param {{ threshold?: number }} [opts]
 */
export function greenActionForStack(stackRaw, opts = {}) {
  const threshold = opts.threshold ?? UO_RAISE_THRESHOLD_BB;
  const sem = parseTrainerStack(stackRaw);
  const t = sem.type;

  if (t === 'UNKNOWN' || t === 'CONTEXT') {
    return {
      rawAction: 'nAI',
      gradingAllowed: false,
      dataStatus: 'NEEDS_CLARIFICATION',
      resolutionNote: `stack type ${t} — no UO green rule applied`
    };
  }

  if (t === 'EXACT') {
    if (sem.bb <= threshold) {
      return {
        rawAction: 'nAI',
        gradingAllowed: false,
        dataStatus: 'NEEDS_CLARIFICATION',
        resolutionNote: `exact ${sem.bb}BB <= ${threshold}`
      };
    }
    return {
      rawAction: 'RAISE',
      gradingAllowed: true,
      dataStatus: 'EXACT_TRAINER_DATA',
      resolutionNote: `exact ${sem.bb}BB > ${threshold}`
    };
  }

  if (t === 'MINIMUM') {
    if (sem.minBb > threshold) {
      return {
        rawAction: 'RAISE',
        gradingAllowed: true,
        dataStatus: 'EXACT_TRAINER_DATA',
        resolutionNote: `minimum ${sem.minBb}BB+ entirely > ${threshold}`
      };
    }
    return {
      rawAction: 'nAI',
      gradingAllowed: false,
      dataStatus: 'NEEDS_CLARIFICATION',
      resolutionNote: `minimum ${sem.minBb}BB+ spans <= and > ${threshold}`
    };
  }

  if (t === 'RANGE') {
    const { minBb, maxBb } = sem;
    if (maxBb <= threshold) {
      return {
        rawAction: 'nAI',
        gradingAllowed: false,
        dataStatus: 'NEEDS_CLARIFICATION',
        resolutionNote: `range ${minBb}-${maxBb}BB entirely <= ${threshold}`
      };
    }
    if (minBb > threshold) {
      return {
        rawAction: 'RAISE',
        gradingAllowed: true,
        dataStatus: 'EXACT_TRAINER_DATA',
        resolutionNote: `range ${minBb}-${maxBb}BB entirely > ${threshold}`
      };
    }
    return {
      rawAction: 'nAI',
      gradingAllowed: false,
      dataStatus: 'NEEDS_CLARIFICATION',
      resolutionNote: `range ${minBb}-${maxBb}BB spans ${threshold} boundary — ambiguous`
    };
  }

  return {
    rawAction: 'nAI',
    gradingAllowed: false,
    dataStatus: 'NEEDS_CLARIFICATION',
    resolutionNote: 'unhandled stack type'
  };
}

/** @param {string|null|undefined} stackRaw */
export function parseStackBb(stackRaw) {
  const sem = parseTrainerStack(stackRaw);
  return sem.type === 'EXACT' ? sem.bb : null;
}
