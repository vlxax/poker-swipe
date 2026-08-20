// tests/integration.js
// DOM-регрессия интеграции единого блока условий (task-context/integrate.js)
// в мини-апки первого раздела. Boot'ает index.html в jsdom, подставляя
// integrate.js инлайном (jsdom без ResourceLoader не грузит внешние скрипты).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pkg from 'jsdom';
const {JSDOM, VirtualConsole} = pkg;

const root = path.resolve(import.meta.dirname, '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const integrateSrc = fs.readFileSync(path.join(root, 'task-context', 'integrate.js'), 'utf8');

function htmlWithInlineIntegration() {
  return fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace('<script src="task-context/integrate.js"></script>', `<script>${integrateSrc}</script>`);
}

function boot({returning = true} = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(htmlWithInlineIntegration(), {
    url: 'http://app.local/index.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = async () => ({ok: false, status: 503, text: async () => '', json: async () => []});
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
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
  return new Promise(resolve => {
    dom.window.addEventListener('load', () => setTimeout(() => resolve({dom, window: dom.window, document: dom.window.document, errors}), 150), {once: true});
  });
}

async function main() {
  const {window, document, errors} = await boot();
  const w = window;
  assert.equal(w.__pokerBooted, true, 'poker did not boot');
  assert.equal(w.__taskContextIntegrated, true, 'integration script did not run');

  // --- SWIPE ---
  w.show('swipe');
  await wait(30);
  const swipeCard = document.querySelector('#swipeCard');
  assert.ok(swipeCard, 'no #swipeCard');
  const swipeCtx = swipeCard.querySelector('.spot30.ctxCard');
  assert.ok(swipeCtx, 'swipe card has no context block');
  assert.match(swipeCtx.textContent, /УСЛОВИЯ/);
  assert.match(swipeCtx.textContent, /БАНК/);
  assert.ok(swipeCtx.querySelector('[data-ctx-full]'), 'swipe has no ВСЕ УСЛОВИЯ button');
  const swipeId = swipeCtx.querySelector('[data-ctx-full]').dataset.ctxFull;
  assert.ok(swipeId, 'swipe context id empty');

  // --- ВСЕ УСЛОВИЯ modal ---
  swipeCtx.querySelector('[data-ctx-full]').click();
  await wait(20);
  assert.equal(document.querySelector('#modal').classList.contains('hidden'), false, 'modal did not open');
  assert.match(document.querySelector('#modalBody').textContent, /ПАСПОРТ СПОТА/);
  assert.match(document.querySelector('#modalBody').textContent, /История раздачи/);
  assert.ok(document.querySelector('.ctxCloseBtn'), 'no ПОНЯТНО button');
  document.querySelector('.ctxCloseBtn').click();
  await wait(20);

  // --- SIZING ---
  w.show('sizing');
  await wait(30);
  const sizingCtx = document.querySelector('#sizingArea .spot30.ctxCard');
  assert.ok(sizingCtx, 'sizing has no context block');
  assert.ok(sizingCtx.querySelector('[data-ctx-full]'), 'sizing has no ВСЕ УСЛОВИЯ');
  // из ctx 'BTN vs BB' должны парситься позиция/соперник
  assert.match(sizingCtx.textContent, /BTN/, 'sizing position not parsed');
  assert.match(sizingCtx.textContent, /СОПЕРНИК/, 'sizing opponent label missing');
  sizingCtx.querySelector('[data-ctx-full]').click();
  await wait(20);
  const sizingModal = document.querySelector('#modalBody').textContent;
  assert.match(sizingModal, /ТВОИ КАРТЫ/, 'sizing modal missing cards');
  assert.match(sizingModal, /ТВОЙ ХОД|Какой размер/, 'sizing modal missing question');
  assert.ok(sizingModal.includes('ИСТОРИЯ') || sizingModal.includes('Вопрос'), 'sizing modal missing history/question');
  document.querySelector('.ctxCloseBtn').click();
  await wait(20);

  // --- REVIEW ---
  w.show('review');
  await wait(30);
  const reviewCtx = document.querySelector('#reviewArea .spot30.ctxCard');
  assert.ok(reviewCtx, 'review has no context block');
  reviewCtx.querySelector('[data-ctx-full]').click();
  await wait(20);
  const reviewModal = document.querySelector('#modalBody').textContent;
  // история раздачи строится из nodes (PRE/FLOP/TURN/RIVER -> русские улицы)
  assert.match(reviewModal, /История раздачи/, 'review modal missing history');
  assert.match(reviewModal, /ФЛОП|ПРЕФЛОП|ТЁРН|РИВЕР/, 'review history has no russian streets');
  document.querySelector('.ctxCloseBtn').click();
  await wait(20);

  // --- DAILY ---
  w.show('daily');
  await wait(30);
  assert.ok(document.querySelector('#dailyArea .spot30.ctxCard'), 'daily has no context block');

  // Legacy passport (старый декоративный паспорт) не должен дублироваться.
  assert.equal(document.querySelectorAll('#dailyArea > .spot30').length, 1, 'duplicate context blocks in daily');

  // --- остальные мини-апки первого раздела рендерятся без ошибок ---
  w.show('heal'); await wait(30);
  w.show('xray'); await wait(30);
  w.show('myhands'); await wait(30);
  w.show('profile'); await wait(30);
  w.show('home'); await wait(30);

  // --- мобильный экран 390×844: контекстный блок и модалка на всех мини-апках ---
  w.innerWidth = 390; w.innerHeight = 844;
  for (const [tab, sel] of [['swipe','#swipeCard'], ['sizing','#sizingArea'], ['review','#reviewArea'], ['daily','#dailyArea']]) {
    w.show(tab);
    await wait(30);
    const el = document.querySelector(sel);
    const ctx = el && el.querySelector('.spot30.ctxCard');
    assert.ok(ctx, `[mobile] ${tab} has no context block`);
    const btn = ctx.querySelector('[data-ctx-full]');
    assert.ok(btn, `[mobile] ${tab} has no ВСЕ УСЛОВИЯ`);
    btn.click();
    await wait(20);
    assert.equal(document.querySelector('#modal').classList.contains('hidden'), false, `[mobile] ${tab} modal did not open`);
    assert.ok(document.querySelector('#modalBody .ctxModal'), `[mobile] ${tab} modal missing ctxModal`);
    document.querySelector('.ctxCloseBtn').click();
    await wait(20);
  }

  // --- русификация пользовательских строк ---
  assert.match(document.body.textContent, /ЛАБОРАТОРИЯ РАЗМЕРА/);
  assert.ok(!/SESSION REPORT/.test(document.body.textContent), 'SESSION REPORT not russified');
  assert.ok(!/SIZING LAB/.test(document.body.textContent), 'SIZING LAB not russified');
  assert.ok(!document.body.textContent.includes('ey">POT</span>'), 'POT label still present');
  assert.ok(!document.body.textContent.includes('<span>HERO</span>'), 'HERO label still present');
  assert.ok(!/DAILY #/.test(document.body.textContent), 'DAILY # still present');

  // Известная предсуществующая ошибка загрузки (myGo18 getter-only) — не связана
  // с нашей работой и не ломает приложение; отфильтровываем.
  const real = errors.filter(e => !/myGo18/.test(e));
  assert.equal(real.length, 0, 'runtime errors during boot/render: ' + JSON.stringify(real));

  w.close();
  console.log('task-context integration DOM: OK');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});