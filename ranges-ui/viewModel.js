// View models for the ranges UI.

import {
  getCatalog, isSelectionComplete, situationLabel, situationsForPosition,
  stacksForSituation, openersForSituation, suggestNearby, nextCtaLabel, sanitizeSelection,
  needsOpenerForSelection
} from './catalog.js';
import { resolveRangeMatrix, resolveHandDetail } from './rangeSources.js';
import { REFERENCE_DISCLAIMER, REFERENCE_USER_LABEL } from './referenceRanges.js';
import { legendActionsFromCells } from './matrix.js';
import { HINTS } from './storage.js';

function selectorHints(selection, onboarding, needsOpener, openers) {
  if (onboarding.completed) return [];
  if (!selection.position) return [HINTS[0]];
  if (!selection.situation) return [HINTS[1]];
  if (needsOpener && !selection.opener) {
    if (openers.length) return [HINTS[2]];
    return [];
  }
  if (selection.dataSource !== 'reference' && !selection.stack) return [];
  return [];
}

function buildReferenceContextLine(sel) {
  const formatLabel = '6-max';
  const pos = sel.position || '—';
  const sit = sel.situation;

  if (sit === 'rfi') {
    return `${formatLabel} · ${pos} · ${situationLabel('rfi', 'reference')}`;
  }
  if (sit === 'vs_open' && sel.opener) {
    return `${formatLabel} · ${pos} против открытия ${sel.opener}`;
  }
  if (sit === 'vs_3bet' && sel.opener) {
    return `${formatLabel} · ${pos} против 3-бета ${sel.opener}`;
  }
  if (sit === 'vs_4bet' && sel.opener) {
    return `${formatLabel} · ${pos} против 4-бета ${sel.opener}`;
  }
  return `${formatLabel} · ${pos}`;
}

function buildLegendItems(cells, selection) {
  const seen = legendActionsFromCells(cells);
  const raiseLabel = selection.situation === 'rfi' ? 'Открываем' : 'Рейз';
  const items = [];
  if (seen.RAISE) items.push({ key: 'raise', label: raiseLabel, className: 'raise' });
  if (seen.CALL) items.push({ key: 'call', label: 'Колл', className: 'call' });
  if (seen.FOLD) items.push({ key: 'fold', label: 'Фолд', className: 'fold' });
  if (seen.MIXED) items.push({ key: 'mixed', label: 'Смешанная стратегия', className: 'mixed' });
  return items;
}

export function selectorViewModel({ pack, selection, onboarding, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max', selection.dataSource || 'reference');
  const sel = sanitizeSelection(selection, catalog);
  const complete = isSelectionComplete(sel);
  const positions = catalog.positions.filter((pos) => situationsForPosition(catalog, pos).length > 0);
  const situations = sel.position ? situationsForPosition(catalog, sel.position) : [];
  const stacks = sel.situation ? stacksForSituation(sel.situation, sel.dataSource) : [];
  const needsOpener = needsOpenerForSelection(sel, catalog);
  const openers = needsOpener && sel.situation && sel.position
    ? openersForSituation(catalog, sel.situation, sel.position)
    : [];

  return {
    phase: 'selector',
    title: 'РЕНДЖИ',
    intro: sel.dataSource === 'reference'
      ? 'Выбери позицию и ситуацию — покажем справочный префлоп-диапазон без привязки к стеку.'
      : 'Выбери позицию, ситуацию и стек — покажем, с какими руками играть.',
    dataSources: catalog.dataSources,
    sourceLabel: sel.dataSource === 'reference' ? REFERENCE_USER_LABEL : null,
    formats: catalog.formats,
    showFormat: catalog.formats.length > 1,
    situations,
    positions,
    stacks,
    openers,
    showSituation: !!sel.position,
    showStack: !!sel.situation && (!needsOpener || !!sel.opener) && stacks.length > 0,
    needsOpener: needsOpener && !!sel.situation && openers.length > 0,
    openerLabel: sel.situation === 'vs_3bet' ? '3-БЕТ ОТ' : sel.situation === 'vs_4bet' ? '4-БЕТ ОТ' : 'ОТКРЫТИЕ С',
    selection: sel,
    cta: complete ? 'ПОКАЗАТЬ РЕНДЖ' : nextCtaLabel(sel),
    ctaEnabled: complete,
    hints: selectorHints(sel, onboarding, needsOpener, openers),
    showHelp,
    xrayLink: sel.dataSource !== 'reference'
  };
}

export function resultViewModel({ pack, selection, onboarding, selectedHand = null, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max', selection.dataSource || 'reference');
  const sel = sanitizeSelection(selection, catalog);
  const matrix = resolveRangeMatrix(pack, sel);

  const unsupported = !matrix.supported;
  const suggestions = unsupported ? suggestNearby(sel, catalog) : [];
  const isReference = sel.dataSource === 'reference';

  const posLine = sel.position || '—';
  const stackLine = sel.stack != null ? `${sel.stack} ББ` : null;
  const sitLine = situationLabel(sel.situation, sel.dataSource);
  let contextLine = isReference
    ? buildReferenceContextLine(sel)
    : `${sel.format === '9max' ? '9-max' : '6-max'} · ${posLine}${stackLine ? ` · ${stackLine}` : ''}`;
  if (!isReference && sel.opener && sel.situation !== 'rfi') {
    contextLine = `${posLine} · ${stackLine} · против ${sel.opener}`;
  }

  const hints = [];
  if (!onboarding.completed && !onboarding.hintsSeen.includes('hand')) {
    hints.push(HINTS[3]);
  }

  let handDetail = null;
  if (selectedHand && matrix.cells[selectedHand]) {
    handDetail = resolveHandDetail(pack, sel, selectedHand);
    if (handDetail) {
      handDetail.help = null;
    }
  }

  const legendItems = buildLegendItems(matrix.cells, sel);

  return {
    phase: unsupported ? 'unsupported' : 'result',
    title: 'РЕНДЖИ',
    headline: isReference ? REFERENCE_USER_LABEL : 'РЕНДЖ',
    contextLine,
    situationLine: sitLine,
    subtitle: isReference ? 'Справочный префлоп-диапазон без привязки к глубине стека.' : null,
    sourceLabel: isReference ? REFERENCE_USER_LABEL : null,
    sourceHelp: isReference ? REFERENCE_DISCLAIMER : null,
    legendItems,
    cells: matrix.cells,
    unsupported,
    unsupportedMessage: isReference
      ? 'Не удалось загрузить справочный диапазон. Попробуй выбрать другую комбинацию или вернись к выбору.'
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
      'Цветные полосы в клетке показывают долю рейза, колла и фолда. Если видно несколько цветов — это смешанная стратегия.',
      ...(ref ? [
        '',
        'Диапазон взят из справочного набора Greenline. Это базовая стратегия без привязки к конкретной глубине стека и не solver-верифицированное решение конкретного турнирного спота.'
      ] : [])
    ]
  };
}
