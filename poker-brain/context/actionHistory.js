import { UNKNOWN, isUnknown } from './DecisionContext.js';
import { normalizePosition, normalizeStreet } from './positions.js';

const CANONICAL = new Set(['FOLD', 'CALL', 'CHECK', 'BET', 'RAISE', 'OPEN', '3BET', '4BET', 'JAM', 'UNOPENED']);

const ALIAS_MAP = [
  [/^(FOLD|ФОЛД)$/i, 'FOLD'],
  [/^(CALL|КОЛЛ)$/i, 'CALL'],
  [/^(CHECK|ЧЕК)$/i, 'CHECK'],
  [/^(BET|СТАВКА)/i, 'BET'],
  [/^(RAISE|РЕЙЗ)$/i, 'RAISE'],
  [/^(OPEN|ОТКРЫТ|ОУПЕН)/i, 'OPEN'],
  [/^(3-?BET|3-?БЕТ)$/i, '3BET'],
  [/^(4-?BET|4-?БЕТ)$/i, '4BET'],
  [/^(JAM|ОЛЛ-?ИН|PUSH|ПУШ)$/i, 'JAM'],
  [/UNOPENED|FIRST\s*IN|СФОЛДИЛИ/i, 'UNOPENED']
];

function numOrUnknown(v) {
  if (v === null || v === undefined || v === '') return UNKNOWN;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : UNKNOWN;
}

export function canonicalizeActionType(raw) {
  const s = String(raw || '').trim();
  if (!s) return { action: UNKNOWN, rawAction: raw };
  const upper = s.toUpperCase();
  if (CANONICAL.has(upper)) return { action: upper, rawAction: s };
  for (const [re, canon] of ALIAS_MAP) {
    if (re.test(s)) return { action: canon, rawAction: s };
  }
  return { action: upper, rawAction: s };
}

function actorFromRaw(a) {
  if (!a) return UNKNOWN;
  const u = String(a).toUpperCase();
  if (u === 'HERO' || u === 'VILLAIN' || u === 'TABLE') return u;
  if (/^VILLAIN/i.test(u)) return 'VILLAIN';
  return u;
}

/**
 * Normalize one action to canonical shape.
 */
export function normalizeActionEntry(entry, opts = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const { action: canon, rawAction } = canonicalizeActionType(entry.action || entry.type || entry.text);
  const street = normalizeStreet(entry.street);
  const position = normalizePosition(entry.position || entry.pos || entry.seat);
  const amountBB = numOrUnknown(entry.amountBB ?? entry.sizeBB ?? entry.size ?? entry.amount);
  const raiseToBB = numOrUnknown(entry.raiseToBB ?? entry.raiseTo ?? entry.toBB);
  const allIn = !!(entry.allIn || entry.all_in || canon === 'JAM' || /олл/i.test(String(rawAction)));

  let meta = entry.metadata && typeof entry.metadata === 'object' ? { ...entry.metadata } : {};
  if (rawAction && canon !== String(rawAction).toUpperCase()) {
    meta = { ...meta, rawAction };
  } else if (rawAction && !CANONICAL.has(String(rawAction).toUpperCase())) {
    meta = { ...meta, rawAction };
  }

  return {
    street: isUnknown(street) ? (opts.defaultStreet || UNKNOWN) : street,
    actor: actorFromRaw(entry.actor),
    position,
    action: canon,
    amountBB,
    raiseToBB,
    allIn,
    ...(Object.keys(meta).length ? { metadata: meta } : {})
  };
}

/** Parse loose text lines from canonical history { street, text, pot }. */
export function actionsFromHistoryLine(h) {
  const text = String(h?.text || '');
  const street = normalizeStreet(h?.street);
  const out = [];
  if (/сфолдили|unopened|first in|до тебя все/i.test(text)) {
    out.push(normalizeActionEntry({ street, actor: 'TABLE', action: 'UNOPENED', position: UNKNOWN }));
  }
  const openM = text.match(/(UTG\+?1?|HJ|CO|BTN|SB|BB|MP|LJ)\s+открыл\s+([\d.,]+)\s*ББ/i)
    || text.match(/(UTG\+?1?|HJ|CO|BTN|SB|BB|MP|LJ)\s+open(?:ed)?\s+([\d.,]+)/i);
  if (openM) {
    out.push(normalizeActionEntry({
      street: street || 'PREFLOP',
      actor: 'VILLAIN',
      position: openM[1],
      action: 'OPEN',
      amountBB: openM[2]
    }));
  }
  const threeM = text.match(/3-?бет(?:ил|ила)?\s+([\d.,]+)\s*ББ/i) || text.match(/3-?bet\s+([\d.,]+)/i);
  if (/3-?бет|3-?bet/i.test(text)) {
    const posM = text.match(/(BB|SB|BTN|CO|HJ|UTG)/i);
    out.push(normalizeActionEntry({
      street: street || 'PREFLOP',
      actor: 'VILLAIN',
      position: posM ? posM[1] : UNKNOWN,
      action: '3BET',
      amountBB: threeM ? threeM[1] : UNKNOWN
    }));
  }
  const fourM = text.match(/4-?бет|4-?bet|запушил|олл-?ин/i);
  if (fourM) {
    out.push(normalizeActionEntry({
      street: street || 'PREFLOP',
      actor: 'VILLAIN',
      action: /олл|пуш|all/i.test(text) ? 'JAM' : '4BET',
      position: UNKNOWN
    }));
  }
  return out.filter(Boolean);
}

export function normalizeActionHistory(rawList, sourceKind = 'generic') {
  if (!Array.isArray(rawList) || !rawList.length) return [];
  const out = [];
  for (const item of rawList) {
    if (item?.text && !item.action) {
      out.push(...actionsFromHistoryLine(item));
      continue;
    }
    const n = normalizeActionEntry(item, { defaultStreet: sourceKind === 'myhands' ? normalizeStreet(item.street) : UNKNOWN });
    if (n) out.push(n);
  }
  return out;
}
