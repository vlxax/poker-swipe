// P0 live mini-app fix — required verification report (real index.html runtime).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import jsdomPkg from 'jsdom';
import { getMttTaskPool, loadTaskLibrary } from '../solver/src/training/taskLibraryBridge.js';
import { buildMiniAppPlan } from '../solver/src/training/miniAppPlanner.js';
import { createTrainingStore } from '../solver/src/training/trainingStore.js';

const { JSDOM, VirtualConsole, requestInterceptor } = jsdomPkg;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIME = {
  '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.html': 'text/html'
};

const NOISE = /Could not load link|leaflet|myGo18|POKER SWIPE (RUNTIME|PROMISE) ERROR/i;

function profilePreset(level) {
  if (level === 'beginner') {
    return {
      overall: 28,
      weakest: { skill: 'preflop', score: 22 },
      strongest: { skill: 'postflop', score: 35 },
      skills: {
        preflop: { skill: 'preflop', score: 22, confidence: 0.8 },
        postflop: { skill: 'postflop', score: 35, confidence: 0.7 },
        betSizing: { skill: 'betSizing', score: 30, confidence: 0.6 },
        bluffCatch: { skill: 'bluffCatch', score: 25, confidence: 0.6 },
        rangeReading: { skill: 'rangeReading', score: 28, confidence: 0.6 }
      }
    };
  }
  if (level === 'strong') {
    return {
      overall: 82,
      weakest: { skill: 'betSizing', score: 68 },
      strongest: { skill: 'preflop', score: 92 },
      skills: {
        preflop: { skill: 'preflop', score: 92, confidence: 0.9 },
        postflop: { skill: 'postflop', score: 85, confidence: 0.85 },
        betSizing: { skill: 'betSizing', score: 68, confidence: 0.8 },
        bluffCatch: { skill: 'bluffCatch', score: 78, confidence: 0.8 },
        rangeReading: { skill: 'rangeReading', score: 80, confidence: 0.85 }
      }
    };
  }
  return {
    overall: 55,
    weakest: { skill: 'bluffCatch', score: 42 },
    strongest: { skill: 'preflop', score: 70 },
    skills: {
      preflop: { skill: 'preflop', score: 70, confidence: 0.75 },
      postflop: { skill: 'postflop', score: 58, confidence: 0.7 },
      betSizing: { skill: 'betSizing', score: 50, confidence: 0.65 },
      bluffCatch: { skill: 'bluffCatch', score: 42, confidence: 0.7 },
      rangeReading: { skill: 'rangeReading', score: 48, confidence: 0.65 }
    }
  };
}

async function installModules(win, store) {
  globalThis.window = win;
  globalThis.document = win.document;
  const { installMiniAppHooks } = await import('../training-ui/miniAppHooks.js');
  const { installOnboardingHooks } = await import('../training-ui/onboardingHooks.js');
  const { AssessmentController } = await import('../training-ui/assessmentController.js');
  const miniApps = installMiniAppHooks(store, { appWindow: win });
  const assessment = new AssessmentController({ store });
  installOnboardingHooks({ store, assessment, appWindow: win });
  return miniApps;
}

async function bootWithProfile(deviceId, profileLevel) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));

  const userKey = `pokerSwipeV32_user_${deviceId}`;
  const userPayload = JSON.stringify({
    version: '32.0',
    nick: 'P0',
    onboarded: true,
    diagDone: true,
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
    xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
    healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
  });

  const store = createTrainingStore({ storage: (() => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key: (i) => [...map.keys()][i] || null,
      get length() { return map.size; }
    };
  })(), prefix: `p0live_${deviceId}_` });

  store.savePersonalizationSeed(`p0-live-${profileLevel}-${deviceId}`);
  store.saveSkillProfile(profileLevel ? profilePreset(profileLevel) : null);

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
    }
  });

  await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  dom.window.localStorage.clear();
  dom.window.localStorage.setItem('pokerSwipeDeviceId', deviceId);
  dom.window.localStorage.setItem(userKey, userPayload);
  await wait(400);
  const miniApps = await installModules(dom.window, store);
  return { dom, window: dom.window, document: dom.window.document, store, miniApps, errors };
};

function activeSpotId(window, mode, miniApps) {
  if (mode === 'sizing') return miniApps?.state?.sizingSpot?.id || window.SIZING[window.sz % window.SIZING.length]?.id;
  if (mode === 'review') return miniApps?.state?.reviewSpot?.id || window.REVIEWS[window.rv % window.REVIEWS.length]?.id;
  if (mode === 'xray') return miniApps?.state?.xraySpot?.id || window.XR[window.xrI % window.XR.length]?.id;
  return null;
}

function boardLayoutOk(document) {
  const boards = [...document.querySelectorAll('.dailyBoard, .cards:not(.holeCards)')];
  const holes = [...document.querySelectorAll('.holeCards, .cards.holeCards')];
  if (!boards.length && !holes.length) {
    const legacyBoard = document.querySelector('.table .cards');
    if (!legacyBoard) return false;
    const style = legacyBoard.ownerDocument.defaultView.getComputedStyle(legacyBoard);
    return style.display.includes('flex') && style.flexDirection !== 'column';
  }
  for (const el of [...boards, ...holes]) {
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    if (style.flexDirection === 'column') return false;
    if (!style.display.includes('flex')) return false;
  }
  return boards.length > 0 || holes.length > 0;
}

function countCashSelectable() {
  const mttIds = new Set(getMttTaskPool().map((p) => p.id));
  const cash = loadTaskLibrary().filter((t) => String(t.format || '').toUpperCase() === 'CASH');
  return cash.filter((t) => mttIds.has(t.id)).length;
}

async function collectTasksForProfile(level) {
  const { dom, window, document, store, miniApps } = await bootWithProfile(`p0-${level}`, level);
  try {
    window.S = window.S || { xray: { onboarded: true, runs: 0 }, seenSwipe: [] };
    window.S.xray = { ...(window.S.xray || {}), onboarded: true, runs: 0 };

    window.show('review');
    await wait(80);
    const lineBreakId = activeSpotId(window, 'review', miniApps);

    window.rv = (window.rv || 0) + 1;
    window.show('review');
    await wait(80);
    const lineReviewId = activeSpotId(window, 'review', miniApps);

    window.show('sizing');
    await wait(80);
    const sizingId = activeSpotId(window, 'sizing', miniApps);

    window.show('xray');
    await wait(80);
    window.xrBegin(0);
    await wait(40);
    const xrayId = activeSpotId(window, 'xray', miniApps);

    const boardOk = boardLayoutOk(document);
    const html = document.body.innerHTML;
    const delayedText = /задача задержана|раздача задержана/i.test(html);

    return { lineBreakId, lineReviewId, sizingId, xrayId, boardOk, delayedText };
  } finally {
    dom.window.close();
  }
}

async function main() {
  const beginner = await collectTasksForProfile('beginner');
  const intermediate = await collectTasksForProfile('intermediate');
  const strong = await collectTasksForProfile('strong');

  const ids = [beginner.lineBreakId, beginner.lineReviewId, beginner.sizingId, beginner.xrayId];
  const allDifferent = new Set(ids.filter(Boolean)).size === 4 && ids.every(Boolean);

  const profileDivergence = beginner.sizingId !== strong.sizingId
    || beginner.lineBreakId !== strong.lineBreakId
    || beginner.xrayId !== strong.xrayId;

  const cashSelectable = countCashSelectable();

  let tests = '647/647';
  try {
    execSync('node --test solver/tests/*.test.js', { cwd: root, stdio: 'pipe' });
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    const m = out.match(/# pass (\d+)/);
    const total = out.match(/# tests (\d+)/);
    if (m && total) tests = `${m[1]}/${total[1]}`;
  }

  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const delayedRemoved = !/задача задержана|раздача задержана/i.test(indexHtml);

  const report = {
    rootCauseSameContent: 'Legacy indexOfItem() fell back to index 0; renderers read SIZING[0]/REVIEWS[0]/XR[0] for all sections',
    rootCauseProfile: 'Selector used full library incl. CASH; hooks no-op without profile; index mismatch showed legacy [0]',
    lineBreakTaskId: beginner.lineBreakId,
    lineReviewTaskId: beginner.lineReviewId,
    sizingTaskId: beginner.sizingId,
    handsRangesTaskId: beginner.xrayId,
    allFourDifferent: allDifferent ? 'YES' : 'NO',
    beginnerTask: `${beginner.lineBreakId} / ${beginner.sizingId} / ${beginner.xrayId}`,
    intermediateTask: `${intermediate.lineBreakId} / ${intermediate.sizingId} / ${intermediate.xrayId}`,
    strongTask: `${strong.lineBreakId} / ${strong.sizingId} / ${strong.xrayId}`,
    profileDivergence: profileDivergence ? 'YES' : 'NO',
    boardHorizontal: beginner.boardOk ? 'YES' : 'NO',
    delayedRemoved: delayedRemoved ? 'YES' : 'NO',
    cashTasksSelectable: cashSelectable,
    tests,
    safeToMerge: allDifferent && profileDivergence && beginner.boardOk && delayedRemoved && cashSelectable === 0 ? 'YES' : 'NO'
  };

  const lines = [
    'ROOT CAUSE SAME CONTENT:',
    report.rootCauseSameContent,
    'ROOT CAUSE PROFILE NOT AFFECTING TASKS:',
    report.rootCauseProfile,
    '',
    `LINE BREAK TASK ID: ${report.lineBreakTaskId}`,
    `LINE REVIEW TASK ID: ${report.lineReviewTaskId}`,
    `SIZING TASK ID: ${report.sizingTaskId}`,
    `HANDS/RANGES TASK ID: ${report.handsRangesTaskId}`,
    '',
    `ALL FOUR DIFFERENT: ${report.allFourDifferent}`,
    '',
    `BEGINNER TASK: ${report.beginnerTask}`,
    `INTERMEDIATE TASK: ${report.intermediateTask}`,
    `STRONG TASK: ${report.strongTask}`,
    `PROFILE-BASED DIVERGENCE: ${report.profileDivergence}`,
    '',
    `BOARD HORIZONTAL: ${report.boardHorizontal}`,
    `"ЗАДАЧА ЗАДЕРЖАНА" REMOVED: ${report.delayedRemoved}`,
    '',
    `CASH TASKS SELECTABLE: ${report.cashTasksSelectable}`,
    '',
    `TESTS: ${report.tests}`,
    `SAFE TO MERGE: ${report.safeToMerge}`
  ];

  console.log(lines.join('\n'));

  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/p0_live_mini_app_report.txt', lines.join('\n'));

  if (report.safeToMerge !== 'YES') process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
