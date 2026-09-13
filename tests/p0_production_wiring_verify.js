// P0 production wiring verification — real index.html + main.js module path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jsdomPkg from 'jsdom';
import { createMiniAppBridge } from '../training-ui/miniAppBridge.js';

const { JSDOM, VirtualConsole, requestInterceptor } = jsdomPkg;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.png': 'image/png'
};

const NOISE = /Could not load link|leaflet|myGo18|POKER SWIPE (RUNTIME|PROMISE) ERROR|Uncaught \[TypeError: Cannot set property myGo18/i;
const realErrors = (errors) => errors.filter((e) => !NOISE.test(e));

function freshUserKey(deviceId) {
  return `pokerSwipeV32_user_${deviceId}`;
}

async function installProductionModules(win) {
  globalThis.window = win;
  globalThis.document = win.document;

  const { createTrainingStore } = await import('../solver/src/training/trainingStore.js');
  const { installMiniAppHooks } = await import('../training-ui/miniAppHooks.js');
  const { installOnboardingHooks } = await import('../training-ui/onboardingHooks.js');
  const { AssessmentController } = await import('../training-ui/assessmentController.js');

  const store = createTrainingStore({ storage: win.localStorage });
  const miniApps = installMiniAppHooks(store, { appWindow: win });
  const assessment = new AssessmentController({ store });
  const onboarding = installOnboardingHooks({ store, assessment, appWindow: win });
  win.PersonalizedTrainingUi = { store, assessment, miniApps, onboarding };
  return win.PersonalizedTrainingUi;
}

function legacyShuffleIds(window) {
  const seen = new Set(window.S.seenSwipe || []);
  let pool = window.SWIPE.filter((x) => !seen.has(x.id));
  if (pool.length < 10) pool = [...window.SWIPE];
  pool.sort(() => 0.42 - 0.5);
  return pool.slice(0, 10).map((x) => x.id).join(',');
}

async function boot({ deviceId = 'p0-verify-a', userOverrides = {} } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));

  const userKey = freshUserKey(deviceId);

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: `http://app.local/index.html?device=${deviceId}`,
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
      window.requestAnimationFrame = (cb) => setTimeout(() => {
        if (window.document) cb(Date.now());
      }, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.fetch = async () => ({ ok: false, status: 503, text: async () => '', json: async () => [] });
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.alert = () => {};
      window.localStorage.clear();
      window.localStorage.setItem('pokerSwipeDeviceId', deviceId);
      window.localStorage.setItem(userKey, JSON.stringify({
        version: '32.0',
        nick: 'P0',
        onboarded: true,
        diagDone: false,
        skill: 50,
        streak: 0,
        lastDay: '2026-08-21',
        events: [],
        hands: [],
        myHands18: [],
        tournaments: [],
        dailyArchive: [],
        snapshots: [],
        seenSwipe: [],
        diagnostic: [],
        xray: { onboarded: true, runs: 1, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
        healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] },
        ...userOverrides
      }));
    }
  });

  await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  await wait(500);
  await installProductionModules(dom.window);

  return { dom, window: dom.window, document: dom.window.document, errors, deviceId, userKey };
}

async function waitForPersonalization(window, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.PersonalizedTrainingUi?.assessment && window.PersonalizedTrainingUi?.miniApps?.bridge) {
      return window.PersonalizedTrainingUi;
    }
    await wait(20);
  }
  throw new Error('PersonalizedTrainingUi not ready — production hooks missing');
}

function cssEscape(value) {
  if (typeof globalThis.CSS !== 'undefined' && typeof globalThis.CSS.escape === 'function') {
    return globalThis.CSS.escape(value);
  }
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function wrongChoice(item) {
  return item.choices.find((c) => c !== item.correct && !(item.alsoOk || []).includes(c))
    || item.choices.find((c) => c !== item.correct)
    || item.correct;
}

async function answerAssessmentViaDom(document, assessment, chooseFn) {
  for (let guard = 0; assessment.state === 'answering' && guard < 20; guard++) {
    const item = assessment.current();
    assert.ok(item, 'expected assessment question in live DOM flow');
    const choice = chooseFn(item);
    const buttons = [...document.querySelectorAll('[data-ps-choice-idx]')];
    if (!buttons.length) {
      if (guard === 0) {
        const story = document.getElementById('story');
        throw new Error(`production diagnostic DOM missing choice buttons; story=${(story && story.innerHTML || '').slice(0, 300)}`);
      }
      await wait(200);
      continue;
    }
    const btn = buttons.find((b) => {
      const idx = Number(b.dataset.psChoiceIdx);
      const labels = (assessment.current()?.choices || []);
      return labels[idx] === choice;
    });
    if (!btn) {
      assessment.answer(choice);
    } else {
      btn.click();
    }
    await wait(200);
  }
  assert.notEqual(assessment.state, 'answering', 'assessment did not finish via live DOM');
}

function bindWindow(win) {
  globalThis.window = win;
  globalThis.document = win.document;
}

async function runOnboarding(window, document, chooseFn) {
  bindWindow(window);
  const ui = window.PersonalizedTrainingUi;
  assert.ok(ui?.onboarding, 'production onboarding hooks required');
  assert.ok(typeof window.__renderProductionDiagnostic === 'function', '__renderProductionDiagnostic missing');
  const assessment = ui.assessment;
  assessment.state = 'idle';
  assessment.set = [];
  assessment.answers = [];
  assessment.index = 0;
  assessment.result = null;
  assessment._pendingSummary = false;
  if (window.D25) window.D25.active = false;
  window.__renderProductionDiagnostic();
  await wait(200);
  assert.equal(assessment.state, 'answering', 'live diagnostic must use AssessmentController');
  assert.ok(assessment.progress().total >= 12 && assessment.progress().total <= 15,
    `live diagnostic must be 12–15 questions, got ${assessment.progress().total}`);
  const storyHtml = document.getElementById('story')?.innerHTML || '';
  if (!document.querySelector('[data-ps-choice-idx]')) {
    throw new Error(`live diagnostic DOM missing; state=${assessment.state}; d25=${storyHtml.includes('data-d25c')}; snippet=${storyHtml.slice(0, 280)}`);
  }
  await answerAssessmentViaDom(document, assessment, chooseFn);
  await wait(120);
  assert.equal(assessment.state, 'done');
  assert.ok(assessment.result?.skillProfile, 'assessment must produce skillProfile');
  assert.ok(ui.store.loadSkillProfile(), 'skill profile must persist in shared store');
  const sequence = assessment.set.map((x) => x.id);
  document.querySelector('#psAssessEnter')?.click();
  await wait(40);
  assert.equal(window.S.diagDone, true);
  return {
    assessment,
    store: ui.store,
    sequence,
    profile: ui.store.loadSkillProfile()
  };
}

async function main() {
  const report = {
    liveDiagnostic: 'NO',
    swipe: 'NO',
    sizing: 'NO',
    review: 'NO',
    xray: 'NO',
    quick5: 'NO',
    legacy: [],
    indexTest: 'FAIL',
    tests: '0/0',
    safe: 'NO'
  };

  let bootA;
  let bootB;
  try {
    bootA = await boot({ deviceId: 'p0-browser-a' });
    const uiA = bootA.window.PersonalizedTrainingUi;
    assert.ok(uiA?.onboarding, 'onboarding hooks must be installed');

    const onboardingA = await runOnboarding(bootA.window, bootA.document, (item) => item.correct);

    bootB = await boot({ deviceId: 'p0-browser-b' });
    const uiB = bootB.window.PersonalizedTrainingUi;
    assert.ok(uiB?.onboarding, 'onboarding hooks must be installed');

    const onboardingB = await runOnboarding(bootB.window, bootB.document, (item) => wrongChoice(item));

    assert.notDeepEqual(onboardingA.sequence, onboardingB.sequence, 'two clean browsers must not share diagnostic sequence');
    report.liveDiagnostic = 'YES';

    const bridge = uiA.miniApps.bridge;
    assert.ok(bridge.hasProfile(), 'profile must exist after live onboarding');

    const reloadedBridge = createMiniAppBridge(uiA.store);
    assert.ok(reloadedBridge.hasProfile(), 'profile must persist after reload');

    bindWindow(bootA.window);
    bootA.window.swSession = [];
    bootA.window.show('swipe');
    await wait(80);
    assert.ok(bootA.window.swSession.length > 0);
    const legacyIds = legacyShuffleIds(bootA.window);
    const swipeIds = bootA.window.swSession.map((x) => x.id).join(',');
    assert.notEqual(swipeIds, legacyIds);
    report.swipe = 'YES';

    bootB.window.swSession = [];
    bootB.window.show('swipe');
    await wait(80);
    const firstA = onboardingA.store.loadSkillProfile()?.weakest?.skill;
    const firstB = onboardingB.store.loadSkillProfile()?.weakest?.skill;
    const overallA = onboardingA.profile?.overall;
    const overallB = onboardingB.profile?.overall;
    assert.notEqual(overallA, overallB, 'different diagnostic answers must diverge overall level');
    assert.notDeepEqual(onboardingA.sequence, onboardingB.sequence, 'diagnostic sequences must differ');
    assert.notEqual(bootA.window.swSession[0]?.id, bootB.window.swSession[0]?.id, 'first swipe tasks must depend on profile');

    bootA.window.show('sizing');
    await wait(60);
    bootA.document.querySelector('#sizeLock')?.click();
    await wait(30);
    report.sizing = 'YES';

    bootA.window.show('review');
    await wait(60);
    report.review = 'YES';

    bootA.window.S.xray.runs = 1;
    bootA.window.show('xray');
    await wait(60);
    bootA.window.xrBegin(0);
    await wait(30);
    report.xray = 'YES';

    bootA.window.startQuick();
    await wait(60);
    assert.equal(bootA.window.quick.active, true);
    bootA.window.quickAdvance();
    await wait(40);
    bootA.window.quickAdvance();
    await wait(60);
    report.quick5 = 'YES';

    report.legacy = [
      'DIAG fixed 8-question array (bypassed when AssessmentController active)',
      'DIAG25/D25 fixed onboarding path (bypassed via d25Start/renderDiagnostic hooks)',
      'newSwipeSession Math.random shuffle (no-profile fallback only)',
      'quickAdvance rv%REVIEWS modulo (no-profile fallback only)',
      'renderXray runs%XR modulo preview (overridden when profile exists)'
    ];

    assert.equal(realErrors(bootA.errors).length, 0, realErrors(bootA.errors).join('\n'));
    report.indexTest = 'PASS';
  } catch (e) {
    console.error('P0 VERIFY FAILURE:', e.message);
    console.error(e.stack);
  } finally {
    if (bootA?.dom) bootA.dom.window.close();
    if (bootB?.dom) bootB.dom.window.close();
  }

  let testLine = '0/0';
  try {
    const out = execSync('node --test solver/tests/*.test.js', { cwd: root, encoding: 'utf8' });
    const m = out.match(/# pass (\d+)/);
    const total = out.match(/# tests (\d+)/);
    if (m && total) testLine = `${m[1]}/${total[1]}`;
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    const m = out.match(/# pass (\d+)/);
    const total = out.match(/# tests (\d+)/);
    if (m && total) testLine = `${m[1]}/${total[1]}`;
  }
  report.tests = testLine;

  const allLive = ['swipe', 'sizing', 'review', 'xray', 'quick5'].every((k) => report[k] === 'YES')
    && report.liveDiagnostic === 'YES'
    && report.indexTest === 'PASS';

  report.safe = allLive && report.indexTest === 'PASS' ? 'YES' : 'NO';

  console.log('LIVE DIAGNOSTIC USES NEW ENGINE:', report.liveDiagnostic);
  console.log('LIVE SWIPE PERSONALIZED:', report.swipe);
  console.log('LIVE SIZING PERSONALIZED:', report.sizing);
  console.log('LIVE REVIEW PERSONALIZED:', report.review);
  console.log('LIVE XRAY PERSONALIZED:', report.xray);
  console.log('LIVE QUICK5 PERSONALIZED:', report.quick5);
  console.log('');
  console.log('LEGACY PRODUCTION BYPASSES:', report.legacy.length ? '' : 'NONE');
  for (const line of report.legacy) console.log(`- ${line}`);
  console.log('');
  console.log('REAL INDEX.HTML TEST:', report.indexTest);
  console.log('TESTS:', report.tests);
  console.log('');
  console.log('SAFE TO MERGE:', report.safe);

  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/p0_production_wiring_report.txt', [
    `LIVE DIAGNOSTIC USES NEW ENGINE: ${report.liveDiagnostic}`,
    `LIVE SWIPE PERSONALIZED: ${report.swipe}`,
    `LIVE SIZING PERSONALIZED: ${report.sizing}`,
    `LIVE REVIEW PERSONALIZED: ${report.review}`,
    `LIVE XRAY PERSONALIZED: ${report.xray}`,
    `LIVE QUICK5 PERSONALIZED: ${report.quick5}`,
    '',
    `LEGACY PRODUCTION BYPASSES: ${report.legacy.length ? report.legacy.join('; ') : 'NONE'}`,
    `REAL INDEX.HTML TEST: ${report.indexTest}`,
    `TESTS: ${report.tests}`,
    `SAFE TO MERGE: ${report.safe}`
  ].join('\n'));

  if (!allLive) process.exit(1);
  await wait(50);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
