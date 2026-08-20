// View models for the ranges UI.

import {
  getCatalog, isSelectionComplete, situationLabel, situationsForPosition,
  stacksForSituation, openersForSituation, suggestNearby, nextCtaLabel, sanitizeSelection
} from './catalog.js';
import { buildAtlasMatrix, handDetailFromAtlas } from './preflopAtlas.js';
import { buildPushFoldMatrix, handDetailFromPush } from './pushFold.js';
import { handHelpText } from './matrix.js';
import { HINTS } from './storage.js';

function selectorHints(selection, onboarding) {
  if (onboarding.completed) return [];
  if (!selection.position) return [HINTS[0]];
  if (!selection.situation) return [HINTS[1]];
  const sit = selection.situation;
  const needsOpener = sit === 'vs_open' || sit === 'bb_defend';
  if (needsOpener && !selection.opener) return [];
  if (!selection.stack) return [HINTS[2]];
  return [];
}

export function selectorViewModel({ pack, selection, onboarding, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max');
  const sel = sanitizeSelection(selection, catalog, pack);
  const complete = isSelectionComplete(sel);
  const positions = catalog.positions;
  const situations = sel.position ? situationsForPosition(catalog, sel.position) : [];
  const stacks = sel.situation
    ? stacksForSituation(sel.situation, catalog, sel, pack)
    : [];
  const needsOpener = sel.situation === 'vs_open' || sel.situation === 'bb_defend';
  const openers = needsOpener && sel.situation && sel.position
    ? openersForSituation(catalog, sel.situation, sel.position)
    : [];

  return {
    phase: 'selector',
    title: 'РЕНДЖИ',
    intro: 'Выбери позицию, ситуацию и стек — покажем, с какими руками играть.',
    formats: catalog.formats,
    situations,
    positions,
    stacks,
    openers,
    showSituation: !!sel.position,
    showStack: !!sel.situation && (!needsOpener || !!sel.opener),
    needsOpener: needsOpener && !!sel.situation,
    selection: sel,
    cta: complete ? 'ПОКАЗАТЬ РЕНДЖ' : nextCtaLabel(sel),
    ctaEnabled: complete,
    hints: selectorHints(sel, onboarding),
    showHelp,
    xrayLink: true
  };
}

export function resultViewModel({ pack, selection, onboarding, selectedHand = null, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max');
  const sel = sanitizeSelection(selection, catalog, pack);
  let matrix;
  if (sel.situation === 'push_fold') {
    matrix = buildPushFoldMatrix(sel);
  } else {
    matrix = buildAtlasMatrix(pack, sel);
  }

  const unsupported = !matrix.supported;
  const suggestions = unsupported ? suggestNearby(sel, catalog) : [];
  const formatLabel = sel.format === '9max' ? '9-max' : '6-max';

  const posLine = sel.position || '—';
  const stackLine = `${sel.stack} ББ`;
  const sitLine = situationLabel(sel.situation);
  let contextLine = `${formatLabel} · ${posLine} · ${stackLine}`;
  if (sel.opener && sel.situation !== 'rfi') {
    contextLine = `${posLine} · ${stackLine} · против ${sel.opener}`;
  }

  const hints = [];
  if (!onboarding.completed && !onboarding.hintsSeen.includes('hand')) {
    hints.push(HINTS[3]);
  }

  let handDetail = null;
  if (selectedHand && matrix.cells[selectedHand]) {
    handDetail = sel.situation === 'push_fold'
      ? handDetailFromPush(sel, selectedHand)
      : handDetailFromAtlas(pack, sel, selectedHand);
    if (handDetail) {
      handDetail.help = handHelpText(selectedHand);
    }
  }

  return {
    phase: unsupported ? 'unsupported' : 'result',
    title: 'РЕНДЖИ',
    contextLine,
    situationLine: sitLine,
    legend: 'Зелёные руки — играем. Тёмные — пропускаем.',
    mixedLegend: true,
    cells: matrix.cells,
    unsupported,
    unsupportedMessage: 'Для этой комбинации не удалось загрузить рендж. Попробуй изменить параметры.',
    suggestions,
    handDetail,
    hints,
    showHelp,
    selection: sel
  };
}

export function helpViewModel() {
  return {
    title: 'Как читать таблицу?',
    lines: [
      'AA — карманные тузы',
      'AKs — одномастные туз-король',
      'AKo — разномастные туз-король',
      '',
      'Строки и столбцы — ранги карт. Верхний левый угол — пары, выше диагонали — одномастные, ниже — разномастные.',
      'Зелёный — играем часто, жёлтый — иногда, тёмный — не играем.'
    ]
  };
}
