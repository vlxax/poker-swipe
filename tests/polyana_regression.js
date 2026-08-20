import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
const {JSDOM, VirtualConsole, requestInterceptor} = jsdomPkg;

// jsdom teardown can throw on queued rAF after window.close(); ignore that artifact.
process.on('uncaughtException', err => {
  if (err && /reading '_location'/.test(String(err.message))) return;
  console.error(err);
  process.exit(1);
});

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const MIME = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png'};

class FakeWorker {
  postMessage(message) {
    setTimeout(() => this.onmessage?.({data: {id: message.id, result: {h: 46.2, v: 53.8, n: message.samples, approx: true}}}), 5);
  }
  terminate() {}
}

const NOISE = /Not implemented|Could not load|iframe|resource|URL|fetch|myGo18|telegram/i;

function boot() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://app.local/index.html',
    runScripts: 'dangerously',
    resources: {interceptors: [
      requestInterceptor(async request => {
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
      window.fetch = async url => {
        const parsed = new URL(String(url), 'http://app.local/');
        const file = path.join(root, parsed.pathname.replace(/^\//, ''));
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          return {ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8'))};
        }
        return {ok: false, status: 404, json: async () => ({})};
      };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.Worker = FakeWorker;
      window.alert = () => {};
      window.Math.random = () => 0.42;
      window.innerWidth = 390;
      window.innerHeight = 844;

      const probes = {docListeners: 0, winListeners: 0, observers: 0};
      window.__pspProbes = probes;
      const doc = window.document;
      const wrapAdd = (target, kind, fn, ctx) => function(type, handler, ...rest) {
        if (type && typeof handler === 'function') probes[kind]++;
        return fn.call(this, type, handler, ...rest);
      };
      const wrapRemove = (target, kind, fn, ctx) => function(type, handler, ...rest) {
        if (type && typeof handler === 'function') probes[kind]--;
        return fn.call(this, type, handler, ...rest);
      };
      const dAdd = doc.addEventListener.bind(doc), dRemove = doc.removeEventListener.bind(doc);
      const wAdd = window.addEventListener.bind(window), wRemove = window.removeEventListener.bind(window);
      doc.addEventListener = wrapAdd(doc, 'docListeners', dAdd);
      doc.removeEventListener = wrapRemove(doc, 'docListeners', dRemove);
      window.addEventListener = wrapAdd(window, 'winListeners', wAdd);
      window.removeEventListener = wrapRemove(window, 'winListeners', wRemove);
      const RealMO = window.MutationObserver;
      if (RealMO) {
        window.MutationObserver = function(...a) { probes.observers++; return new RealMO(...a); };
        window.MutationObserver.prototype = RealMO.prototype;
      }
    }
  });
  return {dom, window: dom.window, document: dom.window.document, errors, probes: dom.window.__pspProbes};
}

const realErrors = errors => errors.filter(e => !NOISE.test(e));
const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', {bubbles: true, cancelable: true}));
const body = document => document.getElementById('pspBody');

(async () => {
  const app = boot();
  const {window, document} = app;
  await new Promise(resolve => window.addEventListener('load', resolve, {once: true}));
  await wait(120);

  // Canonical Polyana owns the section.
  assert.equal(window.__PSP_NATIVE_POLYANA, true, 'canonical polyana flag not set');
  assert.ok(window.__POLYANA_BUILD, 'polyana build marker missing');
  assert.equal(typeof window.openPokerSwipePolyana, 'function', 'openPokerSwipePolyana missing');

  // Open Polyana via nav (isolated capture listener must work).
  const navBtn = document.querySelector('.nav [data-nav="polyana"]');
  assert.ok(navBtn, 'polyana nav button missing');
  click(navBtn);
  await wait(150);
  assert.equal(document.querySelector('#polyana').classList.contains('active'), true, 'polyana screen did not open');

  // Data load populates the today list.
  assert.ok(body(document), '#pspBody missing');
  const events = body(document).querySelectorAll('.pspEvent');
  assert.ok(events.length > 0, 'no events rendered in today view');

  // Guards: legacy injected filter UIs must NOT exist.
  assert.equal(document.getElementById('polyanaFiltersV3'), null, 'filters-v3 overlay present (guard failed)');
  assert.equal(document.querySelector('.psf2Toolbar'), null, 'promo V2 filter toolbar present (guard failed)');
  assert.equal(document.querySelector('#polyana .psf2Chip'), null, 'promo V2 chip present (guard failed)');

  // Guards reduce legacy injected modules to inert build-marked stubs.
  const v3Guard = window.PokerSwipePolyanaFiltersV3;
  assert.ok(v3Guard, 'filters-v3 guard stub missing');
  assert.equal(v3Guard.build, 'polyana-filters-v3-20260818', 'filters-v3 build marker wrong');
  assert.equal(typeof v3Guard.open, 'function', 'filters-v3 open not stubbed');
  assert.equal(typeof v3Guard.refresh, 'function', 'filters-v3 refresh not stubbed');
  assert.equal(typeof v3Guard.reset, 'function', 'filters-v3 reset not stubbed');
  assert.equal(v3Guard.open(), undefined, 'filters-v3 open not inert');

  const v2Guard = window.PokerSwipePolyanaFiltersV2;
  assert.ok(v2Guard, 'filters-v2 guard stub missing');
  assert.equal(v2Guard.build, 'polyana-filters-v2', 'filters-v2 build marker wrong');
  assert.equal(typeof v2Guard.refresh, 'function', 'filters-v2 refresh not stubbed');
  assert.equal(typeof v2Guard.reset, 'function', 'filters-v2 reset not stubbed');
  assert.equal(v2Guard.refresh(), undefined, 'filters-v2 refresh not inert');

  // Promo decor stays active (decorates today cards).
  assert.ok(window.PokerSwipePolyanaPromo, 'polyana promo decor missing');
  assert.equal(typeof window.PokerSwipePolyanaPromo.refresh, 'function', 'promo decor refresh missing');

  // Late-reg: live data may attach late-reg badges to multiple events; validate shape, not a fixed count.
  const lateNodes = body(document).querySelectorAll('[data-late-event]');
  assert.ok(lateNodes.length >= 1, `expected at least 1 late-reg card, got ${lateNodes.length}`);
  lateNodes.forEach((node) => {
    assert.match(node.textContent, /Late reg (до|закрыт)/, `unexpected late text: ${node.textContent}`);
  });

  // Filters open.
  click(body(document).querySelector('[data-psp-filters]'));
  await wait(30);
  const filters = document.getElementById('pspFilters');
  assert.ok(filters.classList.contains('on'), 'filters overlay did not open');
  assert.equal(filters.style.display, 'flex', 'filters overlay display not flex');
  assert.ok(document.body.classList.contains('pspFilterLock'), 'body not locked when filters open');

  // Apply a real filter: freezeout=yes (data-driven count).
  const freezeoutChip = filters.querySelector('.pspChoice[data-key="freezeout"][data-value="yes"]');
  assert.ok(freezeoutChip, 'freezeout filter chip missing');
  click(freezeoutChip);
  const applyBtn = filters.querySelector('[data-psp-apply]');
  const expected = Number((applyBtn.textContent.match(/(\d+)/) || [])[1]);
  assert.ok(expected > 0 && expected < events.length, `freezeout count out of range: ${expected}`);
  click(applyBtn);
  await wait(30);
  assert.equal(filters.classList.contains('on'), false, 'filters overlay did not close on apply');
  const filteredEvents = body(document).querySelectorAll('.pspEvent');
  assert.equal(filteredEvents.length, expected, 'rendered event count != apply count');
  assert.match(body(document).textContent, /ФИЛЬТРЫ\s*1\s*Freezeout: есть/, 'active filter badge missing');

  // Reset restores full list.
  click(body(document).querySelector('[data-filter-reset]'));
  await wait(30);
  assert.equal(body(document).querySelectorAll('.pspEvent').length, events.length, 'reset did not restore full list');

  // Clubs tab + favorites.
  click(document.querySelector('#polyana [data-psp-tab="clubs"]'));
  await wait(30);
  const rows = body(document).querySelectorAll('.pspClubRow');
  assert.ok(rows.length > 0, 'no club rows rendered');
  click(rows[0].querySelector('.pspClubStar'));
  const favs = JSON.parse(window.localStorage.getItem('psp-polyana-favorite-clubs-v1') || '[]');
  assert.equal(favs.length, 1, 'favorite not persisted');
  assert.ok(body(document).querySelector('.pspClubRow.favorite'), 'favorite row class missing');

  // Un-favorite to leave clean state, then back to today.
  click(body(document).querySelector('.pspClubRow.favorite .pspClubStar'));
  await wait(20);
  assert.equal(JSON.parse(window.localStorage.getItem('psp-polyana-favorite-clubs-v1') || '[]').length, 0, 'un-favorite failed');
  click(document.querySelector('#polyana [data-psp-tab="today"]'));
  await wait(20);

  // Detail: event with late-reg shows real info; event without shows fallback.
  const lateCard = document.querySelector('[data-late-event]').closest('.pspEvent');
  click(lateCard);
  await wait(30);
  const detail = document.getElementById('pspDetail');
  assert.ok(detail.classList.contains('on'), 'detail overlay did not open');
  assert.match(detail.textContent, /Late reg (до|закрыт)/, 'detail late-reg real info missing');
  click(detail.querySelector('[data-psp-detail-close]'));
  await wait(20);

  const firstPlain = [...body(document).querySelectorAll('.pspEvent')].find(c => !c.querySelector('[data-late-event]'));
  assert.ok(firstPlain, 'no plain (no late-reg) event found');
  click(firstPlain);
  await wait(30);
  assert.match(document.getElementById('pspDetail').textContent, /Late reg · уточняется/, 'detail late-reg fallback missing');
  click(document.getElementById('pspDetail').querySelector('[data-psp-detail-close]'));
  await wait(20);

  // Map tab present: single instance, real src, not overlapping bottom nav.
  click(document.querySelector('#polyana [data-psp-tab="map"]'));
  await wait(40);
  const mapFrames = document.querySelectorAll('#pspMoscowMapFrame');
  assert.equal(mapFrames.length, 1, 'more than one map iframe present');
  const mapFrame = mapFrames[0];
  assert.ok(mapFrame, 'map iframe missing');
  assert.match(mapFrame.getAttribute('src'), /map\.html/, 'map iframe src wrong');
  const mapPanel = mapFrame.closest('.pspMapPanel');
  assert.ok(mapPanel, 'map panel missing');
  const panelStyle = window.getComputedStyle(mapPanel);
  assert.notEqual(panelStyle.position, 'fixed', 'map panel must stay in scroll flow, not fixed');
  const nav = document.querySelector('.nav');
  assert.ok(nav, 'bottom nav missing');
  const navZ = Number(window.getComputedStyle(nav).zIndex) || 0;
  const mapZ = Number(window.getComputedStyle(mapFrame).zIndex) || 0;
  assert.ok(navZ > mapZ, `nav (z=${navZ}) must sit above map iframe (z=${mapZ})`);

  // Mobile viewport 390x844: map iframe fits, panel stays in flow, no fixed pixel width.
  assert.equal(window.innerWidth, 390, 'viewport width not applied');
  const boxStyle = window.getComputedStyle(mapFrame);
  // jsdom may not compute iframe layout; when width is available it must stay responsive.
  if (boxStyle.width) {
    assert.equal(/\d+px/.test(boxStyle.width), false, 'map iframe must not use fixed pixel width on mobile');
  }
  assert.notEqual(panelStyle.position, 'fixed', 'map panel must not cover bottom nav on mobile');
  assert.ok(navZ > mapZ, 'bottom nav must remain above map on mobile viewport');

  // Transition from map: "Турниры клуба →" posts psp-map-open-club; parent filters today list by club.
  click(document.querySelector('#polyana [data-psp-tab="today"]'));
  await wait(30);
  const beforeOpenClub = body(document).querySelectorAll('.pspEvent').length;
  assert.ok(beforeOpenClub > 0, 'no events to filter from map transition');
  window.dispatchEvent(new window.MessageEvent('message', {data: {type: 'psp-map-open-club', club: 'Minds'}, origin: window.location.origin}));
  await wait(30);
  const clubFiltered = body(document).querySelectorAll('.pspEvent');
  assert.ok(clubFiltered.length > 0, 'open-club filter left today list empty');
  assert.ok(clubFiltered.length < beforeOpenClub, `open-club did not narrow list: before=${beforeOpenClub} after=${clubFiltered.length}`);
  [...clubFiltered].forEach(card => assert.match(card.textContent, /Minds/, 'non-matching club shown after open-club filter'));

  // Baseline leak probes before the stress loop.
  const baseDoc = app.probes.docListeners;
  const baseWin = app.probes.winListeners;
  const baseObs = app.probes.observers;

  // Navigation loop: polyana -> today -> detail -> close -> filters -> reset -> clubs -> map -> profile -> polyana.
  const iterTimes = [];
  for (let i = 0; i < 20; i++) {
    const t0 = Date.now();
    click(navBtn);
    await wait(40);
    click(document.querySelector('#polyana [data-psp-tab="today"]'));
    await wait(20);
    const anyEvent = body(document).querySelector('.pspEvent');
    if (anyEvent) {
      click(anyEvent);
      await wait(20);
      click(document.getElementById('pspDetail').querySelector('[data-psp-detail-close]'));
      await wait(15);
    }
    click(body(document).querySelector('[data-psp-filters]'));
    await wait(15);
    click(document.getElementById('pspFilters').querySelector('[data-filter-reset]'));
    await wait(15);
    click(document.querySelector('#polyana [data-psp-tab="clubs"]'));
    await wait(20);
    click(document.querySelector('#polyana [data-psp-tab="map"]'));
    await wait(30);
    assert.equal(document.querySelectorAll('#pspMoscowMapFrame').length, 1, 'map iframe duplicated in loop');
    window.show('profile');
    await wait(15);
    assert.equal(document.querySelector('#profile').classList.contains('active'), true, 'profile did not open in loop');
    iterTimes.push(Date.now() - t0);
    // No overlay left open at end of iteration.
    assert.equal(document.getElementById('pspDetail').classList.contains('on'), false, 'detail overlay leaked in loop');
    assert.equal(document.getElementById('pspFilters').classList.contains('on'), false, 'filters overlay leaked in loop');
  }
  click(navBtn);
  await wait(40);
  assert.equal(document.querySelector('#polyana').classList.contains('active'), true, 'polyana did not reopen after loop');

  // No overlay left open after the whole loop.
  assert.equal(document.getElementById('pspDetail').classList.contains('on'), false, 'detail overlay leaked after loop');
  assert.equal(document.getElementById('pspFilters').classList.contains('on'), false, 'filters overlay leaked after loop');

  // No listener/observer growth across the stress loop (fixed listeners only).
  assert.ok(app.probes.docListeners <= baseDoc + 2, `document listeners grew: ${baseDoc} -> ${app.probes.docListeners}`);
  assert.ok(app.probes.winListeners <= baseWin + 2, `window listeners grew: ${baseWin} -> ${app.probes.winListeners}`);
  assert.ok(app.probes.observers <= baseObs + 2, `MutationObservers grew: ${baseObs} -> ${app.probes.observers}`);

  // No speed degradation: first third vs last third of iterations.
  const n = iterTimes.length;
  const first = iterTimes.slice(0, Math.floor(n / 3)).reduce((a, b) => a + b, 0) / Math.floor(n / 3);
  const last = iterTimes.slice(Math.floor(2 * n / 3)).reduce((a, b) => a + b, 0) / (n - Math.floor(2 * n / 3));
  assert.ok(last < first * 2.5 + 30, `speed degraded: first=${first.toFixed(0)}ms last=${last.toFixed(0)}ms`);

  // No real JS errors (polyana/isolated logic clean; pre-existing app noise filtered).
  const real = realErrors(app.errors);
  assert.equal(real.length, 0, real.join('\n'));

  console.log('Polyana DOM regression: OK');
  window.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});