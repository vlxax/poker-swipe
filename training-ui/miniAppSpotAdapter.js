// Convert validated MTT library tasks into legacy mini-app spot shapes.

import { deriveSkillTags } from '../solver/src/training/planner.js';

const STREET_ABBR = {
  'ПРЕФЛОП': 'PRE', 'ФЛОП': 'FLOP', 'ТЁРН': 'TURN', 'РИВЕР': 'RIVER',
  PRE: 'PRE', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER'
};

const OPENING_RANGE = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A5s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs',
  'JTs', 'T9s', '98s', '87s', '76s', 'AKo', 'AQo', 'AJo', 'KQo'
];

function streetAbbrev(street) {
  const k = String(street || '').toUpperCase();
  return STREET_ABBR[k] || k.slice(0, 4) || 'PRE';
}

function buildCtx(task) {
  const pos = [task.position, task.villain ? `vs ${task.villain}` : ''].filter(Boolean).join(' ');
  const line = (task.history || []).slice(-1)[0]?.text || task.question || '';
  const board = (task.board || []).join(' ');
  const parts = [pos, board, line].filter(Boolean);
  return parts.join(' · ') || task.question || task.concept || '';
}

function parseBetPct(text) {
  const m = String(text || '').match(/(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

function deriveSizeZone(task) {
  const pct = parseBetPct(task.correct);
  if (pct != null) return [Math.max(10, pct - 18), Math.min(150, pct + 18)];
  const diff = Number(task.difficulty) || 2;
  if (task.correct === 'ЧЕК') return [0, 0];
  if (String(task.street || '').includes('ФЛОП')) return [20, 45];
  if (String(task.street || '').includes('ТЁРН')) return [50, 90];
  return [25, 65];
}

function deriveGoal(task) {
  const c = String(task.concept || '').toLowerCase();
  if (c.includes('thin')) return 'тонкое value';
  if (c.includes('polar')) return 'поляризация';
  if (c.includes('bluff')) return 'контроль диапазона';
  if (c.includes('check') || task.correct === 'ЧЕК') return 'контроль банка';
  if (c.includes('value')) return 'value + protection';
  return 'построить размер';
}

function narrowRange(classes, ratio) {
  const keep = Math.max(8, Math.round(classes.length * ratio));
  return classes.slice(0, keep);
}

function buildXrayRefs(task) {
  const wide = [...OPENING_RANGE];
  return [
    wide,
    narrowRange(wide, 0.72),
    narrowRange(wide, 0.52),
    narrowRange(wide, 0.38)
  ];
}

function buildXrayRiver(task) {
  const ref = buildXrayRefs(task)[3];
  return ref.slice(0, 8).map((k, i) => [k, i % 3 === 0 ? 'B' : 'V']);
}

export function isMttTask(task) {
  const fmt = String(task?.format || 'MTT').toUpperCase();
  return fmt === 'MTT' || fmt === 'PKO' || fmt === 'SNG';
}

export function taskEligibleForMiniApp(task, appId) {
  if (!task || !isMttTask(task)) return false;
  const tags = deriveSkillTags(task);
  const hist = task.history || [];
  const street = String(task.street || '').toUpperCase();

  if (appId === 'sizing') {
    return tags.includes('betSizing')
      || /сайз|sizing|size|bet|ставк|баррел|c-bet|с-бет|value|thin|polar/i.test(`${task.concept} ${task.question}`)
      || (street !== 'ПРЕФЛОП' && (task.options || []).some((o) => /СТАВКА|ЧЕК/.test(o)));
  }
  if (appId === 'review') {
    return hist.length >= 3
      || tags.includes('postflop')
      || /line|линия|barrel|баррел|review/i.test(`${task.concept} ${(task.tags || []).join(' ')}`);
  }
  if (appId === 'xray') {
    return tags.includes('rangeReading')
      || tags.includes('bluffCatch')
      || /range|диапаз|bluff.?catch|блеф.?кетч|river/i.test(`${task.concept} ${task.question}`);
  }
  if (appId === 'swipe' || appId === 'memory') return true;
  return true;
}

export function libraryTaskToSizingSpot(task) {
  if (!task) return null;
  const zone = deriveSizeZone(task);
  return {
    id: task.id,
    street: task.street || 'ФЛОП',
    ctx: buildCtx(task),
    hero: task.hero || [],
    board: task.board || [],
    pot: task.pot != null ? task.pot : 5,
    check: task.correct === 'ЧЕК' ? 'g' : 'y',
    zone,
    concept: task.concept || 'bet sizing',
    goal: deriveGoal(task),
    why: task.explain || task.question || '',
    format: task.format || 'MTT',
    stage: task.stage || '',
    _library: true,
    _miniApp: 'sizing'
  };
}

export function libraryTaskToReviewSpot(task) {
  if (!task) return null;
  let hist = task.history || [];
  if (!hist.length) {
    hist = [{
      street: task.street || 'ФЛОП',
      text: task.question || task.correct || 'action'
    }, {
      street: task.street || 'ТЁРН',
      text: 'продолжение линии'
    }, {
      street: task.street || 'РИВЕР',
      text: task.correct || 'решение'
    }];
  }
  const nodes = hist.map((h) => [streetAbbrev(h.street), h.text, 'g']);
  const bad = nodes.length >= 4 ? 2 : Math.max(1, nodes.length - 2);
  const reasons = [
    task.explain || 'Главная ошибка в выборе размера или улицы.',
    'Линия слишком агрессивна для диапазона оппонента.',
    'Пропущено value на более безопасной улице.',
    'Проблема начинается раньше — на префлопе.'
  ];
  const repairPct = parseBetPct(task.correct) || 33;
  return {
    id: task.id,
    hero: task.hero || [],
    board: task.board || [],
    nodes,
    bad,
    reasons,
    correctReason: 0,
    repair: [0, 25, 33, 50, 75],
    best: [repairPct - 8, repairPct, repairPct + 8].filter((x) => x > 0 && x <= 125),
    concept: task.concept || 'line review',
    why: task.explain || task.question || '',
    format: task.format || 'MTT',
    _library: true,
    _miniApp: 'review'
  };
}

export function libraryTaskToXraySpot(task) {
  if (!task) return null;
  const refs = buildXrayRefs(task);
  const line = (task.history || []).map((h) => h.text);
  if (!line.length && task.question) line.push(task.question);
  return {
    id: task.id,
    title: task.concept || task.id,
    villain: `${task.villain || 'СОПЕРНИК'} · ${task.villainStack || task.heroStack || 30} BB`,
    hero: task.hero || [],
    board: task.board || [],
    line: line.length ? line : ['open', 'flop action', 'turn action', 'river action'],
    ref: refs,
    river: buildXrayRiver(task),
    format: task.format || 'MTT',
    _library: true,
    _miniApp: 'xray'
  };
}

export function libraryTaskToMiniAppSpot(task, appId) {
  if (!task || !taskEligibleForMiniApp(task, appId)) return null;
  if (appId === 'sizing') return libraryTaskToSizingSpot(task);
  if (appId === 'review') return libraryTaskToReviewSpot(task);
  if (appId === 'xray') return libraryTaskToXraySpot(task);
  return null;
}
