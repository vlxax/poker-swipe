// Training task library ↔ Trainer Knowledge adapter (Stage 3C).

import { canGradeWithTrainerAction } from '../status.js';
import { buildBrainTrainerResult } from './brainAdapter.js';
import { buildCanonicalSpot } from '../../task-context/canonicalSpot.js';
import { buildTrainerQueryFromCanonical } from '../canonicalTrainerQuery.js';

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

function scenarioFromCanonical(task) {
  const canonical = buildCanonicalSpot({ ...task, _legacy: !task._library });
  const built = buildTrainerQueryFromCanonical(canonical, classOf(task.hero));
  if (!built.preflop?.sourceMode) return null;
  const groupMap = {
    uo: 'uo_open',
    vs1rshort: 'bb_defence',
    vs1r: 'preflop_facing',
    vs3bet: 'vs_3bet',
    vs4bet: 'vs_4bet',
    vssqueeze: 'vs_squeeze',
    callpush: 'callpush_resteal',
    sbvsbb: 'sb_vs_bb',
    huante: 'hu_ante',
    vslimp: 'vs_limp',
    vs1r1c: 'preflop_facing',
    vs2r: 'preflop_facing'
  };
  return {
    sourceMode: built.preflop.sourceMode,
    group: groupMap[built.preflop.sourceMode] || built.preflop.sourceMode
  };
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

  const scenario = scenarioFromCanonical(task);
  const handClass = classOf(task.hero);
  const canonical = buildCanonicalSpot({ ...task, _legacy: !task._library });
  const built = buildTrainerQueryFromCanonical(canonical, handClass);
  const spot = {
    ...taskToTrainerSpot(task),
    _canonical: canonical,
    position: canonical.position,
    villain: canonical.villain,
    history: canonical.history,
    preflopLine: canonical.preflopLine,
    openSizeBB: canonical.openSizeBB,
    sourceMode: built.preflop?.sourceMode || scenario?.sourceMode || null,
    trainerCanonicalId: built.preflop?.trainerCanonicalId || null
  };
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
