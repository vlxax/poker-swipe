// Convert a task-context library task into a self-contained training drill
// (quiz-style, no solver). Compatible with gradeAnswer / drillViewModel.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { leakLabelRu } from './concepts.js';
import { mapLeakConceptForTask } from './planner.js';

const STREET_EN = {
  'ПРЕФЛОП': 'preflop',
  'ФЛОП': 'flop',
  'ТЁРН': 'turn',
  'РИВЕР': 'river'
};

const BEST_EV = 10;
const NEAR_EV = 9.2;
const WRONG_EV = 5;

function choiceToActionType(choice) {
  const c = String(choice || '');
  if (c.includes('СТАВКА') || c.includes('ОЛЛ') || c.includes('РЕЙЗ') || c.includes('3-БЕТ') || c.includes('4-БЕТ')) return 'bet';
  if (c === 'КОЛЛ') return 'call';
  if (c === 'ЧЕК') return 'check';
  if (c === 'ФОЛД') return 'fold';
  return 'check';
}

function normalizeHeroCards(hero) {
  if (!Array.isArray(hero)) return [];
  return hero.map((c) => String(c).replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c'));
}

function normalizeBoard(board) {
  if (!Array.isArray(board)) return [];
  return board.map((c) => String(c).replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c'));
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
          task.pot != null ? `банк ${task.pot} ББ` : null
        ].filter(Boolean).join(' · ')
      },
      metadata: { source: 'task_library', taskId: task.id, task }
    }
  };
}
