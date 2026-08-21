// Phase 13: training quality audit harness.
// Measurement only — does not change personalization, UI, or task content.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { createTrainingStore } from '../src/training/trainingStore.js';
import { getTaskPool, getTaskById, loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import { deriveSkillTags } from '../src/training/planner.js';
import {
  buildProfileDailyPlan,
  recordTrainingResult,
  buildPersonalizedSessionAsync
} from '../src/training/personalizedTraining.js';
import { drillFromLibraryTask, libraryTaskToBrainSpot, choiceToActionType, explanationMatchesTask } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { contentFingerprint, isTooSimilar } from '../src/training/sessionDiversity.js';
import { validateTask } from '../../task-context/validator.js';
import { rebuildSkillProfileFromStore } from '../src/training/dynamicPlayerProfile.js';
import { getTargetDifficulty } from '../src/training/adaptiveDifficulty.js';
import {
  buildPlayerStore,
  alignMasteryReviewsBeforePlan
} from '../src/training/playerDifferentiationFixtures.js';
import { buildDynamicPlayerStore } from '../src/training/dynamicPlayerFixtures.js';
import { drillViewModel } from '../../training-ui/viewModel.js';

export const AUDIT_SESSION_COUNT = 100;
export const SESSIONS_PER_PROFILE = 10;
export const TASKS_PER_SESSION = 7;
export const AUDIT_NOW0 = 1_780_000_000_000;
export const SESSION_GAP_MS = 3_600_000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
}

function tasksWithSkill(pool, skill) {
  return pool.filter((t) => deriveSkillTags(t).includes(skill));
}

function recordOnTasks(store, tasks, { grade, evLossBb, count, startAt }) {
  let now = startAt;
  if (!tasks.length) return now;
  for (let i = 0; i < count; i++) {
    const task = tasks[i % tasks.length];
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade, evLossBb, now });
    now += 1;
  }
  return now;
}

function buildCustomStore(profileId, seed, recorder) {
  const store = createTrainingStore({ storage: memoryStorage(), prefix: `audit_${profileId}_` });
  store.savePersonalizationSeed(seed);
  recorder(store, getTaskPool());
  return store;
}

export function buildAuditProfiles() {
  const pool = getTaskPool();
  const icm = tasksWithSkill(pool, 'icm');
  const shortStack = tasksWithSkill(pool, 'shortStack');
  const river = tasksWithSkill(pool, 'river');
  const postflop = pool.filter((t) => t.street === 'flop' || t.street === 'turn');
  const preflop = tasksWithSkill(pool, 'preflop');
  const bluffCatch = tasksWithSkill(pool, 'bluffCatch');
  const all = pool;

  const beginner = buildCustomStore('beginner', 'audit-beginner-low', (store) => {
    recordOnTasks(store, all, { grade: 'MISTAKE', evLossBb: 0.9, count: 80, startAt: 1_000_000_000_000 });
  });
  const advanced = buildCustomStore('advanced', 'audit-advanced-high', (store) => {
    recordOnTasks(store, all, { grade: 'EXCELLENT', evLossBb: 0.01, count: 220, startAt: 1_000_000_000_000 });
  });
  const shortWeak = buildCustomStore('shortWeak', 'audit-short-stack-weak', (store) => {
    let now = 1_000_000_000_000;
    now = recordOnTasks(store, shortStack, { grade: 'MISTAKE', evLossBb: 0.94, count: 180, startAt: now });
    now = recordOnTasks(store, preflop.filter((t) => !deriveSkillTags(t).includes('shortStack')), {
      grade: 'EXCELLENT', evLossBb: 0.02, count: 80, startAt: now
    });
    recordOnTasks(store, river, { grade: 'EXCELLENT', evLossBb: 0.02, count: 60, startAt: now });
  });
  const mixed = buildCustomStore('mixed', 'audit-mixed-intermediate', (store) => {
    let now = 1_000_000_000_000;
    now = recordOnTasks(store, preflop, { grade: 'GOOD', evLossBb: 0.12, count: 40, startAt: now });
    now = recordOnTasks(store, postflop, { grade: 'MISTAKE', evLossBb: 0.55, count: 40, startAt: now });
    now = recordOnTasks(store, river, { grade: 'GOOD', evLossBb: 0.18, count: 30, startAt: now });
    recordOnTasks(store, icm, { grade: 'EXCELLENT', evLossBb: 0.03, count: 24, startAt: now });
  });

  return {
    icmWeak: { id: 'icmWeak', kind: 'weakness', weakSkills: ['icm', 'shortStack'], store: buildPlayerStore('A') },
    riverWeak: { id: 'riverWeak', kind: 'weakness', weakSkills: ['river', 'bluffCatch', 'postflop'], store: buildPlayerStore('B') },
    strongBalanced: { id: 'strongBalanced', kind: 'strong', weakSkills: [], store: buildPlayerStore('C') },
    beginner: { id: 'beginner', kind: 'beginner', weakSkills: ['preflop', 'postflop', 'river', 'icm'], store: beginner },
    advanced: { id: 'advanced', kind: 'advanced', weakSkills: [], store: advanced },
    newUser: { id: 'newUser', kind: 'new', weakSkills: [], store: buildDynamicPlayerStore('D') },
    decliningIcm: { id: 'decliningIcm', kind: 'weakness', weakSkills: ['icm'], store: buildDynamicPlayerStore('B') },
    improvingPostflop: { id: 'improvingPostflop', kind: 'improving', weakSkills: [], store: buildDynamicPlayerStore('A') },
    shortWeak: { id: 'shortWeak', kind: 'weakness', weakSkills: ['shortStack', 'stackDepthAwareness'], store: shortWeak },
    mixed: { id: 'mixed', kind: 'mixed', weakSkills: ['postflop'], store: mixed }
  };
}

function topWeakSkills(store, limit = 3) {
  const profile = rebuildSkillProfileFromStore(store, { now: AUDIT_NOW0, history: store.loadHistory() })
    || (typeof store.loadSkillProfile === 'function' ? store.loadSkillProfile() : null);
  if (!profile || !profile.skills) return [];
  return Object.values(profile.skills)
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.skill);
}

function overallScore(store) {
  const profile = typeof store.loadSkillProfile === 'function' ? store.loadSkillProfile() : null;
  return profile && profile.overall != null ? profile.overall : null;
}

function failSkillsForProfile(profile) {
  if (profile.kind === 'beginner') return ['preflop', 'postflop', 'river', 'icm', 'shortStack', 'bluffCatch', 'bluffing'];
  if (profile.kind === 'advanced' || profile.kind === 'strong') return [];
  return profile.weakSkills || [];
}

function wrongChoice(task) {
  return (task.options || []).find((c) => c !== task.correct && !(task.alsoOk || []).includes(c))
    || (task.options || []).find((c) => c !== task.correct)
    || task.correct;
}

function answerForProfile(profile, task) {
  const tags = deriveSkillTags(task);
  const fail = failSkillsForProfile(profile);
  if (profile.kind === 'mixed') {
    return tags.includes('postflop') ? wrongChoice(task) : task.correct;
  }
  if (profile.kind === 'new' || profile.kind === 'improving') {
    return tags.includes('icm') ? wrongChoice(task) : task.correct;
  }
  if (fail.length && tags.some((t) => fail.includes(t))) return wrongChoice(task);
  return task.correct;
}

function libraryTaskToSwipe(task) {
  return libraryTaskToBrainSpot(task) || {};
}

let _brain = null;
function loadPokerBrain() {
  if (_brain) return _brain;
  const previous = {
    version: '17',
    gradeDecision: (spot, action) => ({
      grade: 'y', actionGrade: 'y', sizeGrade: null, action: String(action || '').toUpperCase(),
      actionFrequency: 0.4, topActions: [], score: 50, concept: spot.concept || 'unknown',
      explanation: spot.why || '', source: 'EXACT_REFERENCE_NODE', confidence: 80
    }),
    analyzeHand: () => ({ result: {} }),
    handBucket: () => 'TOP_PAIR'
  };
  const context = { window: { PokerBrain: previous }, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'poker_brain_v33.js'), 'utf8'), context);
  _brain = context.window.PokerBrainV33;
  return _brain;
}

const BOARD_LEN = { ПРЕФЛОП: 0, ФЛОП: 3, ТЁРН: 4, РИВЕР: 5 };
const STREET_EN = { ПРЕФЛОП: 'preflop', ФЛОП: 'flop', ТЁРН: 'turn', РИВЕР: 'river' };

function tableSeats(table) {
  if (String(table).includes('HU')) return 2;
  const m = String(table || '').match(/(\d+)/);
  return m ? Number(m[1]) : 6;
}

function deadMoneyBb(task) {
  const blinds = task.blinds || [];
  if (blinds.length !== 2 || !(blinds[1] > 0)) return null;
  const [sb, bb] = blinds;
  return sb / bb + 1 + tableSeats(task.table) * ((task.ante || 0) / bb);
}

function lastHistory(task) {
  const h = task.history || [];
  return h.length ? String(h[h.length - 1].text || '') : '';
}

function allHistory(task) {
  return (task.history || []).map((h) => h.text || '').join(' | ');
}

function facingKind(task) {
  const last = lastHistory(task);
  const all = `${allHistory(task)} ${task.question || ''}`;
  const lastIsCheck = /чек/i.test(last) && !/ставит|рейз|3-бет|4-бет|трибет|пуш|олл-ин|открыл/i.test(last);
  if (lastIsCheck) return 'checked_to';
  if (/ставит|овербет|3-бетил|трибетил|4-бет|запушил|сквизнул|сквиз/i.test(last)) return 'facing_bet';
  if (/открыл/i.test(last) && (task.position === 'BB' || task.position === 'SB' || /против открытия|против 3-бет|против пуш/i.test(task.question || ''))) {
    return 'facing_bet';
  }
  if (task.street === 'ПРЕФЛОП') {
    if (/все до тебя сфолдил|первый в раздаче|до тебя все сфолдил|все до SB сфолдил|до тебя нет открытий/i.test(all)) {
      return 'unopened';
    }
    if (/открыл|3-бет|4-бет|запушил|сквиз|трибет|залимповал/i.test(all) && /против|BB|баттон против|в BB/i.test(all + (task.question || ''))) {
      return 'facing_bet';
    }
    if (/открывает олл-ин|открывает при|открывает\./i.test(all) && task.position !== 'BB') return 'unopened';
    if (/3-бет|трибет|4-бет|запушил|против пуш|против 3-бет/i.test(task.question || '')) return 'facing_bet';
    return 'unopened';
  }
  if (/все проверяют до тебя/i.test(all)) return 'checked_to';
  return 'checked_to';
}


function illegalActionIssues(task) {
  const kind = facingKind(task);
  const opts = task.options || [];
  const issues = [];
  const has = (x) => opts.includes(x);
  if (kind === 'facing_bet') {
    if (has('ЧЕК')) issues.push('check_facing_bet');
    if (has('СТАВКА')) issues.push('bet_not_raise_facing_bet');
  }
  if (kind === 'checked_to') {
    if (has('КОЛЛ')) issues.push('call_when_checked_to');
    if (has('ФОЛД') && task.street !== 'ПРЕФЛОП') issues.push('fold_when_checked_to');
  }
  if (kind === 'unopened') {
    if (has('КОЛЛ') && !/лимп|complete/i.test(allHistory(task))) issues.push('call_unopened');
    if (has('ЧЕК') && task.position !== 'BB') issues.push('check_unopened_preflop');
  }
  return issues;
}

function parseBb(n) {
  return Number(String(n).replace(',', '.'));
}

function potIssues(task) {
  const issues = [];
  const hist = allHistory(task);
  const last = lastHistory(task);
  const dead = deadMoneyBb(task);
  if (!(task.pot > 0)) issues.push('non_positive_pot');
  if (dead && task.street === 'ПРЕФЛОП' && facingKind(task) === 'unopened') {
    const ratio = task.pot / dead;
    if (ratio > 3.2 || ratio < 0.35) issues.push(`unopened_pot_vs_dead:${task.pot}/${dead.toFixed(2)}`);
  }
  const lastFacing = Math.max(0, ...[...last.matchAll(/(\d+(?:[.,]\d+)?)\s*ББ/gi)].map((m) => parseBb(m[1])));
  const completed = [];
  for (const re of [
    /открыл\s+(\d+(?:[.,]\d+)?)/gi,
    /3-бетил\s+(\d+(?:[.,]\d+)?)/gi,
    /трибетил\s+(\d+(?:[.,]\d+)?)/gi,
    /4-бетил\s+(\d+(?:[.,]\d+)?)/gi,
    /сквиз(?:ил|нул)?\s+(\d+(?:[.,]\d+)?)/gi
  ]) {
    for (const m of hist.matchAll(re)) completed.push(parseBb(m[1]));
  }
  const prior = completed.filter((n) => n + 0.01 < lastFacing || lastFacing === 0);
  const maxPrior = prior.length ? Math.max(...prior) : 0;
  if (maxPrior >= 8 && task.pot < maxPrior * 0.4) {
    issues.push(`pot_missing_prior_raise:${maxPrior}BB_vs_pot_${task.pot}`);
  }
  if (dead && maxPrior >= 2 && task.pot <= dead + 0.2 && /3-бет|4-бет|трибет|сквиз/i.test(hist)) {
    issues.push(`pot_still_dead_money_after_raise:${task.pot}`);
  }
  const pots = (task.history || []).map((h) => h.pot).filter((n) => Number.isFinite(n));
  for (let i = 1; i < pots.length; i++) {
    if (pots[i] + 1e-9 < pots[i - 1]) issues.push('history_pot_decreased');
  }
  if (pots.length && task.pot + 0.15 < pots[pots.length - 1]) issues.push('spot_pot_below_history');
  return issues;
}

function stackIssues(task) {
  const issues = [];
  if (!(task.heroStack > 0)) issues.push('non_positive_hero_stack');
  if (!(task.villainStack > 0)) issues.push('non_positive_villain_stack');
  if (task.effStack > Math.min(task.heroStack, task.villainStack) + 1e-6) issues.push('eff_stack_gt_min_stack');
  return issues;
}

function isNearDuplicatePair(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (isTooSimilar(a, b)) return true;
  const ha = (a.hero || []).slice().sort().join();
  const hb = (b.hero || []).slice().sort().join();
  if (a.street === b.street && ha && ha === hb && a.position === b.position) return true;
  return false;
}

function boardIssues(task) {
  const issues = [];
  const need = BOARD_LEN[task.street];
  if (need == null) issues.push(`unknown_street:${task.street}`);
  else if ((task.board || []).length !== need) issues.push(`board_len_${(task.board || []).length}_expected_${need}`);
  return issues;
}

function explanationMatch(task) {
  return explanationMatchesTask(task);
}

const ALLOWED_LATIN = /\b(EV|ICM|SPR|VPIP|PFR|MTT|PKO|SNG|HU|BB|BTN|SB|CO|HJ|MP|UTG|AA|KK|QQ|JJ|TT|AK|AQ|AJ|AT|KQ|ITM)\b/g;

function terminologyIssues(task) {
  const text = [task.question, task.explain, ...(task.history || []).map((h) => h.text), task.concept]
    .join(' \n ');
  const issues = [];
  if (/батон(?!н)/i.test(text)) issues.push('батон_vs_баттон');
  if (/блафф/i.test(text) && /блеф/i.test(text)) issues.push('блафф_and_блеф_mixed');
  if (/check-check/i.test(text)) issues.push('english_check-check');
  const stripped = text.replace(ALLOWED_LATIN, ' ');
  const english = stripped.match(/\b[A-Za-z]{3,}\b/g) || [];
  const interesting = english.filter((w) => !/^(vs|BB|BTN|left)$/i.test(w));
  if (interesting.length) issues.push(`latin_user_text:${[...new Set(interesting)].slice(0, 6).join(',')}`);
  return issues;
}

function inspectSpot(task) {
  const issues = [];
  const schema = validateTask(task);
  for (const e of schema.errors || []) issues.push({ severity: 'invalid', code: 'schema', detail: e });
  for (const w of schema.warn || []) issues.push({ severity: 'warn', code: 'schema_warn', detail: w });

  for (const code of boardIssues(task)) issues.push({ severity: 'invalid', code, detail: code });
  for (const code of illegalActionIssues(task)) issues.push({ severity: 'invalid', code, detail: code });
  for (const code of potIssues(task)) issues.push({ severity: 'invalid', code, detail: code });
  for (const code of stackIssues(task)) issues.push({ severity: 'invalid', code, detail: code });

  if (task.position && task.villain && task.position === task.villain) {
    issues.push({ severity: 'invalid', code: 'hero_villain_same_seat', detail: task.position });
  }
  if (!(task.options || []).includes(task.correct)) {
    issues.push({ severity: 'invalid', code: 'correct_not_in_options', detail: task.correct });
  }

  const types = (task.options || []).map(choiceToActionType);
  if (new Set(types).size < types.length) {
    issues.push({ severity: 'grading', code: 'library_drill_action_collision', detail: types.join(',') });
  }

  const exp = explanationMatch(task);
  if (!exp.ok) issues.push({ severity: 'warn', code: 'explain_mismatch', detail: exp.reason });

  for (const code of terminologyIssues(task)) {
    issues.push({ severity: 'term', code: 'terminology', detail: code });
  }

  if (/ошибка ввода/i.test(allHistory(task))) {
    issues.push({ severity: 'invalid', code: 'authoring_error_in_history', detail: lastHistory(task) });
  }

  return issues;
}

function brainContextReport(task) {
  const Brain = loadPokerBrain();
  const swipe = libraryTaskToSwipe(task);
  const ctx = Brain.contextForSpot(swipe);
  return {
    productionScore: ctx.score,
    fullScore: ctx.score,
    productionMissing: ctx.missing || [],
    fullMissing: ctx.missing || [],
    assumptions: ctx.assumptions || []
  };
}

function weaknessHit(task, weakSkills) {
  if (!weakSkills.length) return true;
  const tags = deriveSkillTags(task);
  return tags.some((t) => weakSkills.includes(t));
}

function difficultyMismatch(task, store, weakSkills) {
  const profile = store.loadSkillProfile && store.loadSkillProfile();
  if (!profile) return false;
  const skill = (deriveSkillTags(task)[0]) || 'preflop';
  const info = getTargetDifficulty(profile, skill);
  const d = task.difficulty || 1;
  if (info.max != null && d > info.max + 1.01) return true;
  if (info.min != null && d < info.min - 1.01) return true;
  const overall = profile.overall;
  if (overall != null && overall >= 85 && d <= 1) return true;
  if (overall != null && overall <= 40 && d >= 5 && !weakSkills.length) return true;
  return false;
}

async function generateSession(store, { count, now }) {
  const plan = buildProfileDailyPlan({ store, count, now });
  if (!plan || !plan.filled) {
    return { plan, drills: [], source: 'empty' };
  }
  const session = await buildPersonalizedSessionAsync({
    store,
    count,
    now,
    preparedPlan: plan,
    solve: () => ({ decisions: [] })
  });
  return session;
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

export async function runTrainingQualityAudit({
  sessions = AUDIT_SESSION_COUNT,
  perProfile = SESSIONS_PER_PROFILE,
  count = TASKS_PER_SESSION
} = {}) {
  const profiles = buildAuditProfiles();
  const profileIds = Object.keys(profiles);
  const expected = profileIds.length * perProfile;
  if (expected !== sessions) {
    throw new Error(`Profile/session math: ${profileIds.length} x ${perProfile} = ${expected}, wanted ${sessions}`);
  }

  const allTasks = [];
  const allSessions = [];
  const invalid = [];
  const grading = [];
  const termNotes = [];
  const explainMiss = [];
  const brainLow = [];
  const mismatches = [];
  const diffMismatches = [];
  const skillSet = new Set();
  const diffDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const intraDupSessions = [];
  const intraNearSessions = [];
  let advancedHard = 0;
  let advancedTotal = 0;
  let beginnerEasy = 0;
  let beginnerTotal = 0;
  let vmErrors = 0;
  let personalizedSessions = 0;
  const after20 = {};

  for (const pid of profileIds) {
    const profile = profiles[pid];
    const store = profile.store;
    alignMasteryReviewsBeforePlan(store, AUDIT_NOW0);
    const liveWeak = topWeakSkills(store, 3);
    const weakSkills = (profile.weakSkills && profile.weakSkills.length) ? profile.weakSkills : liveWeak;
    profile.resolvedWeak = weakSkills;
    profile.overall0 = overallScore(store);

    for (let s = 0; s < perProfile; s++) {
      const now = AUDIT_NOW0 + s * SESSION_GAP_MS;
      const session = await generateSession(store, { count, now });
      const drills = session.drills || [];
      const tasks = drills.map((d) => {
        const id = d.sourceTaskId || d.metadata?.taskId;
        return getTaskById(id) || d.metadata?.task || null;
      }).filter(Boolean);

      if (session.personalized || (session.plan && session.plan.personalized)) personalizedSessions++;

      const ids = tasks.map((t) => t.id);
      const unique = new Set(ids);
      if (unique.size < ids.length) intraDupSessions.push({ profile: pid, session: s, ids });

      let near = 0;
      for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
          if (isNearDuplicatePair(tasks[i], tasks[j]) || contentFingerprint(tasks[i]) === contentFingerprint(tasks[j])) {
            near++;
          }
        }
      }
      if (near) intraNearSessions.push({ profile: pid, session: s, near });

      const rec = {
        profileId: pid,
        index: s,
        now,
        filled: drills.length,
        personalized: !!(session.personalized || session.plan?.personalized),
        source: session.source,
        taskIds: ids,
        difficulties: tasks.map((t) => t.difficulty),
        skills: [...new Set(tasks.flatMap((t) => deriveSkillTags(t)))]
      };
      allSessions.push(rec);

      for (const task of tasks) {
        allTasks.push({ profileId: pid, session: s, task });
        for (const tag of deriveSkillTags(task)) skillSet.add(tag);
        diffDist[task.difficulty] = (diffDist[task.difficulty] || 0) + 1;

        if (profile.kind === 'advanced' || profile.kind === 'strong') {
          advancedTotal++;
          if ((task.difficulty || 0) >= 4) advancedHard++;
        }
        if (profile.kind === 'beginner') {
          beginnerTotal++;
          if ((task.difficulty || 0) <= 3) beginnerEasy++;
        }

        const issues = inspectSpot(task);
        for (const issue of issues) {
          if (issue.severity === 'invalid') invalid.push({ id: task.id, profile: pid, ...issue });
          else if (issue.severity === 'grading') grading.push({ id: task.id, profile: pid, ...issue });
          else if (issue.severity === 'term') termNotes.push({ id: task.id, profile: pid, ...issue });
          else if (issue.code === 'explain_mismatch') explainMiss.push({ id: task.id, correct: task.correct, explain: task.explain });
        }

        if (profile.kind === 'weakness' || profile.kind === 'beginner' || profile.kind === 'mixed') {
          if (!weaknessHit(task, weakSkills)) {
            mismatches.push({ id: task.id, profile: pid, tags: deriveSkillTags(task), weakSkills });
          }
        }
        if (difficultyMismatch(task, store, weakSkills)) {
          diffMismatches.push({ id: task.id, profile: pid, difficulty: task.difficulty, overall: overallScore(store) });
        }

        try {
          const brain = brainContextReport(task);
          if (brain.productionScore < 70 || brain.productionMissing.includes('формат/число игроков') || brain.productionMissing.includes('стадия/ICM-контекст') || brain.productionMissing.includes('действия до решения')) {
            brainLow.push({ id: task.id, ...brain });
          }
        } catch (e) {
          brainLow.push({ id: task.id, error: String(e.message || e) });
        }

        try {
          const gen = drillFromLibraryTask(task);
          drillViewModel({ drill: gen.drill, index: 1, total: 7 });
        } catch (e) {
          vmErrors++;
        }

        const gen = drillFromLibraryTask(task);
        if (gen.ok) {
          const chosen = answerForProfile(profile, task);
          const opt = (gen.drill.options || []).find((o) => o.labelRu === chosen);
          const graded = gradeAnswer({ drill: gen.drill, chosenId: opt ? opt.id : null });
          recordTrainingResult(store, {
            drill: gen.drill,
            grade: graded.grade,
            evLossBb: graded.evLossBb,
            now: now + s + 1
          });
        }
      }

      if (s === 2) {
        after20[pid] = {
          weak: topWeakSkills(store, 3),
          overall: overallScore(store),
          nextPlanSkills: null
        };
      }
      if (s === 3 && after20[pid]) {
        after20[pid].nextPlanSkills = rec.skills;
        after20[pid].nextTaskIds = rec.taskIds;
      }
    }
    profile.overallEnd = overallScore(store);
    profile.weakEnd = topWeakSkills(store, 3);
  }

  const total = allTasks.length;
  const idCounts = new Map();
  for (const row of allTasks) idCounts.set(row.task.id, (idCounts.get(row.task.id) || 0) + 1);
  const corpusRepeats = [...idCounts.values()].reduce((s, n) => s + Math.max(0, n - 1), 0);
  const corpusReuseRate = pct(corpusRepeats, total);

  let playerRepeats = 0;
  const perPlayerSeen = {};
  for (const row of allTasks) {
    if (!perPlayerSeen[row.profileId]) perPlayerSeen[row.profileId] = new Set();
    if (perPlayerSeen[row.profileId].has(row.task.id)) playerRepeats++;
    else perPlayerSeen[row.profileId].add(row.task.id);
  }
  const duplicateRate = pct(playerRepeats, total);

  let nearTaskFlags = 0;
  for (const rec of allSessions) {
    const tasks = rec.taskIds.map((id) => getTaskById(id)).filter(Boolean);
    const flagged = new Set();
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        if (isNearDuplicatePair(tasks[i], tasks[j])) {
          flagged.add(tasks[i].id);
          flagged.add(tasks[j].id);
        }
      }
    }
    nearTaskFlags += flagged.size;
  }
  const nearDuplicateRate = pct(nearTaskFlags, total);

  const weaknessEligible = allTasks.filter((row) => {
    const p = profiles[row.profileId];
    return p.kind === 'weakness' || p.kind === 'beginner' || p.kind === 'mixed';
  }).length;
  const mismatchRate = pct(mismatches.length, weaknessEligible || 1);

  const invalidUnique = [...new Set(invalid.map((x) => x.id))];
  const gradingUnique = [...new Set(grading.map((x) => x.id))];
  const termUnique = [...new Set(termNotes.map((x) => x.id))];
  const explainRate = pct(total - explainMiss.length, total);
  const brainIssueRate = pct(brainLow.length, total);
  const advancedHardRate = pct(advancedHard, advancedTotal || 1);
  const beginnerEasyRate = pct(beginnerEasy, beginnerTotal || 1);

  const personalizationAfter20 = {};
  for (const pid of Object.keys(after20)) {
    const p = profiles[pid];
    const info = after20[pid];
    const nextHits = (info.nextPlanSkills || []).some((sk) => (info.weak || p.resolvedWeak || []).includes(sk));
    personalizationAfter20[pid] = {
      weakAfter20: info.weak,
      overallAfter20: info.overall,
      nextSessionHitsWeakness: nextHits,
      nextSkills: info.nextPlanSkills
    };
  }

  const icmIds = allSessions.filter((s) => s.profileId === 'icmWeak').flatMap((s) => s.taskIds);
  const riverIds = allSessions.filter((s) => s.profileId === 'riverWeak').flatMap((s) => s.taskIds);
  const overlapAB = icmIds.filter((id) => riverIds.includes(id)).length;

  const pokerLogicPass = invalidUnique.length === 0;
  const duplicatesPass = duplicateRate <= 35 && nearDuplicateRate <= 15;
  const personalizationPass = mismatchRate <= 45
    && Object.values(personalizationAfter20).filter((x) => x.nextSessionHitsWeakness).length >= 3
    && overlapAB < Math.min(icmIds.length, riverIds.length) * 0.85;
  const trainingQualityPass = pokerLogicPass
    && duplicatesPass
    && explainRate >= 100
    && advancedHardRate >= 25
    && beginnerEasyRate >= 70
    && skillSet.size >= 8
    && vmErrors === 0
    && gradingUnique.length === 0
    && brainIssueRate === 0
    && termUnique.length <= total * 0.25;

  const p0 = [];
  if (invalidUnique.length) {
    const byCode = {};
    for (const x of invalid) byCode[x.code] = (byCode[x.code] || 0) + 1;
    const top = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 8);
    p0.push(`Fix ${invalidUnique.length} invalid poker spots (top: ${top.map(([c, n]) => `${c}×${n}`).join(', ')})`);
  }
  if (gradingUnique.length) {
    p0.push(`Stop mapping RAISE / 3-BET / 4-BET / ALL-IN / BET to the same action type in libraryDrill (${grading.length} graded collisions across ${gradingUnique.length} task ids)`);
  }
  if (brainIssueRate >= 50) {
    p0.push('Pass format, stage, and full action history into Poker Brain (libraryTaskToSwipe currently sends only the first history line and omits tournament context)');
  }
  if (beginnerEasyRate < 70) {
    p0.push(`Stop serving L4–L5 spots to beginners (L1–L3 share is ${beginnerEasyRate}%)`);
  }
  if (mismatchRate > 45) {
    p0.push(`Lower profile-to-task mismatch (currently ${mismatchRate}% on weakness-focused profiles)`);
  }
  if (advancedHardRate < 25) {
    p0.push(`Give advanced/strong profiles genuinely hard spots (L4–L5 share is ${advancedHardRate}%)`);
  }
  if (termUnique.length > 20) {
    p0.push('Normalize Russian poker terms (батон/баттон, блафф/блеф, leftover English in user-facing copy)');
  }
  if (explainMiss.length > 15) {
    p0.push('Make explanations name the recommended action');
  }
  const authoring = invalid.filter((x) => x.code === 'authoring_error_in_history');
  if (authoring.length) p0.push('Remove authoring leftovers such as «ошибка ввода» from task history');
  if (duplicateRate > 35) {
    p0.push(`Reduce same-player task reuse across sequential sessions (currently ${duplicateRate}%)`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sessions: allSessions.length,
    tasks: total,
    profiles: profileIds.length,
    TRAINING_QUALITY: trainingQualityPass ? 'PASS' : 'FAIL',
    POKER_LOGIC: pokerLogicPass ? 'PASS' : 'FAIL',
    PERSONALIZATION_QUALITY: personalizationPass ? 'PASS' : 'FAIL',
    DUPLICATES: duplicateRate,
    NEAR_DUPLICATES: nearDuplicateRate,
    PROFILE_MISMATCH: mismatchRate,
    INVALID_SPOTS: invalidUnique.length,
    TESTS: null,
    NEXT_P0_FIXES: p0,
    detail: {
      skillCoverage: [...skillSet].sort(),
      skillCoverageCount: skillSet.size,
      difficultyDistribution: diffDist,
      intraSessionExactDupSessions: intraDupSessions.length,
      intraSessionNearDupSessions: intraNearSessions.length,
      corpusReuseRate,
      uniqueTaskIds: idCounts.size,
      gradingCollisionTasks: grading.length,
      gradingCollisionUnique: gradingUnique.length,
      explainMatchRate: explainRate,
      terminologyTaskCount: termUnique.length,
      brainContextIssueRate: brainIssueRate,
      brainContextIssueCount: brainLow.length,
      advancedHardRate,
      beginnerEasyRate,
      personalizedSessions,
      vmErrors,
      weaknessEligible,
      mismatchCount: mismatches.length,
      difficultyMismatchCount: diffMismatches.length,
      invalidByCode: invalid.reduce((m, x) => (m[x.code] = (m[x.code] || 0) + 1, m), {}),
      invalidSamples: invalidUnique.slice(0, 25),
      explainMissSamples: explainMiss.slice(0, 10).map((x) => x.id),
      termSamples: termUnique.slice(0, 12),
      brainMissingCommon: topMissing(brainLow),
      personalizationAfter20,
      profileOverall: Object.fromEntries(profileIds.map((id) => [id, {
        start: profiles[id].overall0,
        end: profiles[id].overallEnd,
        weakStart: profiles[id].resolvedWeak,
        weakEnd: profiles[id].weakEnd,
        kind: profiles[id].kind
      }])),
      icmVsRiverOverlap: overlapAB,
      sampleSession: allSessions[0],
      sampleAdvanced: allSessions.find((s) => s.profileId === 'advanced'),
      sampleBeginner: allSessions.find((s) => s.profileId === 'beginner')
    }
  };

  return report;
}

function topMissing(brainLow) {
  const counts = {};
  for (const row of brainLow) {
    for (const m of row.productionMissing || []) counts[m] = (counts[m] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

export function formatAuditReport(report, testResult = 'n/a') {
  const lines = [
    'TRAINING QUALITY: ' + report.TRAINING_QUALITY,
    'POKER LOGIC: ' + report.POKER_LOGIC,
    'PERSONALIZATION QUALITY: ' + report.PERSONALIZATION_QUALITY,
    'DUPLICATES: ' + report.DUPLICATES + '%',
    'NEAR-DUPLICATES: ' + report.NEAR_DUPLICATES + '%',
    'PROFILE MISMATCH: ' + report.PROFILE_MISMATCH + '%',
    'INVALID SPOTS: ' + report.INVALID_SPOTS,
    'TESTS: ' + (report.TESTS || testResult),
    'NEXT P0 FIXES:'
  ];
  for (const fix of report.NEXT_P0_FIXES) lines.push('- ' + fix);
  if (!report.NEXT_P0_FIXES.length) lines.push('- none');
  lines.push('');
  lines.push(`Sessions: ${report.sessions}  Tasks: ${report.tasks}  Profiles: ${report.profiles}`);
  lines.push(`Skill coverage: ${report.detail.skillCoverageCount} (${report.detail.skillCoverage.join(', ')})`);
  lines.push(`Difficulty distribution: ${JSON.stringify(report.detail.difficultyDistribution)}`);
  lines.push(`Corpus reuse (cross-profile): ${report.detail.corpusReuseRate}% from ${report.detail.uniqueTaskIds} unique ids`);
  lines.push(`Grading collisions: ${report.detail.gradingCollisionTasks} (${report.detail.gradingCollisionUnique} unique tasks)`);
  lines.push(`Explain match: ${report.detail.explainMatchRate}%`);
  lines.push(`Advanced L4–L5 share: ${report.detail.advancedHardRate}%`);
  lines.push(`Beginner L1–L3 share: ${report.detail.beginnerEasyRate}%`);
  lines.push(`Poker Brain context issues: ${report.detail.brainContextIssueRate}% (${(report.detail.brainMissingCommon || []).map(([k, n]) => `${k}×${n}`).join('; ')})`);
  return lines.join('\n');
}
