// Convert a task-context library task into a self-contained training drill
// (quiz-style, no solver). Compatible with gradeAnswer / drillViewModel.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { leakLabelRu } from './concepts.js';
import { mapLeakConceptForTask, deriveSkillTags } from './planner.js';

const STREET_EN = {
  'ПРЕФЛОП': 'preflop',
  'ФЛОП': 'flop',
  'ТЁРН': 'turn',
  'РИВЕР': 'river'
};

const BEST_EV = 10;
const NEAR_EV = 9.2;
const WRONG_EV = 5;

export function choiceToActionType(choice) {
  const c = String(choice || '').trim().toUpperCase();
  if (c === 'ФОЛД') return 'fold';
  if (c === 'ЧЕК') return 'check';
  if (c === 'КОЛЛ') return 'call';
  if (c.includes('ОЛЛ-ИН') || c === 'ОЛЛИН') return 'all_in';
  if (c.includes('4-БЕТ')) return '4bet';
  if (c.includes('3-БЕТ')) return '3bet';
  if (c.includes('РЕЙЗ')) return 'raise';
  if (c.includes('СТАВКА')) {
    const sizeMatch = c.match(/(\d+)\s*%/);
    if (sizeMatch) return `bet_${sizeMatch[1]}`;
    return 'bet';
  }
  return 'check';
}

function lastHistoryText(task) {
  const h = task.history || [];
  return h.length ? String(h[h.length - 1].text || '') : '';
}

function preflopHistoryText(task) {
  const entry = (task.history || []).find((h) => /ПРЕФЛОП|preflop/i.test(h.street || ''));
  return entry ? String(entry.text || '') : '';
}

function parseOpenSizeBb(text = '') {
  const m = String(text).replace(',', '.')
    .match(/(?:откр(?:ыл|ыла|ытие)|open|raise|рейз|3-бет|3-bet)[^\d]{0,12}(\d+(?:\.\d+)?)\s*(?:bb|бб)/i);
  return m ? Number(m[1]) : null;
}

function normalizeHeroCards(hero) {
  if (!Array.isArray(hero)) return [];
  return hero.map((c) => String(c).replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c'));
}

function normalizeBoard(board) {
  if (!Array.isArray(board)) return [];
  return board.map((c) => String(c).replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c'));
}

/** Full task payload for Poker Brain / mini-app swipe (production path). */
export function libraryTaskToBrainSpot(task) {
  if (!task) return null;
  const preflopLine = preflopHistoryText(task);
  const currentLine = lastHistoryText(task);
  const gen = drillFromLibraryTask(task);
  const skillTags = deriveSkillTags(task);
  return {
    id: task.id,
    street: task.street,
    format: task.format || '',
    stage: task.stage || '',
    table: task.table || '',
    miniApp: 'training',
    skillTags,
    difficulty: task.difficulty || 2,
    heroPosition: task.position || '',
    villainPosition: task.villain || '',
    pos: [task.position, task.villain ? `vs ${task.villain}` : ''].filter(Boolean).join(' '),
    hero: task.hero || [],
    board: task.board || [],
    ctx: currentLine || task.question || '',
    currentLine,
    actionHistory: (task.history || []).map((h) => `${h.street}: ${h.text}`),
    preflopLine,
    openSizeBB: parseOpenSizeBb(preflopLine) ?? parseOpenSizeBb(currentLine),
    stack: task.heroStack != null ? task.heroStack : (task.effStack != null ? task.effStack : 30),
    effStack: task.effStack != null ? task.effStack : task.heroStack,
    pot: task.pot != null ? task.pot : 5,
    actions: task.options || [],
    preferred: [task.correct],
    live: task.alsoOk || [],
    concept: task.concept,
    why: task.explain || '',
    opp: task.opp && task.opp.name ? task.opp.name : (typeof task.opp === 'string' ? task.opp : null),
    question: task.question || '',
    _drill: gen.ok ? gen.drill : null,
    _library: true
  };
}

const EXPLAIN_ACTION_KEYWORDS = {
  ФОЛД: ['фолд', 'пас', 'сдава', 'сбрасыв', 'не оправдан', 'не защит', 'не колл'],
  КОЛЛ: ['колл', 'защит', 'кэтч', 'кетч', 'плат', 'лов', 'коллиру'],
  ЧЕК: ['чек', 'check', 'не став', 'пропуск', 'чек-бих'],
  СТАВКА: ['ставк', 'ставим', 'ставить', 'бет', 'с-бет', 'баррел', 'барел', 'добир', 'value', 'вэлью', 'ценност', 'тонк', 'полублеф'],
  РЕЙЗ: ['рейз', '3-бет', '4-бет', 'агрес', 'чек-рейз', 'открыва', 'оупен', 'open', 'стил', 'изол'],
  '3-БЕТ': ['3-бет', 'трибет', 'сквиз'],
  '4-БЕТ': ['4-бет'],
  'ОЛЛ-ИН': ['олл-ин', 'пуш', 'шов', 'push', 'изолир']
};

/** Returns whether task.explain names the recommended action (audit + QA). */
export function explanationMatchesTask(task) {
  const ex = String(task.explain || '').toLowerCase();
  if (!ex.trim()) return { ok: false, reason: 'empty_explain' };
  const base = String(task.correct || '').replace(/\s+\d+%.*$/i, '').trim();
  const keys = EXPLAIN_ACTION_KEYWORDS[base]
    || EXPLAIN_ACTION_KEYWORDS[task.correct]
    || [String(task.correct || '').toLowerCase()];
  const hit = keys.some((k) => ex.includes(k));
  return { ok: hit, reason: hit ? null : 'explain_omits_correct_action' };
}

export function drillFromLibraryTask(task, { leakConcept = null } = {}) {
  if (!task || !task.id) return { ok: false, reason: 'no_task' };

  const street = STREET_EN[task.street] || String(task.street || '').toLowerCase();
  const concept = leakConcept || mapLeakConceptForTask(task) || task.concept || 'sizing_efficiency';
  const options = (task.options || []).map((label, i) => {
    const id = `lib_${task.id}_${i}`;
    const isCorrect = label === task.correct;
    const isNear = !isCorrect && (task.alsoOk || []).includes(label);
    const evBB = isCorrect ? BEST_EV : isNear ? NEAR_EV : WRONG_EV;
    return {
      id,
      labelRu: label,
      action: { type: choiceToActionType(label) },
      evBB
    };
  });

  const actionEVs = {};
  for (const o of options) actionEVs[o.id] = o.evBB;
  const bestEV = BEST_EV;
  const recommended = options.find((o) => o.labelRu === task.correct) || options[0];

  const drillId = stableHash(`lib|${task.id}|${concept}`);

  return {
    ok: true,
    drill: {
      drillId,
      sourceTaskId: task.id,
      concept,
      street,
      difficulty: task.difficulty || 2,
      scenario: {
        heroPosition: task.position || 'BTN',
        villainPosition: task.villain || 'BB',
        effectiveStackBb: task.heroStack != null ? task.heroStack : task.effStack,
        potBb: task.pot,
        board: normalizeBoard(task.board),
        heroCards: normalizeHeroCards(task.hero),
        heroCardsHidden: false
      },
      options: options.map((o) => ({ id: o.id, action: o.action, labelRu: o.labelRu })),
      solution: {
        recommendedAction: recommended ? recommended.action : null,
        recommendedFrequency: 1,
        bestEV,
        actionEVs,
        evSpreadBb: BEST_EV - WRONG_EV,
        confidence: { score: 0.85, level: 'high' }
      },
      explanation: {
        keyConcept: concept,
        conceptLabelRu: leakLabelRu(concept) || task.concept,
        promptRu: task.question || 'Ваш ход.',
        historyRu: (task.history || []).map((h) => `${h.street}: ${h.text}`).join(' → '),
        contextRu: [
          task.position ? `${task.position} (ты)` : null,
          task.villain ? `против ${task.villain}` : null,
          task.heroStack != null ? `стек ${task.heroStack} ББ` : null,
          task.pot != null ? `банк ${task.pot} ББ` : null,
          task.format ? `формат ${task.format}` : null,
          task.stage ? `стадия ${task.stage}` : null
        ].filter(Boolean).join(' · '),
        explainRu: task.explain || ''
      },
      metadata: { source: 'task_library', taskId: task.id, task }
    }
  };
}
