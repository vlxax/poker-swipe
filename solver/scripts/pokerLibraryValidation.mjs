#!/usr/bin/env node
/**
 * Full active training library audit — objective poker legality & copy consistency.
 * Does not judge GTO correctness of correct/alsoOk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import { validateTask, validateLibrary } from '../../task-context/validator.js';
import { buildCanonicalSpot } from '../../task-context/canonicalSpot.js';
import { auditCanonicalSpot } from '../src/training/taskContextIntegrity.js';
import { evaluateCards } from '../src/cards/handEvaluator.js';
import { handBucketFromEvaluator } from '../src/cards/handBucket.js';
import { choiceToActionType } from '../src/training/libraryDrill.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'solver/tests/pokerLibraryValidation.report.json');

const STREET_BOARD = { ПРЕФЛОП: 0, ФЛОП: 3, ТЁРН: 4, РИВЕР: 5 };
const SEVERITY = { HARD_ERROR: 'HARD_ERROR', WARNING: 'WARNING', VALIDATION_REQUIRED: 'VALIDATION_REQUIRED' };

function issue(taskId, category, message, opts = {}) {
  return {
    taskId,
    severity: opts.severity || SEVERITY.HARD_ERROR,
    category,
    street: opts.street || null,
    context: opts.context || {},
    message,
    autoFixSafe: !!opts.autoFixSafe,
    requiresStrategyValidation: !!opts.requiresStrategyValidation
  };
}

function madeHandLabel(ev) {
  const map = {
    high_card: 'high_card',
    one_pair: 'pair',
    two_pair: 'two_pair',
    three_of_a_kind: 'trips',
    straight: 'straight',
    flush: 'flush',
    full_house: 'full_house',
    four_of_a_kind: 'quads',
    straight_flush: 'straight_flush'
  };
  return map[ev.category] || ev.category;
}

const MADE_TERMS = [
  { re: /фулл.?хаус|full house/i, want: ['full_house'] },
  { re: /каре|quads/i, want: ['quads'] },
  { re: /натсовый стрит|натс.?стрит/i, want: ['straight', 'straight_flush'] },
  { re: /\bстрит\b/i, want: ['straight', 'straight_flush'], not: /гатшот|дро|draw|oesd/i },
  { re: /флаш(?!.?дро)/i, want: ['flush', 'straight_flush'], not: /дро|draw|бэкдор/i },
  { re: /сет\b|set\b/i, want: ['trips'], streetMin: 'ФЛОП' },
  { re: /трипс|trips/i, want: ['trips'] },
  { re: /две пары|two pair/i, want: ['two_pair'] },
  { re: /оверпара/i, want: ['pair'], bucket: ['OVERPAIR'] },
  { re: /топ.?пара/i, want: ['pair'], bucket: ['TOP_PAIR'] }
];

function textClaimsDraw(text) {
  const t = String(text || '');
  return {
    backdoorFlush: /бэкдор.?флаш|backdoor flush/i.test(t),
    flushDraw: /флаш.?дро|flush draw/i.test(t),
    oesd: /oesd|открытое.?дро|открытый стрит/i.test(t),
    gutshot: /гатшот|gutshot/i.test(t),
    combo: /комбо.?дро|combo draw/i.test(t),
    noDraw: /без дро|нет дро|no draw/i.test(t)
  };
}

function maxSuitCount(hero, board) {
  const suits = [...(hero || []), ...(board || [])].map((c) => String(c).slice(-1));
  const m = {};
  suits.forEach((s) => { m[s] = (m[s] || 0) + 1; });
  return Math.max(0, ...Object.values(m));
}

function auditMadeHand(task, issues) {
  const board = task.board || [];
  if (board.length < 3) return;
  const ev = evaluateCards([...(task.hero || []), ...board]);
  if (!ev.valid) return;
  const label = madeHandLabel(ev);
  const bucket = handBucketFromEvaluator(task.hero, board);
  const blob = `${task.explain || ''} ${task.concept || ''} ${task.question || ''}`;

  for (const rule of MADE_TERMS) {
    if (rule.not && rule.not.test(blob)) continue;
    if (rule.streetMin && STREET_BOARD[task.street] < STREET_BOARD[rule.streetMin]) continue;
    if (!rule.re.test(blob)) continue;
    const ok = rule.want.includes(label)
      || (rule.bucket && rule.bucket.includes(bucket));
    if (!ok) {
      issues.push(issue(task.id, 'MADE_HAND_MISMATCH',
        `Text claims "${rule.re}" but evaluator=${label} bucket=${bucket}`,
        { street: task.street, severity: SEVERITY.WARNING, autoFixSafe: true }));
    }
  }

  const claims = textClaimsDraw(blob);
  const cardsLeft = 5 - board.length;
  const suitN = maxSuitCount(task.hero, board);
  if (claims.backdoorFlush && cardsLeft <= 1 && suitN < 4) {
    issues.push(issue(task.id, 'DRAW_MISMATCH',
      'Backdoor flush language on turn/river but only one card can arrive and <4 suited cards',
      { street: task.street, severity: SEVERITY.WARNING, autoFixSafe: true }));
  }
  if (claims.noDraw && (bucket === 'DRAW' || bucket === 'COMBO_DRAW')) {
    issues.push(issue(task.id, 'DRAW_MISMATCH', 'Claims no draw but hand bucket is draw',
      { street: task.street, severity: SEVERITY.WARNING, autoFixSafe: true }));
  }
}

function auditGradingActions(task, issues) {
  const opts = task.options || [];
  if (task.correct && !opts.includes(task.correct)) {
    issues.push(issue(task.id, 'GRADING_ACTION_INVALID', `correct not in options: ${task.correct}`,
      { autoFixSafe: false }));
  }
  for (const alt of task.alsoOk || []) {
    if (!opts.includes(alt)) {
      issues.push(issue(task.id, 'GRADING_ACTION_INVALID', `alsoOk "${alt}" not in options`,
        { autoFixSafe: false }));
    }
    if (alt === task.correct) {
      issues.push(issue(task.id, 'GRADING_ACTION_INVALID', 'alsoOk duplicates correct',
        { autoFixSafe: true }));
    }
  }
  try {
    choiceToActionType(task.correct);
  } catch (e) {
    issues.push(issue(task.id, 'GRADING_ACTION_INVALID', `correct action type: ${e.message}`,
      { autoFixSafe: false }));
  }
}

function icmPkoStatus(task) {
  const blob = `${task.format} ${task.stage} ${task.concept} ${(task.tags || []).join(' ')} ${task.explain}`.toLowerCase();
  const icm = /icm|баббл|bubble|финальн|final table|pay.?jump|лестниц|ladder|satellite|сателлит/i.test(blob);
  const pko = /pko|bounty|баунти|knockout|нокаут/i.test(blob);
  if (!icm && !pko) return { icm: 'NOT_ICM_DEPENDENT', pko: 'NOT_ICM_DEPENDENT' };

  const hasStacks = task.heroStack > 0 && (task.villainStack > 0 || /left|осталось/i.test(task.left || ''));
  const hasPos = task.position && task.villain;
  const hasField = /left|\d+\s*left|осталось|игрок/i.test(`${task.left} ${task.history?.map((h) => h.text).join(' ')}`);
  const hasPayout = /выплат|payout|prize|приз|место|ladder/i.test(blob);
  const hasBounty = /баунти|bounty|\$\d|bb bounty/i.test(blob);

  let icmStatus = 'NOT_ICM_DEPENDENT';
  if (icm) {
    if (hasStacks && hasPos && hasField && (hasPayout || task.format === 'SNG' || task.table?.includes('3-MAX'))) {
      icmStatus = hasPayout ? 'ICM_CONTEXT_COMPLETE' : 'ICM_CONTEXT_PARTIAL';
    } else if (hasStacks && hasPos) icmStatus = 'ICM_CONTEXT_PARTIAL';
    else icmStatus = 'ICM_CONTEXT_INSUFFICIENT';
  }

  let pkoStatus = 'NOT_ICM_DEPENDENT';
  if (pko) {
    if (hasBounty && hasStacks && hasPos) pkoStatus = 'PKO_CONTEXT_PARTIAL';
    else if (hasStacks && hasPos && /баунти|pko/i.test(blob)) pkoStatus = 'PKO_CONTEXT_PARTIAL';
    else pkoStatus = 'PKO_CONTEXT_INSUFFICIENT';
  }
  return { icm: icmStatus, pko: pkoStatus };
}

function auditIcmPko(task, issues, summary) {
  const st = icmPkoStatus(task);
  if (st.icm === 'ICM_CONTEXT_INSUFFICIENT') {
    summary.icmContextInsufficient++;
    issues.push(issue(task.id, 'ICM_CONTEXT_INSUFFICIENT',
      'ICM-dependent copy without payout/field/stack context for exact ICM',
      { severity: SEVERITY.VALIDATION_REQUIRED, requiresStrategyValidation: true }));
  } else if (st.icm === 'ICM_CONTEXT_PARTIAL') summary.icmContextPartial = (summary.icmContextPartial || 0) + 1;
  if (st.pko === 'PKO_CONTEXT_INSUFFICIENT') {
    summary.pkoContextInsufficient++;
    issues.push(issue(task.id, 'PKO_CONTEXT_INSUFFICIENT',
      'PKO copy without explicit bounty economics',
      { severity: SEVERITY.VALIDATION_REQUIRED, requiresStrategyValidation: true }));
  } else if (st.pko === 'PKO_CONTEXT_PARTIAL') summary.pkoContextPartial = (summary.pkoContextPartial || 0) + 1;
  return st;
}

function mapIntegrityType(type) {
  const m = {
    STREET_MISMATCH: 'STREET_INVALID',
    BOARD_MISMATCH: 'CARD_INVALID',
    POSITION_MISMATCH: 'POSITION_ORDER_INVALID',
    STACK_MISMATCH: 'STACK_INVALID',
    PREFLOP_HISTORY_MISMATCH: 'ACTION_HISTORY_INVALID',
    POSTFLOP_HISTORY_MISMATCH: 'ACTION_HISTORY_INVALID',
    QUESTION_MISMATCH: 'CONTEXT_INSUFFICIENT',
    ANSWER_OPTION_MISMATCH: 'GRADING_ACTION_INVALID',
    GRADING_TARGET_MISMATCH: 'GRADING_ACTION_INVALID',
    TRAINER_LOOKUP_MISMATCH: 'STRATEGY_UNVERIFIED',
    STALE_DESCRIPTION: 'CONTEXT_INSUFFICIENT'
  };
  return m[type] || 'CONTEXT_INSUFFICIENT';
}

export function runPokerLibraryValidation({ write = true } = {}) {
  const tasks = loadTaskLibrary();
  const libMeta = validateLibrary(tasks);
  const seen = new Set();
  const duplicateIds = [];
  for (const t of tasks) {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
  }

  const issues = [];
  const perTaskIcm = {};
  const summary = {
    totalTasks: tasks.length,
    activeTasks: tasks.length,
    duplicateIds: [...new Set(duplicateIds)],
    unreachableTasks: 0,
    invalidTasks: 0,
    contextInsufficient: 0,
    requiresSolverValidation: 0,
    schemaInvalid: 0,
    cardInvalid: 0,
    streetInvalid: 0,
    actionHistoryInvalid: 0,
    positionOrderInvalid: 0,
    stackInvalid: 0,
    handDescriptionMismatch: 0,
    drawMismatch: 0,
    icmContextInsufficient: 0,
    pkoContextInsufficient: 0,
    strategyUnverified: 0,
    objectiveErrors: 0,
    hardErrors: 0,
    warnings: 0,
    validationRequired: 0
  };

  if (!libMeta.ok) {
    for (const e of libMeta.errors) {
      issues.push(issue('LIBRARY', 'CARD_INVALID', e, { severity: SEVERITY.HARD_ERROR }));
      summary.schemaInvalid++;
    }
  }

  for (const task of tasks) {
    const v = validateTask(task);
    for (const e of v.errors) {
      issues.push(issue(task.id, 'CARD_INVALID', e, { autoFixSafe: true }));
      summary.cardInvalid++;
    }

    const expected = STREET_BOARD[task.street];
    if (expected != null && (task.board || []).length !== expected) {
      issues.push(issue(task.id, 'STREET_INVALID',
        `street ${task.street} expects ${expected} board cards, got ${(task.board || []).length}`,
        { street: task.street, autoFixSafe: true }));
      summary.streetInvalid++;
    }

    const canon = buildCanonicalSpot(task);
    const audit = auditCanonicalSpot(canon, { mode: 'library' });
    if (!audit.ok) {
      for (const err of audit.errors) {
        const cat = mapIntegrityType(err.type);
        issues.push(issue(task.id, cat, err.detail || err.type,
          { street: task.street, context: { integrityType: err.type } }));
        if (cat === 'ACTION_HISTORY_INVALID') summary.actionHistoryInvalid++;
        else if (cat === 'POSITION_ORDER_INVALID') summary.positionOrderInvalid++;
        else if (cat === 'STACK_INVALID') summary.stackInvalid++;
        else if (cat === 'STREET_INVALID') summary.streetInvalid++;
        else if (cat === 'CARD_INVALID') summary.cardInvalid++;
        else summary.contextInsufficient++;
      }
    }

    auditGradingActions(task, issues);
    auditMadeHand(task, issues);
    const icm = auditIcmPko(task, issues, summary);
    perTaskIcm[task.id] = icm;
  }

  summary.strategyUnverified = tasks.length;

  for (const i of issues) {
    if (i.category === 'MADE_HAND_MISMATCH') summary.handDescriptionMismatch++;
    if (i.category === 'DRAW_MISMATCH') summary.drawMismatch++;
    if (i.severity === SEVERITY.HARD_ERROR) summary.hardErrors++;
    else if (i.severity === SEVERITY.WARNING) summary.warnings++;
    else if (i.severity === SEVERITY.VALIDATION_REQUIRED) summary.validationRequired++;
  }

  summary.objectiveErrors = summary.hardErrors
    + summary.cardInvalid + summary.streetInvalid + summary.actionHistoryInvalid
    + summary.positionOrderInvalid + summary.stackInvalid;
  summary.invalidTasks = new Set(issues.filter((x) => x.severity === SEVERITY.HARD_ERROR).map((x) => x.taskId)).size;
  summary.requiresSolverValidation = issues.filter((x) => x.requiresStrategyValidation).length;

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    icmPkoByTask: perTaskIcm,
    spotlight: {
      SNG_ICM_77: { ...perTaskIcm.SNG_ICM_77, action: 'KEEP', note: 'SNG 3-max bubble — heuristic training; not exact ICM without payout table' },
      ADV_ICM_COVER_A5S: { ...perTaskIcm.ADV_ICM_COVER_A5S, action: 'DOWNGRADE CLAIM', note: 'PKO bounty size unspecified — concept training only' },
      TOUR_PKO_FT_TT: { ...perTaskIcm.TOUR_PKO_FT_TT, action: 'VALIDATION QUEUE', note: 'FT PKO without bounty $ — queue for solver/ICM' },
      ADV_ICM_SHORT_COVER: { ...perTaskIcm.ADV_ICM_SHORT_COVER, action: 'KEEP', note: 'FT push/fold heuristic with stacks+field count' }
    },
    issues
  };

  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runPokerLibraryValidation();
  console.log(JSON.stringify({ path: OUT, summary: r.summary }, null, 2));
}
