// View models for the ranges UI.

import {
  getCatalog, isSelectionComplete, situationLabel, positionsForSituation,
  stacksForSituation, openersForSituation, suggestNearby
} from './catalog.js';
import { buildAtlasMatrix, handDetailFromAtlas } from './preflopAtlas.js';
import { buildPushFoldMatrix, handDetailFromPush } from './pushFold.js';
import { handHelpText } from './matrix.js';
import { HINTS } from './storage.js';

export function selectorViewModel({ pack, selection, onboarding, showHelp = false }) {
  const catalog = getCatalog(pack);
  const sit = selection.situation;
  const complete = isSelectionComplete(selection);
  const positions = sit ? positionsForSituation(catalog, sit) : [];
  const stacks = sit ? stacksForSituation(sit) : [];
  const openers = sit && (sit === 'vs_open' || sit === 'bb_defend')
    ? openersForSituation(catalog, sit, selection.position || 'BB')
    : [];

  const hints = [];
  if (!onboarding.completed) {
    if (!selection.position && !selection.situation) {
      hints.push(HINTS[0]);
    } else if (!selection.position && positions.length) {
      hints.push(HINTS[0]);
    } else if (!selection.stack) {
      hints.push(HINTS[1]);
    }
  }

  return {
    phase: 'selector',
    title: 'РЕНДЖИ',
    intro: 'Выбери ситуацию — покажем, с какими руками играть.',
    formats: catalog.formats,
    situations: catalog.situations,
    positions,
    stacks,
    openers,
    needsOpener: sit === 'vs_open' || sit === 'bb_defend',
    selection,
    cta: complete ? 'ПОКАЗАТЬ РЕНДЖ' : 'ВЫБЕРИ СИТУАЦИЮ',
    ctaEnabled: complete,
    hints,
    showHelp,
    xrayLink: true
  };
}

export function resultViewModel({ pack, selection, onboarding, selectedHand = null, showHelp = false }) {
  const catalog = getCatalog(pack);
  let matrix;
  if (selection.situation === 'push_fold') {
    matrix = buildPushFoldMatrix(selection);
  } else {
    matrix = buildAtlasMatrix(pack, selection);
  }

  const unsupported = !matrix.supported;
  const suggestions = unsupported ? suggestNearby(selection, catalog) : [];

  const posLine = selection.position || '—';
  const stackLine = `${selection.stack} ББ`;
  const sitLine = situationLabel(selection.situation);
  let contextLine = `${posLine} · ${stackLine}`;
  if (selection.opener && selection.situation !== 'rfi') {
    contextLine = `${posLine} · ${stackLine} · против ${selection.opener}`;
  }

  const hints = [];
  if (!onboarding.completed && !onboarding.hintsSeen.includes('hand')) {
    hints.push(HINTS[2]);
  }

  let handDetail = null;
  if (selectedHand && matrix.cells[selectedHand]) {
    handDetail = selection.situation === 'push_fold'
      ? handDetailFromPush(selection, selectedHand)
      : handDetailFromAtlas(pack, selection, selectedHand);
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
    unsupportedMessage: 'Для этой ситуации пока нет готового ренджа.',
    suggestions,
    handDetail,
    hints,
    showHelp,
    selection
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
