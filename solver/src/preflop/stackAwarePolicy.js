// Stack-aware preflop overlay. Atlas covers 20/25/30/40/50 BB only.
// Other buckets must not silently reuse a neighboring atlas row as "optimal".

import { STRATEGY_SOURCE } from '../analysis/strategySource.js';

export const MEANINGFUL_STACK_BUCKETS = [5, 7, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100];
export const ATLAS_STACKS = [20, 25, 30, 40, 50];

export function nearestValue(v, arr) {
  return arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), arr[0]);
}

export function stackBucket(bb) {
  return nearestValue(Number(bb) || 20, MEANINGFUL_STACK_BUCKETS);
}

function norm(policy) {
  const out = {};
  let sum = 0;
  for (const [k, v] of Object.entries(policy || {})) {
    const n = Math.max(0, Number(v) || 0);
    out[k] = n;
    sum += n;
  }
  if (sum <= 0) return { FOLD: 1 };
  if (sum > 1.5) {
    for (const k of Object.keys(out)) out[k] = out[k] / sum;
  }
  return out;
}

function setFreq(policy, action, value) {
  const p = { ...norm(policy) };
  p[action] = value;
  return norm(p);
}

function bump(policy, from, to, amount) {
  const p = { ...norm(policy) };
  const take = Math.min(amount, p[from] || 0);
  p[from] = (p[from] || 0) - take;
  p[to] = (p[to] || 0) + take;
  return norm(p);
}

export function buildPreflopKey({ spot = 'RFI', pos = 'BTN', villainPos = 'BB', stack, hand }) {
  const st = nearestValue(stack, ATLAS_STACKS);
  const raw = String(hand || '');
  const hc = raw.length >= 3
    ? raw.slice(0, 2).toUpperCase() + raw.slice(2).toLowerCase()
    : raw.toUpperCase();
  const p = String(pos || 'BTN').toUpperCase();
  const v = String(villainPos || 'BB').toUpperCase();
  const family = String(spot || 'RFI').toUpperCase();
  if (family === 'BB_DEFEND') return `BB_DEFEND|${v}|${st}|${hc}`;
  if (family === 'VS_OPEN') return `VS_OPEN|${p}|${v}|${st}|${hc}`;
  if (family === 'VS_3BET') return `VS_3BET|${p}|${st}|${hc}`;
  return `RFI|${p}|${st}|${hc}`;
}

export function lookupStackAwarePreflop(atlas, query = {}) {
  const stack = Number(query.stack || query.effStack || 20);
  const bucket = stackBucket(stack);
  const atlasStack = nearestValue(stack, ATLAS_STACKS);
  const key = buildPreflopKey({ ...query, stack: atlasStack, hand: query.hand });
  const atlasPolicy = atlas && atlas[key] ? norm(atlas[key]) : null;
  const inAtlasBand = ATLAS_STACKS.includes(bucket) || Math.abs(stack - atlasStack) <= 2.5;

  if (atlasPolicy && inAtlasBand && bucket !== 15 && bucket !== 75 && bucket !== 100
    && bucket >= 20 && bucket <= 50) {
    const exactKey = buildPreflopKey({ ...query, stack: bucket, hand: query.hand });
    const exact = atlas[exactKey] ? norm(atlas[exactKey]) : atlasPolicy;
    return {
      policy: exact,
      key: atlas[exactKey] ? exactKey : key,
      stackBucket: bucket,
      atlasStack: atlas[exactKey] ? bucket : atlasStack,
      strategySource: STRATEGY_SOURCE.CURATED_REFERENCE,
      note: 'Curated preflop atlas row for this stack bucket. Not a live solver dump.'
    };
  }

  const base = atlasPolicy || heuristicBase(query);
  const adjusted = applyStackHeuristic(base, query.spot || 'RFI', bucket, query.hand);
  return {
    policy: adjusted,
    key,
    stackBucket: bucket,
    atlasStack,
    strategySource: STRATEGY_SOURCE.HEURISTIC,
    note: `No atlas row for ${bucket} BB; stack-aware heuristic overlay on nearest ${atlasStack} BB reference. Not claimed optimal for all depths.`
  };
}

function heuristicBase(query) {
  const family = String(query.spot || 'RFI').toUpperCase();
  if (family === 'CALL_VS_SHOVE' || family === 'BB_DEFEND') return { FOLD: 0.55, CALL: 0.45 };
  if (family === 'VS_3BET') return { FOLD: 0.62, CALL: 0.22, RAISE: 0.16 };
  return { FOLD: 0.4, RAISE: 0.6 };
}

export function applyStackHeuristic(base, spot, bucket, hand) {
  const family = String(spot || 'RFI').toUpperCase();
  let p = { ...norm(base) };
  const hc = String(hand || '');
  const premium = /^(AA|KK|QQ|AKs|AKo)$/.test(hc);
  const playable = /s$|A[2-9]|[KQJT]/.test(hc) || /^(JJ|TT|99|88|77|66)/.test(hc);

  if (bucket <= 12) {
    if (family === 'RFI') {
      p = bump(p, 'RAISE', 'ALLIN', premium || playable ? 0.85 : 0.35);
      if (!playable && !premium) p = bump(p, 'RAISE', 'FOLD', 0.7);
      if (!p.ALLIN && (p.PUSH != null)) p.ALLIN = p.PUSH;
      if (premium) p = { FOLD: 0.02, ALLIN: 0.98 };
      else if (playable) p = bump(setFreq(p, 'ALLIN', Math.max(p.ALLIN || 0, 0.55)), 'RAISE', 'ALLIN', 0.4);
      else p = { FOLD: 0.92, ALLIN: 0.08 };
    } else if (family === 'BB_DEFEND' || family === 'VS_OPEN') {
      if (premium) p = { FOLD: 0.02, CALL: 0.05, RAISE: 0.05, ALLIN: 0.88 };
      else if (playable) p = { FOLD: 0.25, CALL: 0.35, ALLIN: 0.4 };
      else p = { FOLD: 0.88, CALL: 0.12 };
    } else if (family === 'VS_3BET') {
      p = premium ? { FOLD: 0.02, ALLIN: 0.98 } : playable
        ? { FOLD: 0.55, CALL: 0.05, ALLIN: 0.4 }
        : { FOLD: 0.95, CALL: 0.05 };
    }
  } else if (bucket <= 15) {
    if (family === 'RFI') {
      p = premium ? { FOLD: 0.01, RAISE: 0.15, ALLIN: 0.84 }
        : playable ? { FOLD: 0.12, RAISE: 0.38, ALLIN: 0.5 }
          : { FOLD: 0.78, RAISE: 0.12, ALLIN: 0.1 };
    } else if (family === 'BB_DEFEND') {
      p = playable || premium
        ? { FOLD: 0.22, CALL: 0.48, RAISE: 0.3 }
        : { FOLD: 0.72, CALL: 0.28 };
    }
  } else if (bucket >= 75) {
    if (family === 'RFI') {
      p = bump(p, 'ALLIN', 'RAISE', 0.9);
      p = bump(p, 'FOLD', 'RAISE', playable ? 0.12 : 0);
      if (p.ALLIN) p.ALLIN = Math.min(p.ALLIN, 0.02);
    } else if (family === 'BB_DEFEND') {
      p = bump(p, 'FOLD', 'CALL', 0.18);
      p = bump(p, 'ALLIN', 'CALL', 0.5);
    } else if (family === 'VS_3BET') {
      p = bump(p, 'ALLIN', 'CALL', 0.4);
      if (playable) p = bump(p, 'FOLD', 'CALL', 0.1);
    }
  }
  return norm(p);
}

export function policiesDifferMaterially(a, b, { minActionDelta = 0.12 } = {}) {
  const pa = norm(a);
  const pb = norm(b);
  const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
  let max = 0;
  for (const k of keys) max = Math.max(max, Math.abs((pa[k] || 0) - (pb[k] || 0)));
  return max >= minActionDelta;
}
