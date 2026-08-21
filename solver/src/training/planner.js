// Training Planner (requirement P0). Composes the Spot Selection Engine with the
// leak / skill profiles and the concept library to produce a concrete session.

import { selectSpots, normalizeSpot, adaptiveDifficulty, conceptDue } from './spotSelector.js';
import { skillLabelRu } from './skillProfile.js';
import { errorCauseLabelRu } from './errorCause.js';
import { stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { skillsForConcept } from './skillProfile.js';

const DEFAULTS = {
  count: 7,
  weaknessShare: 0.65,
  maintenanceShare: 0.25,
  explorationShare: 0.10,
  masteryGate: 78
};

const CONCEPT_SKILL_RULES = [
  { pattern: /rfi|open|оупен/, street: /префлоп|preflop/, skills: ['preflop', 'positionAwareness'] },
  { pattern: /bb defence|bb defend|защита bb|defend/, skills: ['preflop', 'positionAwareness'] },
  { pattern: /3-bet|3-бет|squeeze|сквиз/, skills: ['preflop', 'bluffing'] },
  { pattern: /push|пуш|push-fold|олл-ин/, skills: ['shortStack', 'stackDepthAwareness'] },
  { pattern: /bubble|баббл|icm|itm|финальн|pko|баунти/, skills: ['icm'] },
  { pattern: /bluffcatch|bluff catch|блеф-кетч|price defence/, skills: ['bluffCatch', 'river', 'rangeReading'] },
  { pattern: /dry board|dynamic board|c-bet|с-бет|barrel|барелл/, skills: ['postflop'] },
  { pattern: /thin value|river value|river bluff/, skills: ['river', 'betSizing'] },
  { pattern: /exploit|эксплойт|нит|station|маниак|любитель/, skills: ['exploit'] },
  { pattern: /range|диапазон/, skills: ['rangeReading'] },
  { pattern: /sizing|сайзинг|overbet|поляризац/, skills: ['betSizing'] },
  { pattern: /блеф|bluff/, skills: ['bluffing'] }
];

const CONCEPT_TO_SKILLS = {
  rfi: ['preflop', 'positionAwareness'],
  defence: ['preflop'], defense: ['preflop'], defend: ['preflop'],
  '3-bet': ['preflop', 'bluffing'], '3-бет': ['preflop', 'bluffing'],
  '4-bet': ['preflop'], squeeze: ['preflop', 'bluffing'],
  push: ['shortStack', 'stackDepthAwareness'], 'push-fold': ['shortStack', 'stackDepthAwareness'],
  'c-bet': ['postflop'], 'с-бет': ['postflop'], check: ['postflop'],
  флоп: ['postflop'], flop: ['postflop'], turn: ['postflop'], тёрн: ['postflop'],
  river: ['river'], ривер: ['river'],
  bluff: ['bluffing'], блеф: ['bluffing'], bluffcatch: ['bluffCatch'], 'bluff catch': ['bluffCatch'],
  'bluff-catch': ['bluffCatch'], value: ['betSizing'], sizing: ['betSizing'], сайзинг: ['betSizing'],
  overbet: ['betSizing'], icm: ['icm'], баббл: ['icm'], bubble: ['icm'], itm: ['icm'],
  'final table': ['icm'], 'финальный': ['icm'], exploit: ['exploit'], эксплойт: ['exploit'],
  nit: ['exploit'], station: ['exploit'], maniac: ['exploit'],
  position: ['positionAwareness'], spr: ['stackDepthAwareness'], stack: ['stackDepthAwareness'],
  'короткий': ['shortStack'], pko: ['icm'], bounty: ['icm'], баунти: ['icm'],
  range: ['rangeReading'], paired: ['postflop'], barrel: ['postflop'], баррел: ['postflop']
};

const TASK_CONCEPT_TO_LEAK = {
  'river bluffcatch': 'bluff_catch',
  'price defence': 'bluff_catch',
  'price defense': 'bluff_catch',
  'bubble icm': 'icm_pressure',
  'bubble icm fold': 'icm_pressure',
  'bubble steal': 'icm_pressure',
  'bubble open': 'icm_pressure',
  'final table icm': 'icm_pressure',
  'bb defence': 'defend_vs_open',
  'bb defend': 'defend_vs_open',
  'thin value': 'thin_value',
  'river bluff': 'bluff',
  'turn value barrel': 'second_barrel',
  'turn barrel bluff': 'second_barrel',
  'dry board c-bet': 'cbet_frequency',
  'c-bet tptk': 'cbet_frequency',
  'exploit nit': 'exploit',
  'exploit station': 'exploit',
  'exploit maniac': 'exploit'
};

export function mapLeakConceptForTask(task) {
  const key = String(task.concept || '').toLowerCase().trim();
  if (TASK_CONCEPT_TO_LEAK[key]) return TASK_CONCEPT_TO_LEAK[key];
  for (const [pattern, leak] of Object.entries(TASK_CONCEPT_TO_LEAK)) {
    if (key.includes(pattern)) return leak;
  }
  const concat = [task.concept, ...(task.tags || []), task.street, task.stage]
    .map((x) => String(x || '').toLowerCase()).join(' ');
  if (/icm|баббл|bubble|itm|финальный|pko|баунти/.test(concat)) return 'icm_pressure';
  if (/bluffcatch|bluff catch|bluff-catch|блеф-кетч|price defence/.test(concat)) return 'bluff_catch';
  if (/bb defence|bb defend|защита bb|ante defence/.test(concat)) return 'defend_vs_open';
  if (/thin value|тонк/.test(concat)) return 'thin_value';
  if (/river bluff|блеф/.test(concat) && /ривер|river/.test(concat)) return 'bluff';
  if (/rfi|open|оупен/.test(concat) && /префлоп|preflop/.test(concat)) return 'open_range';
  return null;
}

export function poolFromLibrary(tasks = []) {
  return (tasks || []).map((t) => normalizeSpot({
    id: t.id,
    concept: t.concept,
    street: normalizeStreet(t.street),
    difficulty: normalizeDifficulty(t.difficulty),
    skillTags: deriveSkillTags(t),
    format: t.format,
    stage: t.stage,
    position: t.position,
    stackDepth: t.heroStack != null ? stackBucket(t.heroStack) : null,
    decisionType: decisionTypeFromTask(t),
    theoryOrExploit: isExploitTask(t) ? 'exploit' : 'theory',
    icmPressure: t.stage ? icmPressure(t.stage) : icmFromTags(t.tags),
    opponentType: t.opp && t.opp.name ? t.opp.name : (typeof t.opp === 'string' ? t.opp : null)
  }));
}

export function computeSkillTargets(skillProfile, count = 7) {
  if (!skillProfile || !skillProfile.skills) return null;
  const ranked = Object.values(skillProfile.skills)
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score);
  if (!ranked.length) return null;

  const weak = ranked.slice(0, 3);
  const strong = ranked[ranked.length - 1];
  const targets = {};
  let remaining = count;

  const alloc = (skill, n) => {
    if (n <= 0 || remaining <= 0) return;
    const take = Math.min(n, remaining);
    targets[skill] = (targets[skill] || 0) + take;
    remaining -= take;
  };

  if (weak[0]) alloc(weak[0].skill, Math.max(2, Math.round(count * 0.4)));
  if (weak[1]) alloc(weak[1].skill, Math.max(1, Math.round(count * 0.25)));
  if (weak[2]) alloc(weak[2].skill, Math.max(1, Math.round(count * 0.15)));
  if (strong && remaining > 0) alloc(strong.skill, 1);

  let guard = 0;
  while (remaining > 0 && weak.length && guard < count) {
    const w = weak[guard % weak.length];
    alloc(w.skill, 1);
    guard++;
  }

  return targets;
}

export function buildDailyPlan({
  pool = [],
  progressByConcept = {},
  history = [],
  recentResults = [],
  skillProfile = null,
  leakProfiles = [],
  count = DEFAULTS.count,
  now = Date.now(),
  rng = Math.random
} = {}) {
  const spots = pool.length ? pool : poolFromLibrary(globalThis.__POKERSWIPE_LIBRARY || []);
  const shownAt = buildShownAt(history);

  const dueConcepts = new Set();
  for (const spot of spots) {
    const last = history.filter((h) => h.concept === spot.concept || h.spotId === spot.id).at(-1);
    const progress = progressByConcept[spot.concept];
    const mastery = progress && progress.masteryScore != null ? progress.masteryScore : null;
    if (conceptDue({ lastSeenAt: last ? last.at : null, mastery, now })) dueConcepts.add(spot.concept);
  }
  const allowRepeatIds = buildSpacedReviewAllowIds(spots, history, progressByConcept, now);
  const allowSet = new Set(allowRepeatIds);
  const eligiblePool = spots.filter((s) => dueConcepts.has(s.concept) || dueConcepts.size === 0 || allowSet.has(s.id));

  const skillTargets = computeSkillTargets(skillProfile, count);

  const result = selectSpots({
    pool: eligiblePool.length ? eligiblePool : spots,
    shownAt,
    history,
    progressByConcept,
    recentResults,
    skillProfile,
    leakProfiles,
    count,
    now,
    masteryGate: DEFAULTS.masteryGate,
    skillTargets,
    allowRepeatIds,
    rng
  });

  if (!result.ok) {
    return {
      sessionId: stableHash(`${now}|empty`),
      total: count,
      filled: 0,
      spots: [],
      personalized: false,
      sessionPlan: { primaryTargets: [], maintenance: [], exploration: [] },
      reason: result.reason
    };
  }

  const idToSpot = new Map(spots.map((s) => [s.id, s]));
  const selectedSpots = result.selected.map((id) => idToSpot.get(id)).filter(Boolean);

  const sessionPlan = result.sessionPlan || {
    primaryTargets: [],
    maintenance: [],
    exploration: []
  };

  if (skillProfile && skillProfile.weakest && sessionPlan.primaryTargets.length === 0) {
    sessionPlan.primaryTargets.push(skillLabelRu(skillProfile.weakest.skill));
  }

  const plan = {
    sessionId: stableHash(`${now}|${result.selected.join(',')}`),
    total: count,
    filled: selectedSpots.length,
    spots: selectedSpots,
    spotIds: result.selected,
    conceptOrder: unique(selectedSpots.map((s) => s.concept)),
    primaryConcept: result.goal && result.goal.focus
      ? result.goal.focus
      : (selectedSpots[0] && selectedSpots[0].concept) || null,
    targetDifficulty: result.targetDifficulty,
    goal: result.goal,
    earliestMeaningful: result.earliestMeaningful,
    adaptiveDifficulty: result.targetDifficulty,
    reason: result.reason,
    buckets: result.buckets,
    slotKinds: result.slotKinds,
    sessionPlan,
    skillTargets,
    drills: selectedSpots.map((s) => ({
      spotId: s.id,
      concept: mapLeakConceptForTask({ concept: s.concept, tags: [], street: s.street }) || s.concept,
      street: s.street,
      source: 'library',
      bucket: result.buckets[selectedSpots.indexOf(s)]
    }))
  };
  plan.personalized = plan.filled > 0 && (
    (skillProfile && skillProfile.overall != null) ||
    (leakProfiles && leakProfiles.length > 0)
  );
  plan.estimatedDifficulty = result.targetDifficulty;
  return plan;
}

export function planSummaryRu(plan) {
  if (!plan || !plan.filled) return 'Пока нечего тренировать — собери больше раздач в «Моих руках».';
  const parts = [];
  if (plan.goal && plan.goal.copyRu) parts.push(plan.goal.copyRu);
  parts.push(`Спотов: ${plan.filled}. Сложность: ${plan.targetDifficulty != null ? plan.targetDifficulty.toFixed(1) + ' / 5' : '—'}.`);
  if (plan.sessionPlan && plan.sessionPlan.primaryTargets && plan.sessionPlan.primaryTargets.length) {
    parts.push(`Фокус: ${plan.sessionPlan.primaryTargets.slice(0, 3).join(', ')}.`);
  } else if (plan.primaryConcept) {
    parts.push(`Главная концепция: ${plan.primaryConcept}.`);
  }
  return parts.join(' ');
}

function buildSpacedReviewAllowIds(spots, history, progressByConcept, now) {
  const allow = new Set();
  for (const h of (history || [])) {
    if (h && h.spacedReview && h.spotId) allow.add(h.spotId);
  }
  return [...allow];
}

function buildShownAt(history) {
  const shown = {};
  const entries = (history || []).slice().reverse();
  entries.forEach((h, i) => {
    const k = h.spotId || h.drillId || h.id;
    if (k && shown[k] == null) shown[k] = { countAgo: i };
  });
  return shown;
}

function unique(arr) { return [...new Set(arr)]; }

function normalizeStreet(s) {
  const map = {
    'ПРЕФЛОП': 'preflop', 'ФЛОП': 'flop', 'ТЁРН': 'turn', 'РИВЕР': 'river'
  };
  const key = String(s || '');
  return map[key] || String(s || '').toLowerCase();
}

function normalizeDifficulty(d) {
  const n = Number(d) || 1;
  if (n <= 3) return n;
  return clamp(n, 1, 5);
}

function stackBucket(bb) {
  if (bb <= 12) return 'short';
  if (bb <= 40) return 'mid';
  return 'deep';
}

function decisionTypeFromTask(t) {
  if (t.correct) return decisionType([t.correct], t.correct);
  if (t.options && t.options.length) return decisionType(t.options, t.correct);
  return null;
}

function decisionType(actions, correct) {
  const c = String(correct || '');
  if (c.includes('РЕЙЗ') || c.includes('3-БЕТ') || c.includes('4-БЕТ')) return 'raise';
  if (c.includes('ОЛЛ')) return 'all_in';
  if (c.includes('КОЛЛ')) return 'call';
  if (c.includes('ЧЕК')) return 'check';
  if (c.includes('ФОЛД')) return 'fold';
  if (c.includes('СТАВКА')) return 'bet';
  return null;
}

function icmPressure(stage) {
  const s = String(stage || '');
  if (s.includes('БАББЛ') || s.includes('BUBBLE')) return 1;
  if (s.includes('ФИНАЛЬНЫЙ') || s.includes('ITM')) return 0.7;
  if (s.includes('ПОЗДНЯЯ')) return 0.4;
  return 0;
}

function icmFromTags(tags) {
  const t = (tags || []).join(' ').toLowerCase();
  if (t.includes('icm') || t.includes('баббл') || t.includes('bubble')) return 0.8;
  if (t.includes('pko') || t.includes('баунти')) return 0.5;
  return 0;
}

function isExploitTask(t) {
  const concat = [t.concept, ...(t.tags || []), t.opp && t.opp.name].join(' ').toLowerCase();
  return /эксплойт|exploit|нит|station|маниак|любитель|nit|maniac|lover/.test(concat);
}

export function deriveSkillTags(t) {
  const tags = new Set();
  const concat = [t.concept, ...(t.tags || []), t.street, t.stage, t.position]
    .map((x) => String(x || '').toLowerCase()).join(' ');

  for (const rule of CONCEPT_SKILL_RULES) {
    const streetOk = !rule.street || rule.street.test(concat);
    if (rule.pattern.test(concat) && streetOk) {
      for (const skill of rule.skills) tags.add(skill);
    }
  }

  for (const [key, skills] of Object.entries(CONCEPT_TO_SKILLS)) {
    if (concat.includes(key)) {
      for (const skill of skills) tags.add(skill);
    }
  }

  const heroStack = t.heroStack != null ? Number(t.heroStack) : (t.effStack != null ? Number(t.effStack) : null);
  if (heroStack != null && heroStack <= 15) {
    tags.add('shortStack');
    tags.add('stackDepthAwareness');
  } else if (heroStack != null && heroStack <= 25) {
    tags.add('stackDepthAwareness');
  }

  if (/rfi|open|оупен|steal|стил/.test(concat) && /btn|co|hj|sb|баттон/.test(concat)) {
    tags.add('positionAwareness');
  }

  if (/bubble|баббл|icm|itm|финальн|pko/.test(concat) && /push|пуш|steal|стил|open|оупен/.test(concat)) {
    tags.add('shortStack');
    tags.add('icm');
    tags.add('positionAwareness');
    tags.add('stackDepthAwareness');
  }

  const leak = mapLeakConceptForTask(t);
  if (leak) {
    for (const sk of skillsForConcept(leak)) tags.add(sk);
  }

  if (/префлоп|preflop/.test(concat) && !tags.has('postflop') && !tags.has('river')) {
    if ([...tags].some((s) => ['preflop', 'shortStack', 'icm'].includes(s)) === false && /defen|защит|3-bet|3-бет|rfi|open/.test(concat)) {
      tags.add('preflop');
    }
  }
  if (/флоп|flop|тёрн|turn/.test(concat)) tags.add('postflop');
  if (/ривер|river/.test(concat)) tags.add('river');

  return [...tags];
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export { DEFAULTS, skillLabelRu, errorCauseLabelRu };
