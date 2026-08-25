// Task context integrity validation — display vs canonical vs grading.

import { validateTask } from '../../../task-context/validator.js';
import {
  buildCanonicalSpot,
  boardExpectedLength,
  formatBoardDisplay,
  formatBoardLabel,
  inferGradingTarget,
  inferQuestionType,
  canonicalToSizingSpot,
  canonicalToReviewSpot,
  canonicalToXraySpot,
  canonicalToSwipeSpot,
  canonicalToDisplayContext
} from '../../../task-context/canonicalSpot.js';
import { auditTaskTrainerCoverage } from '../../../trainer-knowledge/adapters/taskAdapter.js';
import { choiceToActionType, drillFromLibraryTask } from './libraryDrill.js';

export const ERROR_TYPES = [
  'STREET_MISMATCH',
  'BOARD_MISMATCH',
  'POSITION_MISMATCH',
  'STACK_MISMATCH',
  'PREFLOP_HISTORY_MISMATCH',
  'POSTFLOP_HISTORY_MISMATCH',
  'QUESTION_MISMATCH',
  'ANSWER_OPTION_MISMATCH',
  'GRADING_TARGET_MISMATCH',
  'TRAINER_LOOKUP_MISMATCH',
  'STALE_DESCRIPTION'
];

const SEATS = ['UTG+1', 'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'MP', 'LJ'];

function seatInText(text, seat) {
  if (!seat || !text) return false;
  const re = new RegExp(`\\b${seat.replace('+', '\\+')}\\b`, 'g');
  const src = String(text);
  const stackRe = new RegExp(`\\d+(?:\\.\\d+)?\\s+${seat.replace('+', '\\+')}\\b`, 'i');
  for (const m of src.matchAll(re)) {
    const chunk = src.slice(Math.max(0, m.index - 8), m.index + seat.length);
    if (stackRe.test(chunk)) continue;
    return true;
  }
  return false;
}

function allHistoryText(spot) {
  return (spot.history || []).map((h) => h.text || '').join(' | ');
}

function facingKind(spot) {
  const last = spot.currentLine || '';
  const all = `${allHistoryText(spot)} ${spot.question || ''}`;
  const lastIsCheck = /чек/i.test(last) && !/ставит|рейз|3-бет|4-бет|трибет|пуш|олл-ин|открыл/i.test(last);
  if (lastIsCheck) return 'checked_to';
  if (/ставит|овербет|3-бетил|трибетил|4-бет|запушил|сквизнул|сквиз|\bbet\b/i.test(last)) return 'facing_bet';
  if (/открыл/i.test(last) && (spot.position === 'BB' || spot.position === 'SB' || /против открытия|против 3-бет|против пуш/i.test(spot.question || ''))) {
    return 'facing_bet';
  }
  if (spot.street === 'ПРЕФЛОП') {
    if (/все до тебя сфолдил|первый в раздаче|до тебя все сфолдил|все до SB сфолдил|до тебя нет открытий/i.test(all)) {
      return 'unopened';
    }
    if (/открыл|3-бет|4-бет|запушил|сквиз|трибет|залимповал|\bbet\b|\bbets\b/i.test(all)
      && /против|(?:^|[^0-9.])(?:UTG\+1|UTG|HJ|CO|BTN|SB|BB|MP|LJ)(?:\s|$|[^a-z])/i.test(all + (spot.question || ''))) {
      return 'facing_bet';
    }
    return 'unopened';
  }
  if (/все проверяют до тебя/i.test(all)) return 'checked_to';
  return 'checked_to';
}

function boardMentionsInText(text, board) {
  const label = formatBoardLabel(board).toLowerCase();
  if (!label || label.length < 6) return true;
  const compact = String(text || '').toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  const boardCompact = label.replace(/[^a-z0-9]/gi, '');
  if (!boardCompact) return true;
  if (compact.includes(boardCompact)) return true;
  const ranks = (board || []).map((c) => String(c)[0]).join('');
  return ranks.length >= 3 && compact.includes(ranks.toLowerCase());
}

function stackMentioned(text, stack) {
  if (stack == null || !text) return true;
  const n = Math.round(stack);
  return new RegExp(`\\b${n}\\s*(?:bb|бб)\\b`, 'i').test(text)
    || new RegExp(`\\b${n}\\b`).test(text);
}

function extractDisplayedFields(modeSpot, mode) {
  const c = modeSpot._canonical || buildCanonicalSpot(modeSpot);
  const display = canonicalToDisplayContext(c, { mode }) || {};
  return {
    canonical: c,
    board: modeSpot.board || c?.board || [],
    street: modeSpot.street || c?.street,
    position: modeSpot.position || c?.position || (modeSpot.pos ? String(modeSpot.pos).split(/\s/)[0] : null),
    villain: modeSpot.villain || c?.villain,
    stack: modeSpot.stack ?? modeSpot.heroStack ?? c?.heroStack,
    effStack: modeSpot.effStack ?? c?.effStack,
    ctx: modeSpot.ctx || modeSpot.extra || display.extra,
    question: modeSpot.question || c?.question,
    options: modeSpot.actions || modeSpot.options || c?.options || [],
    correct: modeSpot.correct || (Array.isArray(modeSpot.preferred) ? modeSpot.preferred[0] : modeSpot.preferred),
    history: modeSpot.history || modeSpot.line || modeSpot.nodes || c?.history,
    gradingTarget: inferGradingTarget(c)
  };
}

export function auditCanonicalSpot(spot, { mode = 'library', lookup = null } = {}) {
  const errors = [];
  const add = (type, detail, extra = {}) => errors.push({ type, detail, mode, ...extra });

  if (!spot || !spot.id) {
    add('STALE_DESCRIPTION', 'missing_spot');
    return { ok: false, errors, spot: null };
  }

  const expectedBoard = boardExpectedLength(spot.street);
  if (expectedBoard != null && (spot.board || []).length !== expectedBoard) {
    add('STREET_MISMATCH', `street ${spot.street} expects board len ${expectedBoard}, got ${(spot.board || []).length}`);
    add('BOARD_MISMATCH', `board length ${(spot.board || []).length} for ${spot.street}`);
  }

  const boardLabel = formatBoardDisplay(spot.board);
  const desc = spot.descriptionLine || '';
  if (spot.street !== 'ПРЕФЛОП' && boardLabel && desc && !boardMentionsInText(desc, spot.board)) {
    if (!boardMentionsInText(spot.question, spot.board) && !boardMentionsInText(spot.explain, spot.board)) {
      add('BOARD_MISMATCH', `description does not reference board ${boardLabel}`);
    }
  }

  if (spot.position && spot.villain && spot.position === spot.villain) {
    add('POSITION_MISMATCH', `hero and villain same seat ${spot.position}`);
  }

  const histText = allHistoryText(spot);
  if (spot.position && histText && !seatInText(histText, spot.position) && !seatInText(spot.question, spot.position)) {
    const heroNamed = /(?:^|[\s,.:;()])(?:ты|тебя|твоего|твой|ваш|у тебя)(?:[\s,.:;()]|$)/i.test(`${histText} ${spot.question}`);
    const unopened = /все до тебя сфолдил|первый в раздаче|до тебя все сфолдил|все до SB сфолдил|до тебя нет открытий|все до тебя/i.test(histText);
    if (!(spot.street === 'ПРЕФЛОП' && (unopened || heroNamed))) {
      add('POSITION_MISMATCH', `position ${spot.position} not reflected in history/question`);
    }
  }

  if (spot.heroStack != null && spot.effStack != null && spot.effStack > Math.min(spot.heroStack, spot.villainStack || spot.heroStack) + 1e-6) {
    add('STACK_MISMATCH', `effStack ${spot.effStack} > min stacks`);
  }

  if (spot.question && spot.heroStack != null && /(\d+)\s*ББ/.test(spot.question)) {
    const m = spot.question.match(/(\d+)\s*ББ/g);
    const nums = m ? m.map((x) => Number(x.replace(/\D/g, ''))) : [];
    if (nums.length && !nums.some((n) => Math.abs(n - spot.heroStack) <= 2)) {
      add('STACK_MISMATCH', `question stack ${nums.join('/')} vs heroStack ${spot.heroStack}`);
    }
  }

  const preflopEntries = (spot.history || []).filter((h) => /ПРЕФЛОП|preflop/i.test(h.street || ''));
  if (spot.street === 'ПРЕФЛОП' && !preflopEntries.length && !spot.preflopLine) {
    add('PREFLOP_HISTORY_MISMATCH', 'preflop street without preflop history');
  }

  if (spot.street !== 'ПРЕФЛОП') {
    const post = (spot.history || []).filter((h) => !/ПРЕФЛОП|preflop/i.test(h.street || ''));
    if (!post.length) {
      add('POSTFLOP_HISTORY_MISMATCH', `postflop street ${spot.street} without postflop history`);
    }
  }

  const qType = inferQuestionType(spot);
  const gTarget = inferGradingTarget(spot);
  if (qType === 'sizing' && gTarget?.kind !== 'sizing' && !/СТАВКА|ЧЕК/.test(spot.correct)) {
    add('QUESTION_MISMATCH', `sizing question but correct=${spot.correct}`);
  }
  if (qType === 'action' && gTarget?.kind === 'sizing') {
    add('GRADING_TARGET_MISMATCH', `action question but grading target is sizing`);
  }

  const opts = spot.options || [];
  if (spot.correct && opts.length && !opts.includes(spot.correct)) {
    add('ANSWER_OPTION_MISMATCH', `correct "${spot.correct}" not in options`);
  }

  const kind = facingKind(spot);
  const has = (x) => opts.includes(x);
  if (kind === 'facing_bet') {
    if (has('ЧЕК')) add('ANSWER_OPTION_MISMATCH', 'CHECK offered facing bet');
    if (has('СТАВКА')) add('ANSWER_OPTION_MISMATCH', 'BET offered facing bet (need RAISE)');
  }
  if (kind === 'checked_to') {
    if (has('КОЛЛ')) add('ANSWER_OPTION_MISMATCH', 'CALL offered when checked to');
    if (has('ФОЛД') && spot.street !== 'ПРЕФЛОП') add('ANSWER_OPTION_MISMATCH', 'FOLD offered when checked to postflop');
  }
  if (kind === 'unopened') {
    if (has('КОЛЛ') && !/лимп|complete/i.test(histText)) add('ANSWER_OPTION_MISMATCH', 'CALL offered unopened preflop');
    if (has('ЧЕК') && spot.position !== 'BB') add('ANSWER_OPTION_MISMATCH', 'CHECK offered unopened preflop (non-BB)');
  }

  const types = opts.map(choiceToActionType);
  if (new Set(types).size < types.length) {
    add('GRADING_TARGET_MISMATCH', `duplicate action types in options: ${types.join(',')}`);
  }

  const schema = validateTask(spot);
  for (const e of schema.errors || []) {
    if (/street|board|position|stack|hero|villain|question|options|correct/i.test(e)) {
      const type = /board|street/i.test(e) ? 'BOARD_MISMATCH'
        : /position|villain/i.test(e) ? 'POSITION_MISMATCH'
          : /stack/i.test(e) ? 'STACK_MISMATCH'
            : /question/i.test(e) ? 'QUESTION_MISMATCH'
              : /options|correct/i.test(e) ? 'ANSWER_OPTION_MISMATCH'
                : 'STALE_DESCRIPTION';
      add(type, e);
    }
  }

  if (lookup && spot.street === 'ПРЕФЛОП') {
    const trainer = auditTaskTrainerCoverage(spot, lookup);
    if (trainer.trainerStatus === 'EXACT_TRAINER_MATCH' && !trainer.exactAnswerPossible) {
      add('TRAINER_LOOKUP_MISMATCH', trainer.blockedReason || trainer.trainerStatus);
    }
    if (trainer.mappedChoice && trainer.mappedChoice !== spot.correct && !(spot.alsoOk || []).includes(trainer.mappedChoice)) {
      add('TRAINER_LOOKUP_MISMATCH', `trainer maps ${trainer.mappedChoice} vs library ${spot.correct}`);
    }
  }

  return { ok: errors.length === 0, errors, spot };
}

export function auditModeSpot(task, mode, { lookup = null } = {}) {
  const canonical = buildCanonicalSpot(task);
  let modeSpot = null;

  if (mode === 'swipe' || mode === 'daily' || mode === 'memory') {
    modeSpot = canonicalToSwipeSpot(canonical);
  } else if (mode === 'sizing') {
    modeSpot = canonicalToSizingSpot(canonical);
  } else if (mode === 'review') {
    modeSpot = canonicalToReviewSpot(canonical);
  } else if (mode === 'xray') {
    modeSpot = canonicalToXraySpot(canonical);
  } else {
    modeSpot = { _canonical: canonical };
  }

  if (modeSpot?._quarantine) {
    return {
      ok: false,
      quarantined: true,
      reason: modeSpot.reason,
      errors: [{ type: 'STALE_DESCRIPTION', detail: modeSpot.reason, mode }],
      canonical,
      modeSpot
    };
  }

  const base = auditCanonicalSpot(canonical, { mode, lookup });
  const errors = [...base.errors];
  const displayed = extractDisplayedFields(modeSpot, mode);

  if (displayed.board && canonical.board && formatBoardLabel(displayed.board) !== formatBoardLabel(canonical.board)) {
    errors.push({ type: 'BOARD_MISMATCH', detail: 'displayed board != canonical board', mode });
  }
  if (displayed.street && canonical.street && displayed.street !== canonical.street) {
    errors.push({ type: 'STREET_MISMATCH', detail: `displayed ${displayed.street} != canonical ${canonical.street}`, mode });
  }
  if (displayed.stack != null && canonical.heroStack != null && Math.abs(displayed.stack - canonical.heroStack) > 0.01) {
    errors.push({ type: 'STACK_MISMATCH', detail: `displayed stack ${displayed.stack} != canonical ${canonical.heroStack}`, mode });
  }

  if (mode === 'sizing' && inferQuestionType(canonical) !== 'sizing' && !canonical.options.some((o) => /СТАВКА|ЧЕК/.test(o))) {
    errors.push({ type: 'QUESTION_MISMATCH', detail: 'sizing mode but task is not a sizing decision', mode });
  }

  if (mode === 'review' && modeSpot.bad != null && modeSpot.nodes && modeSpot.bad >= modeSpot.nodes.length) {
    errors.push({ type: 'GRADING_TARGET_MISMATCH', detail: `review bad index ${modeSpot.bad} out of range`, mode });
  }

  const gen = drillFromLibraryTask(task);
  if (gen.ok && gen.drill?.solution?.recommendedAction) {
    const rec = gen.drill.solution.recommendedAction.type;
    const target = inferGradingTarget(canonical);
    const expected = target?.actionType || choiceToActionType(canonical.correct);
    if (expected && rec !== expected) {
      errors.push({ type: 'GRADING_TARGET_MISMATCH', detail: `drill recommends ${rec}, canonical target ${expected}`, mode });
    }
  }

  return {
    ok: errors.length === 0,
    quarantined: false,
    errors,
    canonical,
    modeSpot
  };
}

export function summarizeErrors(entries) {
  const byType = {};
  const byMode = {};
  for (const e of entries) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    if (e.mode) byMode[e.mode] = (byMode[e.mode] || 0) + 1;
  }
  return { byType, byMode };
}
