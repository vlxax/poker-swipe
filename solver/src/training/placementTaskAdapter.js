// Placement Test V2 — adapt validated MTT library tasks into structured
// placement items with mini-app presentation modes (swipe / sizing / review /
// xray / quick). No cash, no raw paragraph dumps.

import { validateTask } from '../../../task-context/validator.js';
import { loadTaskLibrary } from './taskLibraryBridge.js';
import { deriveSkillTags } from './planner.js';
import { derivePrimarySkill, assessmentSkillWeights } from './placementSkillAttribution.js';
import { drillFromLibraryTask } from './libraryDrill.js';

export const PLACEMENT_MODES = ['swipe', 'sizing', 'review', 'xray', 'quick'];

const STREET_EN = {
  'ПРЕФЛОП': 'preflop',
  'ФЛОП': 'flop',
  'ТЁРН': 'turn',
  'РИВЕР': 'river'
};

const SIZING_BUCKET_PCTS = [0, 33, 50, 75, 100, 125];

function cardsLabel(hero) {
  if (!Array.isArray(hero) || hero.length !== 2) return '';
  return hero.join('');
}

function inferSizingTargetPct(task) {
  const blob = [task.concept, ...(task.tags || []), task.question].join(' ').toLowerCase();
  if (/overbet|овербет|140|125|поляр/.test(blob)) return 125;
  if (/thin|тонк|river value|value barrel|66%|75%/.test(blob)) return 75;
  if (/small|мален|33%|25%|dry board|сух/.test(blob)) return 33;
  if (/polar|поляр|turn value|barrel/.test(blob)) return 75;
  return 50;
}

export function assignMiniAppMode(task, { slotIndex = 0, modePlan = null } = {}) {
  if (modePlan && modePlan[slotIndex]) return modePlan[slotIndex];

  const tags = deriveSkillTags(task);
  const histLen = (task.history || []).length;
  const stack = task.heroStack != null ? task.heroStack : task.effStack;
  const blob = [task.concept, ...(task.tags || []), task.stage].join(' ').toLowerCase();

  if (tags.includes('rangeReading') || /range|диапазон|dynamic board|range advantage/.test(blob)) {
    return 'xray';
  }
  if (histLen >= 3 && task.street !== 'ПРЕФЛОП') return 'review';
  if (tags.includes('betSizing') || /sizing|сайзинг|barrel|overbet|ставк/.test(blob)) {
    return 'sizing';
  }
  if (stack != null && stack <= 15) return 'quick';
  if (tags.includes('icm') || tags.includes('shortStack') || /баббл|icm|push|пуш|itm|финал/.test(blob)) {
    return 'quick';
  }
  return 'swipe';
}

export function formatPlacementContext(task) {
  const table = task.table || '6-MAX';
  const stage = task.stage || 'СРЕДНЯЯ';
  const left = task.left ? String(task.left) : null;
  const heroStack = task.heroStack != null ? task.heroStack : task.effStack;
  const villainStack = task.villainStack != null ? task.villainStack : heroStack;
  const eff = task.effStack != null ? task.effStack : Math.min(heroStack || 30, villainStack || 30);
  const pot = task.pot != null ? task.pot : 5;

  return {
    format: 'MTT',
    formatLine: `MTT · ${table}${left ? ` · ${left}` : ''}`,
    stageLine: stage,
    tableLine: table,
    heroPosition: task.position || '',
    villainPosition: task.villain || '',
    heroCards: (task.hero || []).slice(),
    board: (task.board || []).slice(),
    heroStackBb: heroStack,
    villainStackBb: villainStack,
    effStackBb: eff,
    potBb: pot,
    stacksLine: `${task.position || '—'} (ты) ${heroStack} BB vs ${task.villain || '—'} ${villainStack} BB · банк ${pot} BB`,
    actionHistory: (task.history || []).map((h) => ({
      street: h.street || task.street,
      text: h.text || ''
    })),
    opponent: task.opp && task.opp.name ? task.opp.name : null,
    opponentStyle: task.opp && task.opp.style ? task.opp.style : null
  };
}

function buildReviewNodes(task) {
  const nodes = (task.history || []).map((h, i) => ({
    index: i,
    street: h.street || task.street,
    text: h.text || '',
    pot: h.pot != null ? h.pot : null
  }));
  return nodes;
}

function buildSizingChoices(task) {
  const target = inferSizingTargetPct(task);
  const correct = String(task.correct || '');
  if (correct === 'ЧЕК' || correct === 'ФОЛД') {
    return {
      choices: ['ЧЕК', '33%', '75%', '125%'],
      correct: 'ЧЕК',
      alsoOk: [],
      sizingTargetPct: 0
    };
  }
  const nearest = SIZING_BUCKET_PCTS.reduce((best, pct) =>
    Math.abs(pct - target) < Math.abs(best - target) ? pct : best, 50);
  const label = nearest === 0 ? 'ЧЕК' : `${nearest}%`;
  const choices = ['ЧЕК', '33%', '75%', '125%'];
  const alsoOk = [];
  if (nearest === 33 && target <= 40) alsoOk.push('33%');
  if (nearest === 75 && target >= 60 && target <= 90) alsoOk.push('75%');
  return {
    choices,
    correct: label,
    alsoOk,
    sizingTargetPct: nearest
  };
}

function buildXrayChoices(task) {
  const opts = task.options || [];
  if (opts.length >= 2) {
    return { choices: opts.slice(), correct: task.correct, alsoOk: task.alsoOk || [] };
  }
  return {
    choices: ['BB', 'BTN', 'РАВНО'],
    correct: 'BB',
    alsoOk: ['BTN']
  };
}

export function libraryTaskToPlacementItem(task, { slotIndex = 0, modePlan = null, forceMode = null } = {}) {
  if (!task || !task.id) return null;

  const mode = forceMode || assignMiniAppMode(task, { slotIndex, modePlan });
  const ctx = formatPlacementContext(task);
  const skillTags = deriveSkillTags(task);
  const primarySkill = derivePrimarySkill(task);
  const skillTag = primarySkill;
  const tier = task.difficulty || 2;

  let choices = (task.options || []).slice();
  let correct = task.correct;
  let alsoOk = (task.alsoOk || []).slice();
  let sizingTargetPct = null;
  let reviewNodes = null;
  let prompt = task.question || 'Твоё решение?';

  if (mode === 'sizing') {
    const sized = buildSizingChoices(task);
    choices = sized.choices;
    correct = sized.correct;
    alsoOk = sized.alsoOk;
    sizingTargetPct = sized.sizingTargetPct;
    prompt = 'Какой размер ставки?';
  } else if (mode === 'xray') {
    const xr = buildXrayChoices(task);
    choices = xr.choices;
    correct = xr.correct;
    alsoOk = xr.alsoOk;
    prompt = task.question && /диапазон|range|кто|впереди/i.test(task.question)
      ? task.question
      : 'Кто впереди по диапазону на этой улице?';
  } else if (mode === 'review') {
    reviewNodes = buildReviewNodes(task);
    prompt = 'Где линия требует другого решения?';
    choices = ['ЛИНИЯ НОРМАЛЬНАЯ', ...(task.options || [])];
    correct = (task.options || []).includes(task.correct) ? task.correct : task.correct;
    alsoOk = task.alsoOk || [];
  } else if (mode === 'quick') {
    prompt = task.question || 'Быстрое решение — что делаешь?';
  }

  const gen = drillFromLibraryTask(task);
  const scoreBase = 70 + tier * 4;
  const skillWeights = assessmentSkillWeights({ skillTags, primarySkill, _task: task });

  return {
    version: 2,
    id: task.id,
    miniAppMode: mode,
    tier,
    difficulty: tier,
    skillTag,
    primarySkill,
    skillTags,
    skillWeights,
    concept: task.concept,
    street: task.street,
    category: skillTag,
    choices,
    correct,
    alsoOk,
    score: scoreBase,
    prompt,
    context: ctx,
    sizingTargetPct,
    reviewNodes,
    tags: task.tags || [],
    _library: true,
    _task: task,
    _drill: gen.ok ? gen.drill : null
  };
}

export function getValidatedMttTasks(library = null) {
  const tasks = library || loadTaskLibrary();
  return tasks.filter((t) => {
    if (!t || t.format !== 'MTT') return false;
    return validateTask(t).errors.length === 0;
  });
}

export function buildMttPlacementPool(library = null) {
  return getValidatedMttTasks(library).map((t) => libraryTaskToPlacementItem(t));
}

export function tasksByTier(tasks, tier) {
  return tasks.filter((t) => (t.difficulty || t.tier || 2) === tier);
}

export function tasksBySkill(tasks, skill) {
  return tasks.filter((t) => {
    const tags = deriveSkillTags(t);
    return tags.includes(skill);
  });
}

export function placementItemStreetEn(item) {
  return STREET_EN[item.street] || String(item.street || '').toLowerCase();
}
