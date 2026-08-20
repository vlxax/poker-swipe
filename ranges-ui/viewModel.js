// View models for the ranges UI.

import {
  getCatalog, isSelectionComplete, situationLabel, situationsForPosition,
  stacksForSituation, openersForSituation, suggestNearby, nextCtaLabel, sanitizeSelection,
  needsOpenerForSelection, DATA_SOURCES
} from './catalog.js';
import { resolveRangeMatrix, resolveHandDetail, dataSourceMeta } from './rangeSources.js';
import { REFERENCE_DISCLAIMER, REFERENCE_USER_LABEL } from './referenceRanges.js';
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
  const catalog = getCatalog(pack, selection.format || '6max', selection.dataSource || 'verified');
  const sel = sanitizeSelection(selection, catalog);
  const complete = isSelectionComplete(sel);
  const positions = catalog.positions;
  const situations = sel.position ? situationsForPosition(catalog, sel.position) : [];
  const stacks = sel.situation ? stacksForSituation(sel.situation, sel.dataSource) : [];
  const needsOpener = needsOpenerForSelection(sel, catalog);
  const openers = needsOpener && sel.situation && sel.position
    ? openersForSituation(catalog, sel.situation, sel.position)
    : [];
  const sourceMeta = dataSourceMeta(sel.dataSource || 'verified');

  return {
    phase: 'selector',
    title: 'РЕНДЖИ',
    intro: sel.dataSource === 'reference'
      ? 'Справочные префлоп-диапазоны 6-max без привязки к стеку.'
      : 'Выбери позицию, ситуацию и стек — покажем, с какими руками играть.',
    dataSources: catalog.dataSources,
    sourceLabel: sel.dataSource === 'reference' ? REFERENCE_USER_LABEL : null,
    sourceHelp: sel.dataSource === 'reference' ? REFERENCE_DISCLAIMER : sourceMeta.help,
    formats: catalog.formats,
    situations,
    positions,
    stacks,
    openers,
    showSituation: !!sel.position,
    showStack: !!sel.situation && (!needsOpener || !!sel.opener) && stacks.length > 0,
    needsOpener: needsOpener && !!sel.situation,
    openerLabel: sel.situation === 'vs_3bet' ? '3-БЕТ ОТ' : sel.situation === 'vs_4bet' ? '4-БЕТ ОТ' : 'ОТКРЫТИЕ С',
    selection: sel,
    cta: complete ? 'ПОКАЗАТЬ РЕНДЖ' : nextCtaLabel(sel),
    ctaEnabled: complete,
    hints: selectorHints(sel, onboarding),
    showHelp,
    xrayLink: sel.dataSource !== 'reference'
  };
}

export function resultViewModel({ pack, selection, onboarding, selectedHand = null, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max', selection.dataSource || 'verified');
  const sel = sanitizeSelection(selection, catalog);
  const matrix = resolveRangeMatrix(pack, sel);

  const unsupported = !matrix.supported;
  const suggestions = unsupported ? suggestNearby(sel, catalog) : [];
  const formatLabel = sel.format === '9max' ? '9-max' : '6-max';

  const posLine = sel.position || '—';
  const stackLine = sel.stack != null ? `${sel.stack} ББ` : null;
  const sitLine = situationLabel(sel.situation, sel.dataSource);
  let contextLine = sel.dataSource === 'reference'
    ? `${formatLabel} · ${posLine}`
    : `${formatLabel} · ${posLine} · ${stackLine}`;
  if (sel.opener && sel.situation !== 'rfi') {
    contextLine = sel.dataSource === 'reference'
      ? `${posLine} · против ${sel.opener}`
      : `${posLine} · ${stackLine} · против ${sel.opener}`;
  }

  const hints = [];
  if (!onboarding.completed && !onboarding.hintsSeen.includes('hand')) {
    hints.push(HINTS[3]);
  }

  let handDetail = null;
  if (selectedHand && matrix.cells[selectedHand]) {
    handDetail = resolveHandDetail(pack, sel, selectedHand);
    if (handDetail) {
      handDetail.help = handHelpText(selectedHand);
    }
  }

  return {
    phase: unsupported ? 'unsupported' : 'result',
    title: 'РЕНДЖИ',
    contextLine,
    situationLine: sitLine,
    sourceLabel: sel.dataSource === 'reference' ? REFERENCE_USER_LABEL : null,
    sourceHelp: sel.dataSource === 'reference' ? REFERENCE_DISCLAIMER : null,
    legend: 'Зелёные руки — играем. Тёмные — пропускаем.',
    mixedLegend: true,
    cells: matrix.cells,
    unsupported,
    unsupportedMessage: sel.dataSource === 'reference'
      ? 'Для этой комбинации позиции и ситуации нет справочного диапазона в импортированном dataset.'
      : sel.format === '9max' && !['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'].includes(String(sel.position || '').toUpperCase())
        ? 'Для этой позиции в 9-max пока нет готового ренджа. Попробуй UTG, HJ, CO, BTN или SB — или выбери push/fold.'
        : 'Для этой ситуации пока нет готового ренджа.',
    suggestions,
    handDetail,
    hints,
    showHelp,
    selection: sel
  };
}

export function helpViewModel(selection = {}) {
  const ref = selection.dataSource === 'reference';
  return {
    title: 'Как читать таблицу?',
    lines: [
      'AA — карманные тузы',
      'AKs — одномастные туз-король',
      'AKo — разномастные туз-король',
      '',
      'Строки и столбцы — ранги карт. Верхний левый угол — пары, выше диагонали — одномастные, ниже — разномастные.',
      'Зелёный — играем часто, жёлтый — иногда, тёмный — не играем.',
      ...(ref ? ['', REFERENCE_DISCLAIMER] : [])
    ]
  };
}
