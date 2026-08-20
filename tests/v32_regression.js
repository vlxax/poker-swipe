import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import jsdomPkg from 'jsdom';
const {JSDOM, VirtualConsole, requestInterceptor} = jsdomPkg;

// jsdom 30 + pretendToBeVisual leaves queued rAF callbacks that read
// `window._document` after `window.close()`, throwing an uncaught exception
// on the Node event loop and killing the process. That teardown artifact is
// unrelated to app logic; ignore exactly it.
process.on('uncaughtException', err => {
  if (err && /reading '_location'/.test(String(err.message))) return;
  console.error(err);
  process.exit(1);
});
process.on('unhandledRejection', err => { throw err; });

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const MIME = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png'};

// Pre-existing, environment-only noise (external leaflet asset not reachable
// from jsdom, and the app's own duplicated `var myGo18` getter conflict).
// These exist independently of the Polyana build; the audit asserts no NEW
// errors are introduced beyond this known set.
const NOISE = /Could not load link|leaflet|myGo18|POKER SWIPE (RUNTIME|PROMISE) ERROR|Uncaught \[TypeError: Cannot set property myGo18/i;
const realErrors = errors => errors.filter(e => !NOISE.test(e));

class FakeWorker {
  postMessage(message) {
    setTimeout(() => this.onmessage?.({data: {id: message.id, result: {h: 46.2, v: 53.8, n: message.samples, approx: true}}}), 5);
  }
  terminate() {}
}

function runRealEquityWorker(data) {
  let output;
  let seed = 123456789;
  const workerMath = Object.create(Math);
  workerMath.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const sandbox = {Math: workerMath, self: {postMessage: message => { output = message; }}};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'equity_worker_v32.js'), 'utf8'), sandbox);
  sandbox.self.onmessage({data});
  return output;
}

async function boot({returning = false} = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://app.local/index.html',
    runScripts: 'dangerously',
    resources: {interceptors: [
      requestInterceptor(async request => {
        if (request.url.startsWith('https://telegram.org/')) return new Response('', {status: 200});
        const parsed = new URL(request.url);
        if (parsed.hostname !== 'app.local') return undefined;
        const file = path.join(root, decodeURIComponent(parsed.pathname.replace(/^\//, '')));
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          const ext = path.extname(file).toLowerCase();
          return new Response(new Uint8Array(fs.readFileSync(file)), {
            status: 200,
            headers: {'Content-Type': MIME[ext] || 'application/octet-stream'}
          });
        }
        return new Response('', {status: 404});
      })
    ]},
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = async () => ({ok: false, status: 503, text: async () => '', json: async () => []});
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.Worker = FakeWorker;
      window.alert = () => {};
      window.Math.random = () => 0.42;
      if (returning) {
        window.localStorage.setItem('pokerSwipeDeviceId', 'test-device');
        window.localStorage.setItem('pokerSwipeV28_user_test-device', JSON.stringify({
          version: '16.2', nick: 'TEST', onboarded: true, diagDone: true, skill: 50,
          streak: 4, lastDay: '2025-01-01', events: [], hands: [], myHands18: [], tournaments: [],
          dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
          diagnosticProfile25: {overall: 50},
          xray: {runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: []},
          healCourses: {river_bluffcatch: [0,0,0,0], sizing: [0,0,0,0], bb_defence: [0,0,0,0], thin_value: [0,0,0,0]}
        }));
      }
    }
  });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, {once: true}));
  await wait(100);
  return {dom, window: dom.window, document: dom.window.document, errors};
}

(async () => {
  const workerResult = runRealEquityWorker({id: 'AKvQQ', hero: ['As', 'Kh'], villain: ['Qc', 'Qd'], board: [], samples: 8000});
  assert.equal(workerResult.id, 'AKvQQ');
  assert.ok(workerResult.result.h > 40 && workerResult.result.h < 47, `Unexpected AK vs QQ equity: ${workerResult.result.h}`);
  assert.ok(Math.abs(workerResult.result.h + workerResult.result.v - 100) < 1e-9);
  assert.equal(runRealEquityWorker({id: 'bad', hero: ['As', 'As'], villain: ['Qc', 'Qd'], samples: 10}).error, 'INVALID_CARDS');

  const fresh = await boot();
  assert.equal(fresh.window.__pokerBooted, true);
  assert.equal(fresh.window.__pokerReadyV32, true);
  assert.equal(fresh.document.documentElement.dataset.pokerSwipeVersion, '60-trip-builder');
  assert.equal(realErrors(fresh.errors).length, 0, realErrors(fresh.errors).join('\n'));
  fresh.window.close();

  const app = await boot({returning: true});
  const {window, document} = app;
  assert.equal(window.__pokerReadyV32, true);
  assert.ok(window.localStorage.getItem('pokerSwipeV32_user_test-device'), 'V32 state was not persisted');
  const homeText = document.querySelector('#home').textContent;
  assert.match(homeText, /РАЗДАЧА ДНЯ/i, 'home missing daily section');
  assert.match(homeText, /POKER DNA|Собираем честную выборку/i, 'home missing personalization block');
  assert.ok(document.querySelectorAll('.v36Stat').length >= 3, 'home stats missing');

  document.querySelector('#v36Player').click();
  await wait(20);
  assert.equal(document.querySelector('#profile').classList.contains('active'), true, 'profile did not open from stat');
  window.show('home');

  document.querySelector('#v36Swipe').click();
  await wait(20);
  assert.equal(document.querySelector('#swipe').classList.contains('active'), true);
  assert.ok(document.querySelector('#swipeCard .v31Passport'));
  assert.ok(document.querySelector('#swipeCard .v33Context'));
  assert.match(document.querySelector('#swipeCard .v31Line').textContent, /Префлоп/i);
  assert.notEqual(window.getComputedStyle(document.querySelector('.swipeContext')).display, 'none');

  window.show('home');
  document.querySelector('#v36Sizing').click();
  await wait(20);
  const sizing = document.querySelector('#sizeLock');
  assert.ok(document.querySelector('#sizeRange + .v33DirectInput'));
  assert.ok(document.querySelector('.v33SizingContext'));
  sizing.click(); sizing.click();
  await wait(20);
  assert.equal(window.S.events.filter(e => e.mode === 'sizing').length, 1);

  const beforeDaily = window.S.events.length;
  window.recordEvent({mode: 'daily', spotId: 'TEST_DAILY', concept: 'test', grade: 'g', action: 'BET'});
  window.recordEvent({mode: 'daily', spotId: 'TEST_DAILY', concept: 'test', grade: 'g', action: 'BET'});
  assert.equal(window.S.events.length, beforeDaily + 1);
  assert.ok(window.S.skill <= 55, `Skill jumped to ${window.S.skill}`);

  window.S.streak = 11; window.S.lastDay = '2025-01-01'; window.touchDay();
  assert.equal(window.S.streak, 1);

  window.show('profile');
  await wait(100);
  assert.ok(document.querySelector('.v38You'), 'profile v38 layout missing');
  assert.match(document.querySelector('#profileArea').textContent, /ТВОЯ ИГРА/i);
  assert.match(document.querySelector('#profileArea').textContent, /УРОВЕНЬ ИГРЫ/i);

  for (const screen of ['review', 'daily', 'xray']) {
    window.show(screen);
    await wait(20);
    assert.equal(document.querySelector(`#${screen}`).classList.contains('active'), true, `${screen} did not open`);
    assert.ok(document.querySelector(`#${screen}`).textContent.trim().length > 20, `${screen} rendered empty`);
  }

  window.show('myhands');
  document.querySelector('.eqCard').click();
  await wait(30);
  assert.deepEqual(['eh1','eh2','ev1','ev2'].map(id => document.querySelector('#'+id).dataset.card), ['As','Kh','Qc','Qd']);
  assert.match(document.querySelector('#eqout').textContent, /46\.2%/);

  window.myGo18('push');
  await wait(40);
  assert.equal(document.querySelectorAll('#v33PushMatrix .v33MatrixCell').length, 169);
  assert.ok(document.querySelector('#stack18 + .v33DirectInput'));

  assert.equal(window.t23Num('10,5'), 10.5);
  assert.equal(window.t23Return({prize: 100, bountyWon: 25}), 125);

  window.show('tournaments');
  window.openTournamentForm23();
  await wait(20);
  document.querySelector('#t23Name').value = 'V32 bounty test';
  document.querySelector('#t23Buyin').value = '10,5';
  document.querySelector('#t23Entries').value = '2';
  document.querySelector('#t23BCount').value = '3';
  document.querySelector('#t23BWon').value = '25,5';
  document.querySelector('#t23Prize').value = '100';
  document.querySelector('#t23Place').value = '4';
  document.querySelector('#t23Field').value = '120';
  document.querySelector('#t23Save').click();
  await wait(20);
  const tournament = window.S.tournaments.find(t => t.name === 'V32 bounty test');
  assert.ok(tournament);
  assert.equal(tournament.buyin, 10.5);
  assert.equal(tournament.bountyWon, 25.5);
  assert.equal(window.t23Profit(tournament), 104.5);
  window.openTournament23(tournament.id);
  await wait(20);
  assert.match(document.querySelector('#modalBody').textContent, /ВЕРНУЛОСЬ/);
  assert.match(document.querySelector('#modalBody').textContent, /3 · \$26/);
  window.closeModal();

  const originalAnalyze = window.GTOBrainV20.analyze;
  window.GTOBrainV20.analyze = () => ({actions: {FOLD: 0.04, RAISE: 0.96}});
  window.HR22 = window.hr22Fresh();
  window.HR22.hero = ['As', 'Kh'];
  window.HR22.streets.pre.heroAction = 'FOLD';
  assert.equal(window.hr22StreetEval('pre').status, 'bad');
  window.GTOBrainV20.analyze = originalAnalyze;

  window.HR22 = window.hr22Fresh();
  window.HR22.hero = ['As', 'Kh'];
  window.hr22Report(false);
  assert.match(document.querySelector('#modalBody').textContent, /хотя бы действие Hero/i);
  window.closeModal();
  window.S.drafts.hand = {stale: true};
  window.HR22.streets.pre.heroAction = 'FOLD';
  window.hr22Save();
  assert.equal(window.S.drafts.hand, undefined);

  window.HR22 = window.hr22Fresh();
  window.HR22.hero = ['As', 'Kh'];
  window.HR22.step = 1;
  window.HR22.street = 'pre';
  window.HR22.streets.pre.heroAction = 'RAISE';
  window.reconView18();
  await wait(30);
  assert.ok(document.querySelector('#v33HistoryNote'));
  assert.ok(document.querySelector('#hrhsize + .v33DirectInput'));

  window.show('xray');
  await wait(30);
  document.querySelector('#v33XrayCustom').click();
  document.querySelector('#v33XrStart').click();
  assert.equal(document.querySelectorAll('#v33XrMatrix .v33MatrixCell').length, 169);

  window.quick.active = true; window.quick.index = 2;
  window.show('home');
  assert.equal(window.quick.active, false);

  window.S.healCourses.river_bluffcatch = [1,1,1,1];
  window.show('heal');
  document.querySelector('#healStart').click();
  assert.match(document.querySelector('#modalBody').textContent, /КУРС ЗАКРЫТ/);

  assert.equal(realErrors(app.errors).length, 0, realErrors(app.errors).join('\n'));
  console.log('PokerSwipe V33 DOM regression: OK');
  window.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
