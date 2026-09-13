// Generate trainer-native preflop task candidates from built chart data.

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { buildCanonicalSpot } from '../task-context/canonicalSpot.js';
import { buildTrainerQueryFromCanonical } from './canonicalTrainerQuery.js';
import { listCharts, lookupTrainerHandAction, getTrainerChartHands } from './lookup.js';
import { canGradeWithTrainerAction } from './status.js';
import { applySemanticsToCell, chartHasAiAction } from './semanticLegend.js';
import { trainerActionToLibraryChoice } from './adapters/taskAdapter.js';
import { legalPreflopUserOptions } from './legalPreflopUserOptions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILT_DIR = join(__dirname, '..', 'data/trainer/built');

const RANKS = 'AKQJT98765432';
const SUITS = ['♠', '♥', '♦', '♣'];

let _shardIndex = null;
let _shardCache = new Map();

function loadShardIndex() {
  if (_shardIndex) return _shardIndex;
  const path = join(BUILT_DIR, 'batch2-shard-index.json');
  if (!existsSync(path)) return null;
  _shardIndex = JSON.parse(readFileSync(path, 'utf8'));
  return _shardIndex;
}

function loadChartHands(chartId) {
  const index = loadShardIndex();
  if (!index?.chartToShard) return null;
  const shardId = index.chartToShard[chartId];
  if (!shardId) return null;
  if (!_shardCache.has(shardId)) {
    const shardPath = join(BUILT_DIR, 'batch2-shards', `${shardId}.json`);
    if (!existsSync(shardPath)) return null;
    const shard = JSON.parse(readFileSync(shardPath, 'utf8'));
    _shardCache.set(shardId, shard.charts || {});
  }
  const compact = _shardCache.get(shardId)[chartId];
  if (!compact?.h) return null;
  return compact.h;
}

function loadUoHandsForChart(chartId) {
  const path = join(BUILT_DIR, 'uo-hand-records.json');
  if (!existsSync(path)) return [];
  const all = JSON.parse(readFileSync(path, 'utf8'));
  return all.filter((r) => r.chartId === chartId);
}

export function handClassToRepresentativeCards(handClass) {
  const hc = String(handClass || '').trim();
  if (!hc || hc.length < 2) return ['A♠', 'K♦'];
  if (hc.length === 2) {
    const r = hc[0];
    return [`${r}♠`, `${r}♥`];
  }
  const r1 = hc[0];
  const r2 = hc[1];
  const suited = hc[2] === 's';
  return suited ? [`${r1}♠`, `${r2}♠`] : [`${r1}♠`, `${r2}♥`];
}

const TRAINER_OPTIONS_BY_ACTION = {
  AI: ['ОЛЛ-ИН', 'РЕЙЗ'],
  RAISE: ['РЕЙЗ', '3-БЕТ', '4-БЕТ'],
  UNSELECTED: ['ФОЛД'],
  FOLD: ['ФОЛД']
};

function optionsForTrainerAction(actionRaw, normalizedAction, sourceMode, correctChoice) {
  const pseudoOpts = ['ФОЛД', 'КОЛЛ', 'РЕЙЗ', '3-БЕТ', '4-БЕТ', 'ОЛЛ-ИН'];
  const correct = correctChoice
    || correctChoiceForTrainer(actionRaw, normalizedAction, pseudoOpts)
    || (normalizedAction === 'FOLD' ? 'ФОЛД' : normalizedAction === 'CALL' ? 'КОЛЛ' : 'РЕЙЗ');
  let legal = legalPreflopUserOptions(sourceMode, correct);
  if (legal.includes('3-БЕТ') && legal.includes('РЕЙЗ') && correct !== 'РЕЙЗ') {
    legal = legal.filter((o) => o !== 'РЕЙЗ');
  }
  if (legal.includes('4-БЕТ') && legal.includes('РЕЙЗ') && correct !== 'РЕЙЗ') {
    legal = legal.filter((o) => o !== 'РЕЙЗ');
  }
  if (!legal.includes(correct)) legal.unshift(correct);
  return [...new Set(legal)];
}

function correctChoiceForTrainer(actionRaw, normalizedAction, options) {
  const pseudoTask = { options };
  return trainerActionToLibraryChoice(actionRaw, pseudoTask)
    || (normalizedAction === 'FOLD' ? 'ФОЛД' : normalizedAction === 'CALL' ? 'КОЛЛ' : options.find((o) => /РЕЙЗ|ОЛЛ/i.test(o)) || options[0]);
}

function heroPositionFromChart(chart) {
  const raw = chart.heroPosition?.raw || chart.heroPosition?.values?.[0];
  if (!raw) return null;
  const pos = String(raw).split('-')[0];
  if (pos === 'Any_position' || pos === 'ANY_POSITION') return null;
  return pos;
}

function villainPositionFromChart(chart) {
  const raw = chart.opponentPosition?.raw || chart.opponentPosition?.values?.[0];
  if (!raw) {
    if (chart.sourceMode === 'uo' || chart.sourceMode === 'huante') return 'BB';
    return null;
  }
  const parts = String(raw).split('-');
  const pos = parts[parts.length - 1];
  if (pos === 'UO') return 'BB';
  return pos;
}

function stackBbFromChart(chart) {
  const sem = chart.stack?.semantics || chart.stack;
  if (sem?.bb != null) return sem.bb;
  if (sem?.minBb != null && sem?.maxBb != null) return Math.round((sem.minBb + sem.maxBb) / 2);
  const m = String(chart.stack?.raw || '').match(/(\d+(?:\.\d+)?)\s*BB/i);
  return m ? parseFloat(m[1]) : 30;
}

function buildHistoryForChart(chart) {
  const hero = heroPositionFromChart(chart);
  const villain = villainPositionFromChart(chart);
  const mode = chart.sourceMode;
  const open = chart.betSize?.raw || chart.openSize?.raw || '';
  if (mode === 'uo') {
    return [{ street: 'ПРЕФЛОП', text: hero ? `${hero} · до тебя все сфолдили.` : 'До тебя все сфолдили.' }];
  }
  if (mode === 'vs1rshort' && hero === 'BB') {
    return [{ street: 'ПРЕФЛОП', text: `${hero} vs ${villain || 'BTN'} · ${villain || 'BTN'} открыл ${open || '2.2'}` }];
  }
  if (mode === 'callpush') {
    return [{ street: 'ПРЕФЛОП', text: `${hero || 'BB'} vs ${villain || 'CO'} · ${villain || 'CO'} запушил` }];
  }
  if (mode === 'sbvsbb') {
    return [{ street: 'ПРЕФЛОП', text: `${hero || 'SB'} vs ${villain || 'BB'} · блайнды` }];
  }
  if (hero && villain) {
    return [{ street: 'ПРЕФЛОП', text: `${hero} vs ${villain} · ${villain} открыл ${open || '2.2'}` }];
  }
  if (villain) {
    return [{ street: 'ПРЕФЛОП', text: `${hero ? `${hero} vs ${villain} · ` : ''}${villain} открыл ${open || '2.2'}` }];
  }
  return [{ street: 'ПРЕФЛОП', text: hero ? `${hero} · префлоп-спот` : 'Префлоп-спот из тренерской базы.' }];
}

function conceptForSourceMode(mode) {
  const map = {
    uo: 'rfi',
    vs1r: 'vs open',
    vs1rshort: 'bb defence',
    vs1r1c: 'vs open + caller',
    vs2r: 'vs 2 raises',
    vs3bet: 'vs 3-bet',
    vs4bet: 'vs 4-bet',
    vssqueeze: 'squeeze',
    vslimp: 'vs limp',
    callpush: 'call vs push',
    sbvsbb: 'sb vs bb',
    huante: 'hu ante'
  };
  return map[mode] || `trainer_${mode}`;
}

export function buildTrainerNativeTask({ chart, hand, handRec, lookup }) {
  if (!chart || !hand) return null;
  const contextual = handRec.contextualAction || null;
  const normalized = handRec.normalizedAction
    || (handRec.actionRaw === 'UNSELECTED' ? 'FOLD' : handRec.actionRaw);
  const callLike = normalized === 'CALL' || contextual === 'NON_ALL_IN_CALL'
    || (handRec.actionRaw === 'ORANGE_208_160_32' && normalized === 'CALL');
  const mixedOk = Boolean(handRec.isMixed) && callLike
    && Array.isArray(handRec.strategies)
    && handRec.strategies.some((s) => s.normalizedAction === 'CALL' || s.contextualAction === 'NON_ALL_IN_CALL');
  if (!handRec.gradingAllowed && !callLike && !mixedOk) return null;
  if (handRec.isMixed && !mixedOk) return null;
  if (!canGradeWithTrainerAction(handRec.actionRaw, normalized, contextual) && !callLike) {
    return null;
  }

  const heroPos = heroPositionFromChart(chart);
  const villainPos = villainPositionFromChart(chart);
  const stackBb = stackBbFromChart(chart);
  const history = buildHistoryForChart(chart);
  const pseudoOpts = ['ФОЛД', 'КОЛЛ', 'РЕЙЗ', '3-БЕТ', '4-БЕТ', 'ОЛЛ-ИН'];
  const correct = correctChoiceForTrainer(handRec.actionRaw, handRec.normalizedAction, pseudoOpts);
  const options = optionsForTrainerAction(handRec.actionRaw, handRec.normalizedAction, chart.sourceMode, correct);
  if (!correct || options.length < 2) return null;

  const task = {
    id: `TRAINER_${chart.id}_${hand}`,
    _trainerNative: true,
    _library: false,
    street: 'ПРЕФЛОП',
    position: heroPos,
    villain: villainPos,
    hero: handClassToRepresentativeCards(hand),
    board: [],
    heroStack: stackBb,
    villainStack: stackBb,
    effStack: stackBb,
    pot: 1.5,
    history,
    options,
    correct,
    alsoOk: [],
    concept: conceptForSourceMode(chart.sourceMode),
    question: 'Твоё решение?',
    explain: `В тренерском рендже для этого спота рука ${hand} = ${handRec.normalizedAction || handRec.actionRaw}.`,
    trainerMeta: {
      chartId: chart.id,
      sourceMode: chart.sourceMode,
      rawSpot: chart.spot?.rawSpot || null,
      trainerCanonicalId: chart.spot?.trainerCanonicalId || null,
      hand,
      actionRaw: handRec.actionRaw,
      normalizedAction: handRec.normalizedAction || (handRec.actionRaw === 'UNSELECTED' ? 'FOLD' : handRec.actionRaw),
      contextualAction: handRec.contextualAction || null,
      gradingAllowed: true,
      provenance: handRec.provenance || chart.provenance,
      gradingSource: 'TRAINER_EXACT'
    }
  };

  const canonical = buildCanonicalSpot(task);
  const built = buildTrainerQueryFromCanonical(canonical, hand);
  if (!built.complete) return null;

  const verify = lookupTrainerHandAction({ ...built.query, hand, chartId: chart.id });
  if (verify.status !== 'EXACT_TRAINER_MATCH' || !verify.gradingAllowed) return null;
  if (verify.action !== handRec.actionRaw) return null;

  task._canonical = canonical;
  return task;
}

export function countCanonicalTrainerCallCells() {
  const builtCharts = listCharts();
  let callCells = 0;
  let callCharts = 0;
  const invalid = { missingContext: 0, mixedBlocked: 0 };
  for (const chart of builtCharts) {
    const packed = getTrainerChartHands(chart.id);
    if (!packed?.hands) continue;
    const hasAI = chartHasAiAction(packed);
    let chartCall = 0;
    for (const cell of Object.values(packed.hands)) {
      const sem = applySemanticsToCell(cell, chart.legendScheme || null, {
        sourceMode: chart.sourceMode,
        chartHasAI: hasAI
      });
      if (sem.isMixed && (sem.normalizedAction === 'CALL' || cell.actionRaw === 'nAI')) invalid.mixedBlocked++;
      const callLike = !sem.isMixed && sem.gradingAllowed && (
        sem.normalizedAction === 'CALL' || sem.contextualAction === 'NON_ALL_IN_CALL'
      );
      if (callLike) {
        callCells++;
        chartCall++;
      }
    }
    if (chartCall) callCharts++;
  }
  return {
    totalCharts: builtCharts.length,
    callCharts,
    callCells,
    invalid
  };
}

export function listTrainerGradableCells({ maxCharts = Infinity, maxPerChart = 8, reserveCall = 2 } = {}) {
  const builtCharts = listCharts();
  const candidates = [];
  const actionCounts = { FOLD: 0, CALL: 0, RAISE: 0, 'ALL-IN': 0, OTHER: 0 };
  const modeCounts = {};
  let chartsScanned = 0;
  let invalidCandidates = 0;
  let disabledCandidates = 0;
  const callChartIds = new Set();

  const sorted = [...builtCharts].sort((a, b) =>
    (b.parseStats?.gradingAllowedCells || 0) - (a.parseStats?.gradingAllowedCells || 0)
  );

  for (const chart of sorted) {
    if (chartsScanned >= maxCharts) break;
    chartsScanned++;

    let hands = [];
    if (chart.sourceGroup === 'UO' || chart.sourceMode === 'uo') {
      hands = loadUoHandsForChart(chart.id).filter((h) => h.gradingAllowed || h.normalizedAction === 'CALL');
    } else {
      const packed = getTrainerChartHands(chart.id);
      if (packed?.hands) {
        const hasAI = chartHasAiAction(packed);
        hands = Object.entries(packed.hands).map(([hand, cell]) => {
          const sem = applySemanticsToCell(cell, chart.legendScheme || null, {
            sourceMode: chart.sourceMode,
            chartHasAI: hasAI
          });
          return {
            hand,
            actionRaw: sem.actionRaw ?? cell.actionRaw,
            normalizedAction: sem.normalizedAction
              || (cell.actionRaw === 'UNSELECTED' ? 'FOLD' : cell.actionRaw),
            contextualAction: sem.contextualAction || null,
            gradingAllowed: Boolean(sem.gradingAllowed),
            isMixed: Boolean(sem.isMixed),
            provenance: sem.provenance || chart.provenance
          };
        }).filter((h) => {
          if (h.isMixed) {
            disabledCandidates++;
            return false;
          }
          const callLike = h.normalizedAction === 'CALL' || h.contextualAction === 'NON_ALL_IN_CALL';
          if (!h.gradingAllowed && !callLike) return false;
          if (!canGradeWithTrainerAction(h.actionRaw, h.normalizedAction, h.contextualAction) && !callLike) {
            return false;
          }
          return true;
        });
      }
    }

    hands.sort((a, b) => {
      const ac = a.normalizedAction === 'CALL' ? 1 : 0;
      const bc = b.normalizedAction === 'CALL' ? 1 : 0;
      return bc - ac;
    });

    let added = 0;
    let addedCall = 0;
    for (const handRec of hands) {
      if (added >= maxPerChart) break;
      const isCall = handRec.normalizedAction === 'CALL' || handRec.contextualAction === 'NON_ALL_IN_CALL';
      if (!isCall && addedCall < reserveCall && added >= maxPerChart - (reserveCall - addedCall)) {
        continue;
      }
      const task = buildTrainerNativeTask({ chart, hand: handRec.hand, handRec, lookup: null });
      if (!task) {
        invalidCandidates++;
        continue;
      }
      candidates.push(task);
      added++;
      if (task.trainerMeta.normalizedAction === 'CALL') {
        addedCall++;
        callChartIds.add(chart.id);
      }
      modeCounts[chart.sourceMode] = (modeCounts[chart.sourceMode] || 0) + 1;
      const act = task.trainerMeta.normalizedAction;
      if (act === 'FOLD') actionCounts.FOLD++;
      else if (act === 'CALL') actionCounts.CALL++;
      else if (act === 'ALL_IN' || task.trainerMeta.actionRaw === 'AI') actionCounts['ALL-IN']++;
      else if (act === 'RAISE' || task.trainerMeta.actionRaw === 'RAISE') actionCounts.RAISE++;
      else actionCounts.OTHER++;
    }
  }

  return {
    candidates,
    actionCounts,
    modeCounts,
    totalCharts: builtCharts.length,
    chartsScanned,
    invalidCandidates,
    disabledCandidates,
    callChartsInIndex: callChartIds.size
  };
}
