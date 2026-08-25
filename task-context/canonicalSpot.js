// Single canonical spot object for training mini-apps.
// All display, grading, and trainer lookup must derive from this shape.

import { STREETS } from './schema.js';

const BOARD_LEN = { ПРЕФЛОП: 0, ФЛОП: 3, ТЁРН: 4, РИВЕР: 5 };
const STREET_ABBR = {
  'ПРЕФЛОП': 'PRE', 'ФЛОП': 'FLOP', 'ТЁРН': 'TURN', 'РИВЕР': 'RIVER',
  PRE: 'PRE', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER'
};

function seatFrom(str) {
  const m = String(str || '').match(/\b(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)\b/);
  return m ? m[1] : '';
}

function parseVsPair(task) {
  const pos = task.position || seatFrom(task.pos);
  const villain = task.villain || seatFrom(String(task.pos || '').split('vs')[1]);
  if (pos && villain) return { position: pos, villain };
  const m = String(task.pos || task.ctx || '').match(/(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)\s*(?:vs|VS)\s*(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)/);
  if (m) return { position: m[1], villain: m[2] };
  return { position: pos || 'BTN', villain: villain || 'BB' };
}

export function boardExpectedLength(street) {
  return BOARD_LEN[String(street || '').toUpperCase()] ?? null;
}

export function streetAbbrev(street) {
  const k = String(street || '').toUpperCase();
  return STREET_ABBR[k] || k.slice(0, 4) || 'PRE';
}

export function formatBoardLabel(board = []) {
  return (board || []).map((c) => String(c).replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c')).join('');
}

export function formatBoardDisplay(board = []) {
  return (board || []).join(' ');
}

function lastHistoryText(history = []) {
  return history.length ? String(history[history.length - 1].text || '') : '';
}

function preflopHistoryText(history = []) {
  const entry = (history || []).find((h) => /ПРЕФЛОП|preflop/i.test(h.street || ''));
  return entry ? String(entry.text || '') : '';
}

function parseBetPct(text) {
  const m = String(text || '').match(/(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

function parseOpenSizeBb(text = '') {
  const m = String(text).replace(',', '.')
    .match(/(?:откр(?:ыл|ыла|ытие)|open|raise|рейз|3-бет|3-bet)[^\d]{0,12}(\d+(?:\.\d+)?)\s*(?:bb|бб)/i);
  return m ? Number(m[1]) : null;
}

const ABBR_TO_STREET = {
  PRE: 'ПРЕФЛОП', PREFLOP: 'ПРЕФЛОП', ПРЕФЛОП: 'ПРЕФЛОП',
  FLOP: 'ФЛОП', ФЛОП: 'ФЛОП',
  TURN: 'ТЁРН', ТЁРН: 'ТЁРН',
  RIVER: 'РИВЕР', РИВЕР: 'РИВЕР'
};

function streetFromAbbr(abbr) {
  const k = String(abbr || '').toUpperCase();
  return ABBR_TO_STREET[k] || 'ПРЕФЛОП';
}

function streetFromBoard(board = []) {
  const len = (board || []).length;
  if (len >= 5) return 'РИВЕР';
  if (len === 4) return 'ТЁРН';
  if (len === 3) return 'ФЛОП';
  return 'ПРЕФЛОП';
}

function parseCtxVs(ctx = '') {
  const m = String(ctx).match(/(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)\s*(?:vs|VS)\s*(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)/);
  if (m) return { position: m[1], villain: m[2] };
  return null;
}

function parseXraySeats(task) {
  const vm = String(task.villain || '').match(/(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)/);
  if (!vm) return null;
  const villain = vm[1];
  const lineActor = Array.isArray(task.line) && task.line[0] ? parseActionLineVs(task.line[0]) : null;
  if (lineActor?.position === villain) {
    return { position: lineActor.villain || (villain === 'BB' ? 'BTN' : 'BB'), villain };
  }
  return { position: villain === 'BB' ? 'BTN' : 'BB', villain };
}

function parseActionLineVs(text = '') {
  const s = String(text);
  const heroAct = s.match(/^(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)\s+(?:open|call|bet|check|fold|push|raise|3-bet|4-bet|рейз|колл|фолд|чек|откр|ставит|запушил)/i);
  const vsSeat = s.match(/(?:call|open|vs|против)\s+(UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)/i);
  if (heroAct && vsSeat) return { position: heroAct[1], villain: vsSeat[1] };
  if (heroAct) {
    const villain = heroAct[1] === 'BB' ? 'BTN' : 'BB';
    return { position: heroAct[1], villain };
  }
  return null;
}

function buildHistoryFromLegacy(task) {
  if (Array.isArray(task.history) && task.history.length) {
    return task.history.map((h) => ({
      street: h.street || task.street || 'ПРЕФЛОП',
      text: h.text || '',
      pot: h.pot
    }));
  }
  if (Array.isArray(task.nodes) && task.nodes.length) {
    return task.nodes.map((n) => ({
      street: streetFromAbbr(n[0]),
      text: String(n[1] || ''),
      pot: null
    }));
  }
  if (Array.isArray(task.line) && task.line.length) {
    const xrayVs = task.ref ? parseXraySeats(task) : null;
    return task.line.filter(Boolean).map((text, i) => {
      const st = i === 0 ? 'ПРЕФЛОП' : i === 1 ? 'ФЛОП' : i === 2 ? 'ТЁРН' : 'РИВЕР';
      const prefix = i === 0 && xrayVs?.position ? `В ${xrayVs.position}. ` : '';
      return { street: st, text: `${prefix}${String(text)}`, pot: null };
    });
  }
  if (task.ctx) {
    return [{ street: task.street || streetFromBoard(task.board), text: String(task.ctx), pot: task.pot }];
  }
  return [];
}

function deriveSizingCorrect(task) {
  if (task.correct) return task.correct;
  const preferred = Array.isArray(task.preferred) ? task.preferred[0] : task.preferred;
  if (preferred) return preferred;
  const zone = task.zone || task.sizeZone;
  if (task.check === 'g') return 'ЧЕК';
  if (Array.isArray(zone) && zone.length === 2) {
    const mid = Math.round((zone[0] + zone[1]) / 2);
    return `СТАВКА ${mid}%`;
  }
  return '';
}

function normalizeLegacyFields(task) {
  const isLegacy = task._legacy
    || (!task._library && (task.ctx || task.nodes || task.zone || task.ref || task.theme));
  if (!isLegacy) return task;

  const history = buildHistoryFromLegacy(task);
  const board = Array.isArray(task.board) ? [...task.board] : [];
  const street = task.street || streetFromBoard(board);
  const xrayVs = task.ref ? parseXraySeats(task) : null;
  const ctxVs = parseCtxVs(task.ctx || '');
  const nodeVs = history.length ? parseActionLineVs(history[0].text) : null;
  const lineVs = Array.isArray(task.line) && task.line[0] ? parseActionLineVs(task.line[0]) : null;
  const posVs = parseVsPair(task);
  let position = task.position || xrayVs?.position || ctxVs?.position || nodeVs?.position || lineVs?.position || (task.pos ? posVs.position : null);
  let villain = xrayVs?.villain || seatFrom(task.villain) || ctxVs?.villain || nodeVs?.villain || lineVs?.villain || (task.pos ? posVs.villain : null);
  if (!position || !villain) {
    position = position || posVs.position;
    villain = villain || posVs.villain;
  }
  const heroStack = task.heroStack != null ? task.heroStack : (task.stack != null ? task.stack : 30);
  const villainStack = task.villainStack != null ? task.villainStack : heroStack;
  const correct = deriveSizingCorrect(task);
  const options = task.options || task.actions || task.decision || [];
  const sizingOpts = options.length ? options : (
    correct === 'ЧЕК' ? ['ЧЕК', 'СТАВКА 33%'] : (correct ? ['ЧЕК', correct] : options)
  );

  return {
    ...task,
    _legacy: true,
    id: task.id || (task.title ? `XR_${String(task.title).replace(/\s+/g, '_')}` : (task.theme ? `DAILY_${task.theme.replace(/\s+/g, '_')}` : '')),
    street,
    board,
    history,
    position,
    villain,
    heroStack,
    villainStack,
    effStack: task.effStack != null ? task.effStack : Math.min(heroStack, villainStack),
    options: sizingOpts,
    correct,
    alsoOk: task.alsoOk || task.live || [],
    explain: task.explain || task.why || '',
    concept: task.concept || task.theme || task.title || '',
    question: task.question || task.key || task.goal || '',
    reviewBadNode: task.reviewBadNode != null ? task.reviewBadNode : (task.bad != null ? task.bad : undefined),
    reviewReasons: task.reviewReasons || task.reasons,
    reviewRepair: task.reviewRepair || task.repair,
    reviewBest: task.reviewBest || task.best,
    xrayRef: task.xrayRef || task.ref,
    xrayRiver: task.xrayRiver || task.river,
    zone: task.zone || task.sizeZone,
    format: task.format || 'MTT',
    table: task.table || '6-MAX'
  };
}

/** Build the canonical spot from a library task or compatible legacy object. */
export function buildCanonicalSpot(task) {
  if (!task || typeof task !== 'object') return null;

  const normalized = normalizeLegacyFields(task);
  const vs = {
    position: normalized.position || parseVsPair(normalized).position,
    villain: normalized.villain || parseVsPair(normalized).villain
  };
  const history = buildHistoryFromLegacy(normalized);

  const heroStack = normalized.heroStack != null ? normalized.heroStack : (normalized.stack != null ? normalized.stack : null);
  const villainStack = normalized.villainStack != null ? normalized.villainStack : heroStack;
  const effStack = normalized.effStack != null
    ? normalized.effStack
    : (heroStack != null && villainStack != null ? Math.min(heroStack, villainStack) : heroStack);

  const options = normalized.options || normalized.actions || normalized.decision || [];
  const correct = normalized.correct || (Array.isArray(normalized.preferred) ? normalized.preferred[0] : normalized.preferred) || '';
  const preflopLine = preflopHistoryText(history);
  const currentLine = lastHistoryText(history);

  const spot = {
    id: normalized.id || '',
    source: normalized._library ? 'library' : (normalized._legacy ? 'legacy' : 'task'),
    format: normalized.format || 'MTT',
    stage: normalized.stage || '',
    table: normalized.table || '6-MAX',
    left: normalized.left || '',
    street: normalized.street || streetFromBoard(normalized.board),
    board: Array.isArray(normalized.board) ? [...normalized.board] : [],
    hero: Array.isArray(normalized.hero) ? [...normalized.hero] : [],
    position: vs.position,
    villain: vs.villain,
    heroStack,
    villainStack,
    effStack,
    pot: normalized.pot != null ? normalized.pot : null,
    blinds: normalized.blinds || null,
    ante: normalized.ante != null ? normalized.ante : 0,
    history,
    question: normalized.question || normalized.key || '',
    options: [...options],
    correct,
    alsoOk: [...(normalized.alsoOk || normalized.live || [])],
    concept: normalized.concept || normalized.theme || normalized.title || '',
    explain: normalized.explain || normalized.why || '',
    opp: normalized.opp,
    difficulty: normalized.difficulty != null ? normalized.difficulty : 2,
    tags: normalized.tags || [],
    reviewBadNode: normalized.reviewBadNode,
    reviewReasons: normalized.reviewReasons,
    reviewRepair: normalized.reviewRepair,
    reviewBest: normalized.reviewBest,
    xrayRef: normalized.xrayRef,
    xrayRiver: normalized.xrayRiver,
    sizingZone: normalized.zone || normalized.sizeZone || null,
    preflopLine,
    currentLine,
    openSizeBB: parseOpenSizeBb(preflopLine) ?? parseOpenSizeBb(currentLine),
    descriptionLine: '',
    gradingTarget: null,
    questionType: null
  };

  spot.descriptionLine = buildDescriptionLine(spot);
  spot.gradingTarget = inferGradingTarget(spot);
  spot.questionType = inferQuestionType(spot);
  return spot;
}

export function buildDescriptionLine(spot) {
  const pos = [spot.position, spot.villain ? `vs ${spot.villain}` : ''].filter(Boolean).join(' ');
  const board = formatBoardDisplay(spot.board);
  const line = spot.currentLine || spot.question || '';
  return [pos, board, line].filter(Boolean).join(' · ') || spot.question || spot.concept || '';
}

export function inferQuestionType(spot) {
  const q = String(spot.question || '').toLowerCase();
  const opts = spot.options || [];
  const hasPct = opts.some((o) => /\d+\s*%/.test(o)) || /сайз|размер|%/i.test(q);
  if (hasPct || /сайз|размер/i.test(spot.concept || '')) return 'sizing';
  if (/где линия|line|линия сломал/i.test(q)) return 'line_review';
  if (/диапазон|range|сузь/i.test(q)) return 'range';
  if (opts.every((o) => ['ФОЛД', 'ЧЕК', 'КОЛЛ', 'РЕЙЗ', 'СТАВКА', '3-БЕТ', '4-БЕТ', 'ОЛЛ-ИН'].some((x) => o.includes(x) || o === x))) {
    return 'action';
  }
  return 'action';
}

function choiceToActionType(choice) {
  const c = String(choice || '').trim().toUpperCase();
  if (c === 'ФОЛД') return 'fold';
  if (c === 'ЧЕК') return 'check';
  if (c === 'КОЛЛ') return 'call';
  if (c.includes('ОЛЛ-ИН') || c === 'ОЛЛИН') return 'all_in';
  if (c.includes('4-БЕТ')) return '4bet';
  if (c.includes('3-БЕТ')) return '3bet';
  if (c.includes('РЕЙЗ')) return 'raise';
  if (c.includes('СТАВКА')) {
    const sizeMatch = c.match(/(\d+)\s*%/);
    if (sizeMatch) return `bet_${sizeMatch[1]}`;
    return 'bet';
  }
  return 'check';
}

export function inferGradingTarget(spot) {
  const c = String(spot.correct || '').trim();
  if (!c) return null;
  const actionType = choiceToActionType(c);
  if (/\d+\s*%/.test(c)) {
    return { kind: 'sizing', action: c.includes('ЧЕК') ? 'check' : 'bet', pct: parseBetPct(c), actionType };
  }
  return { kind: 'action', action: c, actionType };
}

export function canonicalToDisplayContext(spot, { mode = 'swipe' } = {}) {
  if (!spot) return null;
  const oppName = spot.opp && typeof spot.opp === 'object'
    ? (spot.opp.name || 'РЕГ')
    : (typeof spot.opp === 'string' ? spot.opp : 'РЕГ');
  const blindsLabel = Array.isArray(spot.blinds) && spot.blinds.length === 2
    ? `${spot.blinds[0]}/${spot.blinds[1]}${spot.ante ? ` (${spot.ante})` : ''}`
    : null;

  return {
    tags: [spot.format, spot.stage, spot.table, spot.left].filter(Boolean),
    blinds: blindsLabel,
    pot: spot.pot != null ? `${spot.pot} ББ` : null,
    eff: spot.effStack != null ? `${spot.effStack} ББ` : (spot.heroStack != null ? `${spot.heroStack} ББ` : null),
    heroPos: spot.position || 'BTN',
    heroStack: spot.heroStack != null ? `${spot.heroStack} ББ` : '',
    villainPos: spot.villain || 'BB',
    villainStack: spot.villainStack != null ? `${spot.villainStack} ББ` : '',
    villainType: oppName,
    note: spot.opp && spot.opp.note ? spot.opp.note : '',
    field: spot.id || 'SPOT',
    history: spot.history,
    concept: spot.concept,
    extra: spot.descriptionLine,
    street: spot.street,
    board: spot.board,
    hero: spot.hero,
    question: spot.question,
    mode
  };
}

export function canonicalToSwipeSpot(spot) {
  if (!spot) return null;
  return {
    id: spot.id,
    street: spot.street,
    pos: [spot.position, spot.villain ? `vs ${spot.villain}` : ''].filter(Boolean).join(' '),
    hero: spot.hero,
    board: spot.board,
    ctx: spot.descriptionLine,
    stack: spot.heroStack,
    pot: spot.pot,
    actions: spot.options,
    preferred: [spot.correct],
    live: spot.alsoOk,
    concept: spot.concept,
    why: spot.explain,
    format: spot.format,
    stage: spot.stage,
    _canonical: spot,
    _library: spot.source === 'library'
  };
}

export function canonicalToSizingSpot(spot) {
  if (!spot) return null;
  const pct = parseBetPct(spot.correct);
  const legacyZone = spot.sizingZone;
  let zone;
  if (spot.correct === 'ЧЕК') zone = [0, 0];
  else if (Array.isArray(legacyZone) && legacyZone.length === 2) zone = legacyZone;
  else if (pct != null) zone = [Math.max(10, pct - 18), Math.min(150, pct + 18)];
  else if (spot.questionType !== 'sizing' && !spot.options.some((o) => /СТАВКА|ЧЕК/.test(o))) {
    return { _quarantine: true, reason: 'SIZING_TARGET_MISMATCH', id: spot.id };
  } else {
    return { _quarantine: true, reason: 'SIZING_ZONE_UNKNOWN', id: spot.id };
  }

  return {
    id: spot.id,
    street: spot.street,
    ctx: spot.descriptionLine,
    hero: spot.hero,
    board: spot.board,
    pot: spot.pot != null ? spot.pot : 5,
    check: spot.correct === 'ЧЕК' ? 'g' : 'y',
    zone,
    concept: spot.concept,
    goal: deriveSizingGoal(spot),
    why: spot.explain || spot.question,
    format: spot.format,
    stage: spot.stage,
    position: spot.position,
    villain: spot.villain,
    heroStack: spot.heroStack,
    _canonical: spot,
    _library: spot.source === 'library'
  };
}

function deriveSizingGoal(spot) {
  const c = String(spot.concept || '').toLowerCase();
  if (c.includes('thin')) return 'тонкое value';
  if (c.includes('polar')) return 'поляризация';
  if (c.includes('bluff')) return 'контроль диапазона';
  if (spot.correct === 'ЧЕК') return 'контроль банка';
  if (c.includes('value')) return 'value + protection';
  return 'построить размер';
}

export function canonicalToReviewSpot(spot) {
  if (!spot) return null;
  const hist = spot.history || [];
  if (hist.length < 2) {
    return { _quarantine: true, reason: 'REVIEW_HISTORY_TOO_SHORT', id: spot.id };
  }

  const nodes = hist.map((h) => [streetAbbrev(h.street), h.text, 'g']);
  const bad = spot.reviewBadNode != null ? spot.reviewBadNode : null;

  return {
    id: spot.id,
    hero: spot.hero,
    board: spot.board,
    street: spot.street,
    nodes,
    bad,
    reasons: bad != null && spot.reviewReasons ? [...spot.reviewReasons] : [],
    correctReason: 0,
    repair: spot.reviewRepair || [0, 25, 33, 50, 75],
    best: spot.reviewBest || (parseBetPct(spot.correct) != null
      ? [parseBetPct(spot.correct) - 8, parseBetPct(spot.correct), parseBetPct(spot.correct) + 8].filter((x) => x > 0 && x <= 125)
      : [33, 50]),
    concept: spot.concept,
    why: spot.explain || spot.question,
    format: spot.format,
    _canonical: spot,
    _library: spot.source === 'library'
  };
}

export function canonicalToXraySpot(spot) {
  if (!spot) return null;
  if (!spot.xrayRef && !spot.ref) {
    return { _quarantine: true, reason: 'XRAY_NO_RANGE_DATA', id: spot.id };
  }

  const line = (spot.history || []).map((h) => h.text);
  const refs = spot.xrayRef || spot.ref;
  return {
    id: spot.id,
    title: spot.concept || spot.id,
    villain: `${spot.villain || 'СОПЕРНИК'} · ${spot.villainStack || spot.heroStack || 30} BB`,
    hero: spot.hero,
    board: spot.board,
    line: line.length ? line : [spot.descriptionLine],
    ref: refs,
    river: spot.xrayRiver || spot.river || [],
    format: spot.format,
    pot: spot.pot,
    street: spot.street,
    _canonical: spot,
    _library: spot.source === 'library'
  };
}

export function attachCanonical(spotLike) {
  if (!spotLike) return null;
  if (spotLike._canonical) return spotLike;
  const canonical = buildCanonicalSpot(spotLike);
  return { ...spotLike, _canonical: canonical };
}
