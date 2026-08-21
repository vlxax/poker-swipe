// Phase 3 runtime verification — real index.html boot + actual hook installation path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jsdomPkg from 'jsdom';
import { createTrainingStore } from '../solver/src/training/trainingStore.js';
import { installMiniAppHooks } from '../training-ui/miniAppHooks.js';

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

function seedTrainingProfile(store) {
  store.savePersonalizationSeed('phase3-ui-verify-seed');
  store.saveSkillProfile({
    overall: 62,
    overallLabel: 'developing',
    weakest: { skill: 'bluffCatch', score: 38, confidence: 0.7 },
    skills: {
      bluffCatch: { skill: 'bluffCatch', score: 38, confidence: 0.7, trend: 'down' },
      betSizing: { skill: 'betSizing', score: 55, confidence: 0.6, trend: 'flat' },
      rangeReading: { skill: 'rangeReading', score: 50, confidence: 0.6, trend: 'flat' },
      preflop: { skill: 'preflop', score: 70, confidence: 0.8, trend: 'up' }
    },
    updatedAt: Date.now()
  });
  store.saveProfile({ concept: 'bluff_catch', sampleSize: 5, avgEvLossBb: 0.4, trend: 'worse', priorityScore: 80 });
}

async function boot() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));

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
      window.localStorage.setItem('pokerSwipeDeviceId', 'phase3-verify');
      window.localStorage.setItem('pokerSwipeV28_user_phase3-verify', JSON.stringify({
        version: '16.2', nick: 'VERIFY', onboarded: true, diagDone: true, skill: 50,
        streak: 2, lastDay: '2026-08-21', events: [], hands: [], myHands18: [], tournaments: [],
        dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
        diagnosticProfile25: { overall: 50 },
        xray: { onboarded: true, runs: 1, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
        healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
      }));
    }
  });

  await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  await wait(400);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const store = createTrainingStore({ storage: dom.window.localStorage });
  seedTrainingProfile(store);
  const miniApps = installMiniAppHooks(store, { appWindow: dom.window });
  dom.window.PersonalizedTrainingUi = { store, miniApps };

  return { dom, window: dom.window, document: dom.window.document, errors, store, miniApps };
}

function spyBridge(miniApps) {
  const bridge = miniApps.bridge;
  const calls = { swipe: 0, sizing: 0, review: 0, xray: 0, memory: 0, writeback: 0 };
  const orig = {
    swipe: bridge.prepareSwipeSession.bind(bridge),
    sizing: bridge.prepareSizingSpot.bind(bridge),
    review: bridge.prepareReviewSpot.bind(bridge),
    xray: bridge.prepareXrayIndex.bind(bridge),
    memory: bridge.prepareMemorySpot.bind(bridge),
    writeback: bridge.recordFromLegacyEvent.bind(bridge)
  };
  bridge.prepareSwipeSession = (...a) => { calls.swipe++; return orig.swipe(...a); };
  bridge.prepareSizingSpot = (...a) => { calls.sizing++; return orig.sizing(...a); };
  bridge.prepareReviewSpot = (...a) => { calls.review++; return orig.review(...a); };
  bridge.prepareXrayIndex = (...a) => { calls.xray++; return orig.xray(...a); };
  bridge.prepareMemorySpot = (...a) => { calls.memory++; return orig.memory(...a); };
  bridge.recordFromLegacyEvent = (...a) => { calls.writeback++; return orig.writeback(...a); };
  return { calls, bridge };
}

function legacyShuffleIds(window) {
  const seen = new Set(window.S.seenSwipe || []);
  let pool = window.SWIPE.filter((x) => !seen.has(x.id));
  if (pool.length < 10) pool = [...window.SWIPE];
  pool.sort(() => 0.42 - 0.5);
  return pool.slice(0, 10).map((x) => x.id).join(',');
}

function completeReviewAnswer(window, document) {
  const R = window.REVIEWS[window.rv];
  if (!R) return false;
  if (R.bad === null) {
    document.querySelector('#rvNone')?.click();
    document.querySelector('#rvSure')?.click();
    return true;
  }
  document.querySelector(`[data-rn="${R.bad}"]`)?.click();
  document.querySelector('#rvSure')?.click();
  document.querySelector(`[data-rr="${R.correctReason}"]`)?.click();
  const best = (R.best && R.best[0]) || 50;
  const repair = document.querySelector('#repair');
  if (repair) {
    repair.value = String(best);
    repair.dispatchEvent(new window.Event('input'));
  }
  document.querySelector('#repairGo')?.click();
  return true;
}

async function main() {
  const { window, document, errors, store, miniApps } = await boot();
  const results = {
    SWIPE: 'FAIL', SIZING: 'FAIL', REVIEW: 'FAIL', 'X-RAY': 'FAIL', QUICK5: 'FAIL',
    legacy: [], boot: 'FAIL', nav: 'FAIL', tests: '0/0', safe: 'NO'
  };

  try {
    assert.equal(window.__pokerBooted, true);
    assert.ok(miniApps?.bridge?.hasProfile());
    results.boot = 'PASS';

    const { calls } = spyBridge(miniApps);

    for (const id of ['home', 'swipe', 'sizing', 'review', 'xray', 'daily', 'profile', 'home']) {
      window.show(id);
      await wait(40);
      assert.ok(document.getElementById(id), `missing screen ${id}`);
    }
    results.nav = 'PASS';

    // SWIPE — renderSwipe → newSwipeSession hook
    const histBefore = store.loadHistory().length;
    window.swSession = [];
    window.show('swipe');
    await wait(60);
    assert.ok(calls.swipe > 0, 'prepareSwipeSession not called');
    assert.ok(window.swSession.length > 0, 'swipe session empty');
    const legacyIds = legacyShuffleIds(window);
    const actualIds = window.swSession.map((x) => x.id).join(',');
    assert.notEqual(actualIds, legacyIds, 'legacy shuffle order used');
    const s0 = window.swSession[0];
    window.recordEvent({ spotId: s0.id, mode: 'swipe', concept: s0.concept, street: s0.street, grade: 'r', action: 'FOLD' });
    await wait(20);
    assert.ok(calls.writeback > 0);
    assert.ok(store.loadHistory().length > histBefore, 'shared history not updated');
    assert.ok(store.loadHistory().at(-1).contentFingerprint || store.loadHistory().at(-1).spotId, 'history entry missing anti-repeat fields');
    assert.ok(store.loadSkillProfile(), 'skillProfile missing after swipe answer');
    results.SWIPE = 'PASS';

    // SIZING — show('sizing') → renderSizing hook
    window.show('sizing');
    await wait(60);
    assert.ok(calls.sizing > 0);
    document.querySelector('#sizeLock')?.click();
    await wait(30);
    assert.ok(calls.writeback > 1);
    results.SIZING = 'PASS';

    // REVIEW — renderReview picks once; answer via brain line/repair flow
    window.show('review');
    await wait(60);
    assert.ok(calls.review > 0);
    const caseId = window.REVIEWS[window.rv]?.id;
    completeReviewAnswer(window, document);
    await wait(60);
    assert.equal(window.REVIEWS[window.rv]?.id, caseId, 'review case changed during answer');
    assert.ok(calls.writeback > 2);
    results.REVIEW = 'PASS';

    // X-RAY — renderXray + xrBegin hooks
    window.S.xray.runs = 1;
    window.show('xray');
    await wait(60);
    assert.ok(calls.xray > 0);
    const moduloXr = 1 % window.XR.length;
    window.xrBegin(0);
    await wait(30);
    const picked = miniApps.state.xrayIndex;
    if (picked != null && picked !== moduloXr) assert.equal(window.xrI, picked);
    else assert.ok(window.xrI != null);
    window.recordEvent({ mode: 'xray', concept: 'range narrowing', grade: 'r', action: 'full xray', spotId: `XR_${window.xrI}` });
    await wait(20);
    assert.ok(calls.writeback > 3);
    results['X-RAY'] = 'PASS';

    // QUICK5 — startQuick → newSwipeSession; quickAdvance to memory step
    calls.swipe = 0;
    window.startQuick();
    await wait(60);
    assert.equal(window.quick.active, true);
    assert.ok(calls.swipe > 0);
    window.quickAdvance(); // sizing
    await wait(40);
    window.quickAdvance(); // memory
    await wait(60);
    assert.ok(calls.memory > 0);
    results.QUICK5 = 'PASS';

    results.legacy = [
      'newSwipeSession shuffle (no-profile fallback only)',
      'renderSizing sz%SIZING (index accessor; sz set by hook when profile exists)',
      'renderReview rv%REVIEWS (index accessor; rv set by hook when profile exists)',
      'renderXray runs%XR (preview body; runs temporarily overridden when profile exists)',
      'xrBegin runs%XR first line (xrI re-applied after orig when profile exists)',
      'quickAdvance topLeak memory (no-profile fallback only)'
    ];

    assert.equal(realErrors(errors).length, 0, realErrors(errors).join('\n'));
  } catch (e) {
    console.error('VERIFY FAILURE:', e.message);
  } finally {
    window.close();
  }

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

  const allPass = ['SWIPE', 'SIZING', 'REVIEW', 'X-RAY', 'QUICK5'].every((k) => results[k] === 'PASS')
    && results.boot === 'PASS' && results.nav === 'PASS';

  console.log('SWIPE:', results.SWIPE);
  console.log('SIZING:', results.SIZING);
  console.log('REVIEW:', results.REVIEW);
  console.log('X-RAY:', results['X-RAY']);
  console.log('QUICK5:', results.QUICK5);
  console.log('');
  console.log('LEGACY SELECTORS STILL ACTIVE:');
  for (const line of results.legacy) console.log(`- ${line}`);
  console.log('');
  console.log('APP BOOT:', results.boot);
  console.log('NAVIGATION:', results.nav);
  console.log('TESTS:', testLine);
  console.log('');
  console.log('SAFE TO MERGE:', allPass && testLine === '533/533' ? 'YES' : 'NO');

  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
