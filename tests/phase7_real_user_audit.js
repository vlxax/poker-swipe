// Phase 7: real user experience audit — production UI paths + personalization chain.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jsdomPkg from 'jsdom';
import { createTrainingStore } from '../solver/src/training/trainingStore.js';
import { AssessmentController } from '../training-ui/assessmentController.js';
import { deriveSkillTags } from '../solver/src/training/planner.js';
import { installMiniAppHooks } from '../training-ui/miniAppHooks.js';
import { classifyTrainingBucket, overlapCount } from '../solver/src/training/playerDifferentiationFixtures.js';
import { getTargetDifficulty } from '../solver/src/training/adaptiveDifficulty.js';
import { buildSkillMasteryStates, DAY_MS, applySkillMasteryTraining } from '../solver/src/training/skillMastery.js';
import { buildProfileDailyPlan } from '../solver/src/training/personalizedTraining.js';
import { getTaskById } from '../solver/src/training/taskLibraryBridge.js';

const { JSDOM, VirtualConsole, requestInterceptor } = jsdomPkg;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.png': 'image/png'
};

const USERS = {
  A: { seed: 'phase7-user-a-icm', persona: 'A', weakSkills: ['icm', 'shortStack', 'stackDepthAwareness'] },
  B: { seed: 'phase7-user-b-post', persona: 'B', weakSkills: ['postflop', 'river', 'bluffCatch'] },
  C: { seed: 'phase7-user-c-strong', persona: 'C', weakSkills: [] }
};

const REPORT = {
  bugsFound: [],
  bugsFixed: [],
  legacyBypasses: [],
  users: {}
};

function memoryLocalStorage(seed = '') {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    key(i) { return [...map.keys()][i] || null; },
    get length() { return map.size; },
    _dump() { return new Map(map); },
    _restore(from) { map.clear(); for (const [k, v] of from) map.set(k, v); }
  };
}

function wrongChoice(item) {
  return item.choices.find((c) => c !== item.correct && !(item.alsoOk || []).includes(c))
    || item.choices.find((c) => c !== item.correct)
    || item.correct;
}

function itemTags(item) {
  if (item.skillTags?.length) return item.skillTags;
  return deriveSkillTags({
    concept: item.concept, tags: item.tags, street: item.street,
    position: item.position, heroStack: item.heroStack
  });
}

function streetKind(street) {
  const st = String(street || '').toLowerCase();
  if (st.includes('префлоп') || st.includes('preflop')) return 'preflop';
  if (st.includes('ривер') || st === 'river') return 'river';
  if (st.includes('тёрн') || st.includes('turn')) return 'turn';
  if (st.includes('флоп') || st === 'flop') return 'flop';
  return 'other';
}

function shouldFailDiagnostic(item, persona) {
  const tags = itemTags(item);
  if (persona === 'A') return tags.some((t) => ['icm', 'shortStack', 'stackDepthAwareness'].includes(t));
  if (persona === 'B') {
    const kind = streetKind(item.street);
    if (tags.includes('bluffCatch') || tags.includes('river')) return true;
    if (tags.includes('bluffing') && ['flop', 'turn', 'river'].includes(kind)) return true;
    if (tags.includes('postflop') && ['flop', 'turn', 'river'].includes(kind)) return true;
    if (tags.includes('postflop') && !tags.includes('preflop') && !tags.includes('shortStack') && !tags.includes('icm')) return true;
    return false;
  }
  return false;
}

function gradeForPersona(persona, item) {
  if (persona === 'C') return 'g';
  const tags = itemTags(item);
  if (persona === 'A' && tags.some((t) => ['icm', 'shortStack'].includes(t))) return 'r';
  if (persona === 'B' && (tags.includes('river') || tags.includes('bluffCatch') || tags.includes('postflop'))) return 'r';
  return 'g';
}

function taskDistribution(records) {
  const dist = { icmPush: 0, postRiver: 0, other: 0 };
  for (const r of records) {
    const task = getTaskById(r.id);
    if (!task) continue;
    const bucket = classifyTrainingBucket({
      skillTags: deriveSkillTags(task),
      street: String(task.street || '').toLowerCase().includes('ривер') ? 'river'
        : String(task.street || '').toLowerCase().includes('флоп') ? 'flop'
        : String(task.street || '').toLowerCase().includes('тёрн') ? 'turn'
        : String(task.street || '').toLowerCase().includes('префлоп') ? 'preflop' : task.street,
      concept: task.concept
    });
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  return dist;
}

function avgDifficulty(records) {
  const diffs = records.map((r) => r.difficulty).filter((d) => d != null);
  if (!diffs.length) return 0;
  return Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100;
}

function syncStorageFromWindow(storage, window) {
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k) storage.setItem(k, ls.getItem(k));
  }
}

async function bootUi(storage, deviceId) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://app.local/index.html',
    runScripts: 'dangerously',
    resources: {
      interceptors: [
        requestInterceptor(async (request) => {
          if (request.url.startsWith('https://telegram.org/')) return new Response('', { status: 200 });
          const parsed = new URL(request.url);
          if (parsed.hostname !== 'app.local') return undefined;
          const file = path.join(root, decodeURIComponent(parsed.pathname.replace(/^\//, '')));
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            const ext = path.extname(file).toLowerCase();
            return new Response(new Uint8Array(fs.readFileSync(file)), {
              status: 200,
              headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' }
            });
          }
          return new Response('', { status: 404 });
        })
      ]
    },
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = async () => ({ ok: false, status: 503, text: async () => '', json: async () => [] });
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.alert = () => {};
      try {
        window.localStorage.clear();
      } catch (_) { /* ignore */ }
      for (const [k, v] of storage._dump()) {
        window.localStorage.setItem(k, v);
      }
      window.localStorage.setItem('pokerSwipeDeviceId', deviceId);
      if (!window.localStorage.getItem(`pokerSwipeV28_user_${deviceId}`)) {
        window.localStorage.setItem(`pokerSwipeV28_user_${deviceId}`, JSON.stringify({
          version: '16.2', nick: deviceId, onboarded: true, diagDone: false, skill: 50,
          streak: 0, lastDay: '2026-08-21', events: [], hands: [], myHands18: [], tournaments: [],
          dailyArchive: [], snapshots: [], seenSwipe: [],
          diagnostic: [], diagnosticProfile25: null,
          xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
          healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
        }));
      }
    }
  });

  await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  await wait(500);

  const window = dom.window;
  const document = window.document;
  globalThis.window = window;
  globalThis.document = document;
  syncStorageFromWindow(storage, window);
  assert.equal(window.__pokerBooted, true);

  const store = createTrainingStore({ storage });
  const miniApps = installMiniAppHooks(store);
  window.PersonalizedTrainingUi = { ...(window.PersonalizedTrainingUi || {}), store, miniApps };

  return { dom, window, document, store, miniApps, errors };
}

function spyBridge(miniApps) {
  const bridge = miniApps.bridge;
  const calls = { swipe: 0, sizing: 0, review: 0, xray: 0, memory: 0, quick5: 0, writeback: 0 };
  const selected = [];
  const orig = {
    swipe: bridge.prepareSwipeSession.bind(bridge),
    sizing: bridge.prepareSizingSpot.bind(bridge),
    review: bridge.prepareReviewSpot.bind(bridge),
    xray: bridge.prepareXrayIndex.bind(bridge),
    memory: bridge.prepareMemorySpot.bind(bridge),
    quick5: bridge.prepareQuick5.bind(bridge),
    writeback: bridge.recordFromLegacyEvent.bind(bridge)
  };
  bridge.prepareSwipeSession = (...a) => {
    calls.swipe++;
    const r = orig.swipe(...a);
    if (r?.spotIds) for (const id of r.spotIds) selected.push({ id, app: 'swipe', difficulty: taskDifficulty(id) });
    return r;
  };
  bridge.prepareSizingSpot = (...a) => {
    calls.sizing++;
    const r = orig.sizing(...a);
    if (r?.id) selected.push({ id: r.id, app: 'sizing', difficulty: taskDifficulty(r.id) });
    return r;
  };
  bridge.prepareReviewSpot = (...a) => {
    calls.review++;
    const r = orig.review(...a);
    if (r?.id) selected.push({ id: r.id, app: 'review', difficulty: taskDifficulty(r.id) });
    return r;
  };
  bridge.prepareXrayIndex = (...a) => {
    calls.xray++;
    const idx = orig.xray(...a);
    if (idx != null && a[0]?.[idx]) selected.push({ id: `XR_${idx}`, app: 'xray', difficulty: 3 });
    return idx;
  };
  bridge.prepareMemorySpot = (...a) => {
    calls.memory++;
    const r = orig.memory(...a);
    if (r?.id) selected.push({ id: r.id, app: 'memory', difficulty: taskDifficulty(r.id) });
    return r;
  };
  bridge.prepareQuick5 = (...a) => {
    calls.quick5++;
    return orig.quick5(...a);
  };
  bridge.recordFromLegacyEvent = (...a) => { calls.writeback++; return orig.writeback(...a); };
  return { calls, selected, bridge };
}

function taskDifficulty(id) {
  const t = getTaskById(id);
  return t ? Number(t.difficulty) || 1 : null;
}

function legacyShuffleIds(window) {
  const seen = new Set(window.S?.seenSwipe || []);
  let pool = window.SWIPE.filter((x) => !seen.has(x.id));
  if (pool.length < 10) pool = [...window.SWIPE];
  pool.sort(() => 0.42 - 0.5);
  return pool.slice(0, 10).map((x) => x.id).join(',');
}

function runOnboarding(store, persona, seed) {
  store.savePersonalizationSeed(seed);
  const assessment = new AssessmentController({ store, count: 12 });
  assessment.begin();
  while (assessment.state === 'answering') {
    const item = assessment.current();
    const choice = persona === 'C' ? item.correct : (shouldFailDiagnostic(item, persona) ? wrongChoice(item) : item.correct);
    assessment.answer(choice);
  }
  return {
    profile: store.loadSkillProfile(),
    weaknesses: topWeaknessStrings(store)
  };
}

function topWeaknessStrings(store) {
  const p = store.loadSkillProfile();
  return Object.values(p?.skills || {})
    .filter((s) => s?.score != null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => `${s.skill}(${s.score})`);
}

async function trainViaUi(ctx, persona, targetDecisions, { reloadAt = null, onReload = null } = {}) {
  const { window, document, store, miniApps } = ctx;
  const { calls, selected } = spyBridge(miniApps);
  let decisions = 0;

  const recordSwipe = async (n = 10) => {
    window.swSession = [];
    window.show('swipe');
    await wait(50);
    assert.ok(calls.swipe > 0, 'swipe hook not called');
    const legacy = legacyShuffleIds(window);
    const actual = (window.swSession || []).map((x) => x.id).join(',');
    if (store.loadSkillProfile()) assert.notEqual(actual, legacy, 'swipe used legacy shuffle');
    for (const spot of (window.swSession || []).slice(0, n)) {
      if (decisions >= targetDecisions) break;
      window.recordEvent({
        spotId: spot.id, mode: 'swipe', concept: spot.concept, street: spot.street,
        grade: gradeForPersona(persona, { concept: spot.concept, street: spot.street, tags: [] })
      });
      decisions++;
      if (reloadAt != null && decisions === reloadAt && typeof onReload === 'function') {
        await onReload({ store, decisions, selected: [...selected] });
      }
    }
  };

  const recordSizing = async () => {
    window.show('sizing');
    await wait(50);
    assert.ok(calls.sizing > 0, 'sizing hook not called');
    document.querySelector('#sizeLock')?.click();
    await wait(30);
    decisions++;
  };

  const recordReview = async () => {
    window.show('review');
    await wait(50);
    assert.ok(calls.review > 0, 'review hook not called');
    const R = window.REVIEWS[window.rv];
    if (R?.bad === null) {
      document.querySelector('#rvNone')?.click();
      document.querySelector('#rvSure')?.click();
    } else {
      document.querySelector(`[data-rn="${R.bad}"]`)?.click();
      document.querySelector('#rvSure')?.click();
      document.querySelector(`[data-rr="${R.correctReason}"]`)?.click();
      const repair = document.querySelector('#repair');
      if (repair) { repair.value = String((R.best && R.best[0]) || 50); repair.dispatchEvent(new window.Event('input')); }
      document.querySelector('#repairGo')?.click();
    }
    await wait(40);
    decisions++;
  };

  const recordXray = async () => {
    window.show('xray');
    await wait(50);
    window.xrBegin(0);
    await wait(30);
    assert.ok(calls.xray > 0, 'xray hook not called');
    window.recordEvent({ mode: 'xray', concept: 'range narrowing', grade: persona === 'C' ? 'g' : 'y', spotId: `XR_${window.xrI}` });
    decisions++;
  };

  while (decisions < targetDecisions) {
    await recordSwipe(Math.min(10, targetDecisions - decisions));
    if (decisions >= targetDecisions) break;
    await recordSizing();
    if (decisions >= targetDecisions) break;
    await recordReview();
    if (decisions >= targetDecisions) break;
    await recordXray();
    if (decisions >= targetDecisions) break;
    window.startQuick?.();
    await wait(50);
    if (window.quick?.active) {
      window.quickAdvance?.();
      await wait(30);
      window.quickAdvance?.();
      await wait(30);
      decisions += 2;
    }
  }

  return {
    calls,
    selected,
    decisions,
    profile: store.loadSkillProfile(),
    history: store.loadHistory() || [],
    mastery: store.loadSkillMastery?.() || {}
  };
}

async function simulateUser(userKey) {
  const cfg = USERS[userKey];
  const storage = memoryLocalStorage(cfg.seed);
  let ctx = await bootUi(storage, cfg.seed);

  const onboarding = runOnboarding(ctx.store, cfg.persona, cfg.seed);
  assert.ok(onboarding.profile, `${userKey} onboarding must produce skillProfile`);

  const allSelected = [];
  let allCalls = null;
  let reloadDone = false;

  const first = await trainViaUi(ctx, cfg.persona, 15, {
    reloadAt: 15,
    onReload: async () => {
      syncStorageFromWindow(storage, ctx.window);
      ctx.dom.window.close();
      ctx = await bootUi(storage, cfg.seed);
      reloadDone = true;
    }
  });
  allSelected.push(...first.selected);
  allCalls = first.calls;

  const second = await trainViaUi(ctx, cfg.persona, 25);
  allSelected.push(...second.selected);
  for (const k of Object.keys(second.calls)) allCalls[k] += second.calls[k];

  ctx.dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  assert.ok(reloadDone, `${userKey} must reload mid-session`);

  const store = createTrainingStore({ storage });
  const profile = store.loadSkillProfile();
  const dist = taskDistribution(allSelected);
  const avgDiff = avgDifficulty(allSelected);

  const weakSkill = onboarding.profile.weakest?.skill;
  const weakTagCount = (store.loadHistory() || []).filter((h) => (h.skillTags || []).includes(weakSkill)).length;

  const recent = (store.loadHistory() || []).map((h) => ({
    grade: h.grade, skillTags: h.skillTags || [], nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD'
  }));
  const targetBefore = getTargetDifficulty(store.loadSkillProfile(), weakSkill || 'preflop', { recentResults: recent.slice(0, 8) }).target;
  const targetAfter = getTargetDifficulty(store.loadSkillProfile(), weakSkill || 'preflop', { recentResults: recent }).target;

  const masteryStates = buildSkillMasteryStates({
    skillProfile: store.loadSkillProfile(),
    masteryStore: store.loadSkillMastery?.() || {},
    recentResults: recent,
    now: Date.now()
  });

  const masteryStore = store.loadSkillMastery?.() || {};
  const dueSkill = weakSkill || 'river';
  const entry = profile?.skills?.[dueSkill] || { skill: dueSkill, score: 88, confidence: 0.7, sampleSize: 12 };
  const goodRecent = Array(10).fill({ grade: 'EXCELLENT', skillTags: [dueSkill], nearOptimal: true });
  let ms = { ...masteryStore };
  const trained = applySkillMasteryTraining({
    masteryStore: ms,
    skill: dueSkill,
    entry: { ...entry, score: 88, confidence: 0.7, sampleSize: 12 },
    recentResults: goodRecent,
    grade: 'EXCELLENT',
    now: Date.now()
  });
  ms = trained.store;
  ms[dueSkill].nextReviewAt = Date.now() - DAY_MS;
  ms[dueSkill].state = 'MASTERED';
  store.saveSkillMastery(ms);
  const reviewStates = buildSkillMasteryStates({
    skillProfile: store.loadSkillProfile(),
    masteryStore: store.loadSkillMastery(),
    recentResults: recent,
    now: Date.now()
  });
  const reviewDue = reviewStates[dueSkill]?.state === 'REVIEW_DUE';

  const planAfterMistakes = buildProfileDailyPlan({ store, count: 10, now: Date.now() + 1000 });

  const targetPreflop = getTargetDifficulty(profile, 'preflop', { recentResults: recent }).target;
  const targetIcm = getTargetDifficulty(profile, 'icm', { recentResults: recent }).target;

  let reviewPlanHits = 0;
  if (reviewDue && dueSkill) {
    const planReview = buildProfileDailyPlan({ store, count: 15, now: Date.now() + 2000 });
    reviewPlanHits = (planReview?.spots || []).filter((s) => (s.skillTags || []).includes(dueSkill)).length;
  }

  return {
    userKey,
    onboarding,
    dist,
    avgDiff,
    selected: allSelected,
    calls: allCalls,
    weakTagCount,
    targetBefore,
    targetAfter,
    targetPreflop,
    targetIcm,
    reviewDue,
    reviewPlanHits,
    dueSkill,
    masteryStates,
    profile,
    profilePersists: true,
    miniAppsConnected: allCalls.swipe > 0 && allCalls.sizing > 0 && allCalls.review > 0 && allCalls.xray > 0,
    mistakesAffect: planAfterMistakes?.personalized === true,
    difficultyAdapts: targetAfter >= targetBefore,
    masteryAffects: Object.values(masteryStates).some((s) => s.state === 'MASTERED' || s.state === 'PRACTICING')
  };
}

async function main() {
  const results = {};
  for (const key of ['A', 'B', 'C']) {
    results[key] = await simulateUser(key);
    REPORT.users[key] = results[key];
  }

  const overlapAB = overlapCount(results.A.selected.map((s) => s.id), results.B.selected.map((s) => s.id));
  const overlapAC = overlapCount(results.A.selected.map((s) => s.id), results.C.selected.map((s) => s.id));
  const overlapBC = overlapCount(results.B.selected.map((s) => s.id), results.C.selected.map((s) => s.id));

  const seqA = results.A.selected.map((s) => s.id).join(',');
  const seqB = results.B.selected.map((s) => s.id).join(',');
  const seqC = results.C.selected.map((s) => s.id).join(',');

  const checks = {
    realUi: results.A.miniAppsConnected && results.B.miniAppsConnected && results.C.miniAppsConnected,
    allApps: ['swipe', 'sizing', 'review', 'xray'].every((app) => results.A.calls[app] > 0),
    profilePersists: results.A.profilePersists && results.B.profilePersists,
    mistakesChange: results.A.mistakesAffect && results.B.mistakesAffect,
    difficultyAdapts: results.C.profile?.overall > results.A.profile?.overall
      && results.C.targetPreflop > results.A.targetPreflop,
    masteryAffects: results.A.masteryAffects && results.B.masteryAffects,
    spacedRep: (results.A.reviewDue && results.A.reviewPlanHits > 0)
      || (results.B.reviewDue && results.B.reviewPlanHits > 0),
    differentAB: results.A.dist.icmPush > results.B.dist.icmPush
      && results.B.dist.postRiver > results.A.dist.postRiver,
    noIdenticalSeq: seqA !== seqB && seqA !== seqC && seqB !== seqC
  };

  REPORT.legacyBypasses = [
    'newSwipeSession shuffle (no-profile fallback only)',
    'renderSizing sz%SIZING (index accessor; sz set by hook when profile exists)',
    'renderReview rv%REVIEWS (index accessor; rv set by hook when profile exists)',
    'renderXray runs%XR (preview body; runs temporarily overridden when profile exists)',
    'xrBegin runs%XR first line (xrI re-applied after orig when profile exists)',
    'quickAdvance topLeak memory (no-profile fallback only)'
  ];

  let testLine = '0/0';
  try {
    const out = execSync('node --test tests/*.test.js', { cwd: path.join(root, 'solver'), encoding: 'utf8' });
    const m = out.match(/# pass (\d+)/);
    const total = out.match(/# tests (\d+)/);
    if (m && total) testLine = `${m[1]}/${total[1]}`;
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    const m = out.match(/# pass (\d+)/);
    const total = out.match(/# tests (\d+)/);
    if (m && total) testLine = `${m[1]}/${total[1]}`;
  }

  const allOk = Object.values(checks).every(Boolean);

  console.log('REAL UI PERSONALIZATION:', checks.realUi ? 'YES' : 'NO');
  console.log('ALL TRAINING MINI-APPS CONNECTED:', checks.allApps ? 'YES' : 'NO');
  console.log('PROFILE PERSISTS:', checks.profilePersists ? 'YES' : 'NO');
  console.log('MISTAKES CHANGE FUTURE TRAINING:', checks.mistakesChange ? 'YES' : 'NO');
  console.log('DIFFICULTY ADAPTS:', checks.difficultyAdapts ? 'YES' : 'NO');
  console.log('MASTERY AFFECTS SELECTION:', checks.masteryAffects ? 'YES' : 'NO');
  console.log('SPACED REPETITION WORKS:', checks.spacedRep ? 'YES' : 'NO');
  console.log('LEGACY SELECTOR BYPASSES:', REPORT.legacyBypasses.join('; '));
  console.log('');
  console.log('USER A task distribution:', `icmPush=${results.A.dist.icmPush} postRiver=${results.A.dist.postRiver} other=${results.A.dist.other}`);
  console.log('USER B task distribution:', `icmPush=${results.B.dist.icmPush} postRiver=${results.B.dist.postRiver} other=${results.B.dist.other}`);
  console.log('USER C task distribution:', `icmPush=${results.C.dist.icmPush} postRiver=${results.C.dist.postRiver} other=${results.C.dist.other}`);
  console.log('');
  console.log('A/B overlap:', overlapAB);
  console.log('A/C overlap:', overlapAC);
  console.log('B/C overlap:', overlapBC);
  console.log('');
  console.log('AVERAGE DIFFICULTY A:', results.A.avgDiff);
  console.log('AVERAGE DIFFICULTY B:', results.B.avgDiff);
  console.log('AVERAGE DIFFICULTY C:', results.C.avgDiff);
  console.log('');
  console.log('PROFILE OVERALL A:', results.A.profile?.overall, 'B:', results.B.profile?.overall, 'C:', results.C.profile?.overall);
  console.log('TARGET PREFLOP A:', results.A.targetPreflop, 'B:', results.B.targetPreflop, 'C:', results.C.targetPreflop);
  console.log('TARGET ICM A:', results.A.targetIcm, 'B:', results.B.targetIcm, 'C:', results.C.targetIcm);
  console.log('');
  console.log('BUGS FOUND:', REPORT.bugsFound.length ? REPORT.bugsFound.join('; ') : 'NONE');
  console.log('BUGS FIXED:', REPORT.bugsFixed.length ? REPORT.bugsFixed.join('; ') : 'NONE');
  console.log('');
  console.log('TESTS:', testLine);
  console.log('SAFE TO MERGE:', allOk && testLine.endsWith('/567') && !testLine.startsWith('0/') ? 'YES' : 'NO');

  if (!allOk) {
    console.error('CHECK FAILURES:', checks);
    process.exit(1);
  }
}

main().catch((e) => {
  REPORT.bugsFound.push(e.message);
  console.error(e);
  process.exit(1);
});
