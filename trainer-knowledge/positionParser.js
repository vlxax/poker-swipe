// Parse trainer position strings — never collapse groups to a single seat.

const KNOWN_POSITIONS = new Set([
  'UTG', 'UTG+1', 'EP', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'IP', 'OOP'
]);

const GROUP_SEPARATORS = /[_+]|(?:\s*-\s*)/;

export function parseTrainerPosition(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return { type: 'UNKNOWN', values: [], raw: value || null };
  }

  const lower = value.toLowerCase();
  if (lower === 'any_position' || lower === 'any') {
    return { type: 'ANY', values: [], raw: value };
  }

  if (lower === '20bb_game') {
    return { type: 'CONTEXT', values: [], raw: value, context: '20BB_game' };
  }

  // Single known seat
  const upper = value.toUpperCase();
  if (KNOWN_POSITIONS.has(upper)) {
    return { type: 'SINGLE', values: [upper], raw: value };
  }

  // Composite labels like SB_R_HJ-BTN — preserve structure, extract known tokens
  const tokens = value
    .split(GROUP_SEPARATORS)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .flatMap((t) => {
      if (KNOWN_POSITIONS.has(t)) return [t];
      if (t.includes('BTN') && t.includes('CO')) return ['BTN', 'CO'];
      return [];
    });

  const unique = [...new Set(tokens)];
  if (unique.length === 1) {
    return { type: 'SINGLE', values: unique, raw: value };
  }
  if (unique.length > 1) {
    return { type: 'GROUP', values: unique, raw: value };
  }

  return { type: 'GROUP', values: [], raw: value };
}

export function positionMatchKind(queryPos, recordPos) {
  const q = parseTrainerPosition(queryPos);
  const r = parseTrainerPosition(recordPos);

  if (q.type === 'UNKNOWN' || r.type === 'UNKNOWN') return 'none';
  if (r.type === 'ANY') return 'group';
  if (q.type === 'ANY') return 'group';

  if (q.type === 'SINGLE' && r.type === 'SINGLE') {
    return q.values[0] === r.values[0] ? 'exact' : 'none';
  }

  if (q.type === 'SINGLE' && r.type === 'GROUP') {
    return r.values.includes(q.values[0]) ? 'group' : 'none';
  }

  if (q.type === 'GROUP' && r.type === 'GROUP') {
    const overlap = q.values.filter((v) => r.values.includes(v));
    if (overlap.length === q.values.length && overlap.length === r.values.length) return 'exact_group';
    if (overlap.length > 0) return 'group';
  }

  return 'none';
}
