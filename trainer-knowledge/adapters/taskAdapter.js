// Training task library ↔ Trainer Knowledge adapter (Stage 3C).

import { canGradeWithTrainerAction } from '../status.js';
import { buildBrainTrainerResult } from './brainAdapter.js';

const RANKS = 'AKQJT98765432';

function classOf(cards = []) {
  if (!cards || cards.length < 2) return null;
  const norm = (c) => String(c).replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c');
  const a = norm(cards[0])[0];
  const b = norm(cards[1])[0];
  const ia = RANKS.indexOf(a);
  const ib = RANKS.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  if (a === b) return a + a;
  const suited = norm(cards[0]).slice(1) === norm(cards[1]).slice(1);
  return ia < ib ? `${a}${b}${suited ? 's' : 'o'}` : `${b}${a}${suited ? 's' : 'o'}`;
}

const CONCEPT_SCENARIO = [
  { re: /rfi|uo|unopened|push-fold|push fold|стил/i, sourceMode: 'uo', group: 'uo_open' },
  { re: /resteal|callpush|call vs push/i, sourceMode: 'callpush', group: 'callpush_resteal' },
  { re: /squeeze|сквиз/i, sourceMode: 'vssqueeze', group: 'vs_squeeze' },
  { re: /vs 3-bet|vs 3bet|flat vs 3/i, sourceMode: 'vs3bet', group: 'vs_3bet' },
  { re: /vs 4-bet|vs 4bet/i, sourceMode: 'vs4bet', group: 'vs_4bet' },
  { re: /bb defence|защита bb|bb defend/i, sourceMode: 'vs1rshort', group: 'bb_defence' },
  { re: /3-bet|3bet|полярн/i, sourceMode: 'vs3bet', group: 'vs_3bet' }
];

function scenarioFromTask(task) {
  const blob = `${task.concept || ''} ${(task.tags || []).join(' ')} ${task.question || ''}`.toLowerCase();
  for (const row of CONCEPT_SCENARIO) {
    if (row.re.test(blob)) return row;
  }
  if (String(task.street || '').toUpperCase() === 'ПРЕФЛОП') {
    const hist = (task.history || []).map((h) => h.text).join(' ');
    if (/сфолдил|первый в раздаче|unopened/i.test(hist)) {
      return { sourceMode: 'uo', group: 'uo_open' };
    }
    if (/открыл|3-бет|сквиз|пуш/i.test(hist)) {
      return { sourceMode: 'vs1rshort', group: 'preflop_facing' };
    }
  }
  return null;
}

const TRAINER_OPTION_MAP = {
  AI: ['ОЛЛ-ИН', 'РЕЙЗ'],
  RAISE: ['РЕЙЗ', '3-БЕТ', '4-БЕТ'],
  UNSELECTED: ['ФОЛД', 'СФОЛДИТЬ']
};

export function trainerActionToLibraryChoice(trainerAction, task) {
  if (!trainerAction) return null;
  const normalized = trainerAction === 'UNSELECTED' ? 'FOLD' : trainerAction;
  if (!canGradeWithTrainerAction(trainerAction, normalized)) return null;
  const opts = task.options || [];
  const candidates = TRAINER_OPTION_MAP[trainerAction] || TRAINER_OPTION_MAP[normalized] || [];
  for (const c of candidates) {
    if (opts.includes(c)) return c;
  }
  return null;
}

export function taskToTrainerSpot(task) {
  const preflopLine = (task.history || []).find((h) => /ПРЕФЛОП|preflop/i.test(h.street || ''))?.text || '';
  const currentLine = (task.history || []).slice(-1)[0]?.text || '';
  return {
    street: task.street || 'ПРЕФЛОП',
    pos: task.position,
    heroPosition: task.position,
    villainPosition: task.villain,
    villain: task.villain,
    hero: task.hero || [],
    stack: task.heroStack ?? task.effStack ?? null,
    effStack: task.effStack ?? task.heroStack ?? null,
    ctx: [preflopLine, currentLine, task.question].filter(Boolean).join(' · '),
    preflopLine,
    currentLine,
    openSizeBB: null,
    betSize: null
  };
}

export function auditTaskTrainerCoverage(task, lookup) {
  const street = String(task.street || '').toUpperCase();
  const miniApps = [];
  if (street === 'ПРЕФЛОП') miniApps.push('swipe', 'memory');
  else miniApps.push('sizing', 'review', 'xray');

  if (street !== 'ПРЕФЛОП') {
    return {
      taskId: task.id,
      miniApps,
      scenarioGroup: null,
      trainerStatus: 'NO_TRAINER_DATA',
      exactAnswerPossible: false,
      gradingAllowed: false,
      usableDimensions: [],
      fallback: true,
      reason: 'postflop_no_trainer_grading'
    };
  }

  const scenario = scenarioFromTask(task);
  const handClass = classOf(task.hero);
  const spot = taskToTrainerSpot(task);
  const result = buildBrainTrainerResult(lookup, spot, handClass);
  const gradingAllowed = result.status === 'EXACT_TRAINER_MATCH'
    && result.trainer?.gradingAllowed === true;
  const mappedChoice = gradingAllowed
    ? trainerActionToLibraryChoice(result.trainer?.actionRaw, task)
    : null;
  const exactAnswerPossible = gradingAllowed && mappedChoice != null
    && (mappedChoice === task.correct || (task.alsoOk || []).includes(mappedChoice));

  const usableDimensions = [];
  if (result.query?.heroPosition) usableDimensions.push('heroPosition');
  if (result.query?.stack) usableDimensions.push('stack');
  if (result.query?.opponentPosition) usableDimensions.push('opponentPosition');
  if (result.query?.betSize) usableDimensions.push('sizing');
  if (result.query?.sourceMode) usableDimensions.push('spot');
  if (handClass) usableDimensions.push('hand');

  return {
    taskId: task.id,
    concept: task.concept,
    miniApps,
    scenarioGroup: scenario?.group || result.query?.sourceMode || null,
    trainerSourceMode: result.query?.sourceMode || scenario?.sourceMode || null,
    trainerStatus: result.status,
    exactAnswerPossible,
    gradingAllowed: exactAnswerPossible,
    trainerAction: result.trainer?.actionRaw || null,
    mappedChoice,
    libraryCorrect: task.correct,
    mismatches: result.mismatches || [],
    usableDimensions,
    fallback: !exactAnswerPossible,
    blockedReason: !exactAnswerPossible
      ? (result.status !== 'EXACT_TRAINER_MATCH'
        ? result.status
        : !result.trainer?.gradingAllowed
          ? 'UNKNOWN_ACTION'
          : !mappedChoice
            ? 'ACTION_SEMANTICS_UNKNOWN'
            : 'MISMATCH_WITH_LIBRARY')
      : null
  };
}

export function auditTaskLibrary(tasks, lookup) {
  const rows = tasks.map((t) => auditTaskTrainerCoverage(t, lookup));
  const preflop = rows.filter((r) => r.miniApps.includes('swipe'));
  const trainerGraded = rows.filter((r) => r.gradingAllowed);
  const fallback = rows.filter((r) => r.fallback);
  const blocked = rows.filter((r) => r.blockedReason && r.blockedReason !== 'postflop_no_trainer_grading');

  const byGroup = {};
  for (const r of rows) {
    const g = r.scenarioGroup || 'none';
    if (!byGroup[g]) byGroup[g] = { total: 0, trainerGraded: 0, fallback: 0 };
    byGroup[g].total++;
    if (r.gradingAllowed) byGroup[g].trainerGraded++;
    else byGroup[g].fallback++;
  }

  return {
    total: rows.length,
    preflopTasks: preflop.length,
    trainerGradedTasks: trainerGraded.length,
    fallbackTasks: fallback.length,
    blockedBySemantics: blocked.filter((r) => /UNKNOWN|CLARIFICATION|PARTIAL/i.test(String(r.blockedReason))).length,
    rows,
    byGroup,
    miniAppsAudited: ['swipe', 'memory', 'sizing', 'review', 'xray'],
    miniAppsConnected: ['swipe', 'memory'],
    personalizationCompatible: true
  };
}

export function enrichBrainSpotWithTrainer(spot, task, lookup) {
  if (!spot || !task || !lookup) return spot;
  const handClass = classOf(task.hero || spot.hero);
  const result = buildBrainTrainerResult(lookup, { ...spot, ...taskToTrainerSpot(task) }, handClass);
  const audit = auditTaskTrainerCoverage(task, lookup);
  return {
    ...spot,
    trainerMeta: {
      status: result.status,
      gradingAllowed: audit.gradingAllowed,
      actionRaw: result.trainer?.actionRaw || null,
      mappedChoice: audit.mappedChoice,
      mismatches: result.mismatches || [],
      provenanceDebug: result.trainer?.provenanceDebug || null,
      useForGrading: audit.exactAnswerPossible,
      referenceOnly: !audit.exactAnswerPossible && result.status !== 'NO_TRAINER_DATA'
    }
  };
}
