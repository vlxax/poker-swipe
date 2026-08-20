// View models for the ranges UI.

import {
  getCatalog, isSelectionComplete, situationLabel, situationsForPosition,
  stacksForSituation, openersForSituation, suggestNearby, nextCtaLabel, sanitizeSelection
} from './catalog.js';
import { situationNeedsOpener, evaluateCombination, REASON_TEXT } from './coverage.js';
import { buildAtlasMatrix, handDetailFromAtlas } from './preflopAtlas.js';
import { buildPushFoldMatrix, handDetailFromPush } from './pushFold.js';
import {
  SOURCE_LABELS, sourceIdFor, SOURCE_PUSHFOLD, precisionFor, PRECISION_NOTES
} from './rangeSources.js';
import { rangeStats, TOTAL_COMBOS } from './rangeValidation.js';
import { handHelpText } from './matrix.js';
import { HINTS } from './storage.js';

function selectorHints(selection, onboarding) {
  if (onboarding.completed) return [];
  if (!selection.position) return [HINTS[0]];
  if (!selection.situation) return [HINTS[1]];
  if (situationNeedsOpener(selection.situation) && !selection.opener) return [];
  if (selection.stack === null || selection.stack === undefined) return [HINTS[2]];
  return [];
}

function unavailableNote(catalog) {
  const items = catalog.unavailable || [];
  if (!items.length) return null;
  return items.map((item) => item.text).join('; ');
}

function stackLabelFor(stacks, value) {
  const hit = stacks.find((s) => s.id === Number(value));
  return hit ? hit.label : `${value} ББ`;
}

export function selectorViewModel({ pack, selection, onboarding, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max');
  const sel = sanitizeSelection(selection, catalog);
  const complete = isSelectionComplete(sel);
  const situations = sel.position ? situationsForPosition(catalog, sel.position) : [];
  const needsOpener = situationNeedsOpener(sel.situation);
  const openers = needsOpener && sel.position
    ? openersForSituation(catalog, sel.situation, sel.position)
    : [];
  const stacks = sel.situation && (!needsOpener || sel.opener)
    ? stacksForSituation(catalog, sel.situation, sel.position, sel.opener)
    : [];

  return {
    phase: 'selector',
    title: 'РЕНДЖИ',
    intro: 'Выбери позицию, ситуацию и стек — покажем, с какими руками играть.',
    formats: catalog.availableFormats,
    positions: catalog.availablePositions,
    situations,
    openers,
    stacks,
    showSituation: !!sel.position,
    needsOpener: needsOpener && !!sel.situation,
    showStack: !!sel.situation && (!needsOpener || !!sel.opener),
    selection: sel,
    cta: complete ? 'ПОКАЗАТЬ РЕНДЖ' : nextCtaLabel(sel),
    ctaEnabled: complete,
    hints: selectorHints(sel, onboarding),
    unavailableNote: unavailableNote(catalog),
    showHelp,
    xrayLink: true
  };
}

export function resultViewModel({ pack, selection, onboarding, selectedHand = null, showHelp = false }) {
  const catalog = getCatalog(pack, selection.format || '6max');
  const sel = sanitizeSelection(selection, catalog);
  const evaluation = evaluateCombination(pack, sel);
  const isPush = sel.situation === 'push_fold';

  const matrix = isPush ? buildPushFoldMatrix(sel) : buildAtlasMatrix(pack, sel);
  const unsupported = !evaluation.available || !matrix.supported;

  const stacks = stacksForSituation(catalog, sel.situation, sel.position, sel.opener);
  const formatLabel = sel.format === '9max' ? '9-max' : '6-max';
  const stackLine = sel.stack === null ? '—' : stackLabelFor(stacks, sel.stack);
  let contextLine = `${formatLabel} · ${sel.position || '—'} · ${stackLine}`;
  if (sel.opener) contextLine += ` · против ${sel.opener}`;

  const stats = unsupported ? null : rangeStats(matrix.cells);
  const sourceId = sourceIdFor(sel.situation, sel.position);
  const sourceLabel = SOURCE_LABELS[sourceId] || null;
  const precision = precisionFor(sourceId);

  const hints = [];
  if (!onboarding.completed && !onboarding.hintsSeen.includes('hand')) {
    hints.push(HINTS[3]);
  }

  let handDetail = null;
  if (!unsupported && selectedHand && matrix.cells[selectedHand]) {
    handDetail = isPush
      ? handDetailFromPush(sel, selectedHand)
      : handDetailFromAtlas(pack, sel, selectedHand);
    if (handDetail) handDetail.help = handHelpText(selectedHand);
  }

  return {
    phase: unsupported ? 'unsupported' : 'result',
    title: 'РЕНДЖИ',
    contextLine,
    situationLine: situationLabel(sel.situation),
    legend: 'Зелёные руки — играем. Тёмные — пропускаем.',
    mixedLegend: true,
    cells: matrix.cells,
    stats,
    statsLine: stats
      ? `Играем ${stats.playPct}% комбинаций (${Math.round(stats.playCombos)} из ${TOTAL_COMBOS})`
      : null,
    sourceLabel,
    precision,
    precisionNote: unsupported ? null : (PRECISION_NOTES[precision] || null),
    sourceNote: sourceId === SOURCE_PUSHFOLD
      ? 'Отдельная короткостековая модель, не смешивается с deep-stack ренджами.'
      : null,
    unsupported,
    unsupportedMessage: unsupported
      ? `Рендж недоступен: ${REASON_TEXT[evaluation.reason] || 'нет точных данных'}.`
      : null,
    suggestions: unsupported ? suggestNearby(sel, catalog) : [],
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
