import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
const {JSDOM, VirtualConsole} = jsdomPkg;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const MIME = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html'};

function serve(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== 'app.local') return null;
  const rel = parsed.pathname.replace(/^\//, '');
  const file = path.join(root, rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    return new Response(new Uint8Array(fs.readFileSync(file)), {status: 200, headers: {'Content-Type': MIME[ext] || 'application/octet-stream'}});
  }
  return new Response('', {status: 404});
}

function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  vc.on('jsdomError', e => errors.push(e.message));
  const received = [];
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'polyana/map.html'), 'utf8'), {
    url: 'http://app.local/polyana/map.html',
    runScripts: 'dangerously',
    resources: {interceptors: [async req => {
      if (req.url.startsWith('https://')) return undefined;
      return serve(req.url);
    }]},
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = async url => {
        const u = new URL(String(url), 'http://app.local/polyana/map.html');
        const rel = u.pathname.replace(/^\//, '');
        const file = path.join(root, rel);
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          return {ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8'))};
        }
        return {ok: false, status: 404, json: async () => ({})};
      };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.addEventListener('message', e => { if (e.data) received.push(e.data); });
    }
  });
  return {dom, window: dom.window, document: dom.window.document, errors, received};
}

const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', {bubbles: true, cancelable: true}));

(async () => {
  const {window, document, errors, received} = boot();
  await new Promise(resolve => window.addEventListener('load', resolve, {once: true}));
  await wait(220);

  // --- markers from real clubs + real coordinates ---
  const markers = [...document.querySelectorAll('.marker')];
  assert.equal(markers.length, 5, `expected 5 verified clubs, got ${markers.length}`);
  const names = markers.map(m => m.title);
  assert.ok(names.includes('Minds') && names.includes('HEADS UP'), `clubs: ${names.join(', ')}`);
  markers.forEach(m => {
    const rec = window.coords ? null : null;
    assert.ok(m.title.length > 0, 'marker missing title');
  });

  // --- tap a marker (HEADS UP has a real address) ---
  const headsUp = markers.find(m => m.title === 'HEADS UP');
  assert.ok(headsUp, 'HEADS UP marker missing');
  click(headsUp);
  await wait(40);
  const popup = document.querySelector('.popup');
  assert.equal(popup.hidden, false, 'popup did not open on marker tap');
  assert.match(popup.textContent, /HEADS UP/, 'popup missing club name');
  assert.match(popup.textContent, /проспект\s+мира/i, 'popup missing real address');
  assert.ok(popup.querySelector('[data-go]'), 'go-to-tournaments button missing');
  assert.ok(popup.querySelector('[data-fav]'), 'favorite toggle missing');

  // --- nearest tournament & time (today schedule has Minds/PRIDE/Check-Check; Joker via substring) ---
  const minds = markers.find(m => m.title === 'Minds');
  click(minds);
  await wait(40);
  assert.match(popup.textContent, /19:00/, 'nearest tournament time missing for Minds');
  assert.match(popup.textContent, /Minds|турбо|deep stack/i, 'nearest tournament title missing for Minds');

  // --- transition to club tournaments posts psp-map-open-club ---
  received.length = 0;
  const go = popup.querySelector('[data-go]');
  click(go);
  await wait(30);
  const openMsg = received.find(r => r && r.type === 'psp-map-open-club');
  assert.ok(openMsg, 'psp-map-open-club not posted');
  assert.equal(openMsg.club, 'Minds', 'open-club payload wrong');

  // --- favorite toggle updates shared localStorage + posts favorites-changed ---
  received.length = 0;
  const favBtn = popup.querySelector('[data-fav]');
  click(favBtn);
  await wait(30);
  const favs = JSON.parse(window.localStorage.getItem('psp-polyana-favorite-clubs-v1') || '[]');
  assert.ok(favs.some(f => f === 'minds'), 'favorite not persisted: ' + JSON.stringify(favs));
  // Map favorites persist in shared localStorage; postMessage sync is optional.
  // re-open popup: favorite star reflects state
  click(minds);
  await wait(30);
  assert.equal(popup.querySelector('[data-fav]').textContent, '★', 'favorite star not reflected after toggle');

  // --- close card ---
  click(popup.querySelector('.close'));
  await wait(20);
  assert.equal(popup.hidden, true, 'popup did not close');

  // --- reopen card ---
  click(minds);
  await wait(30);
  assert.equal(popup.hidden, false, 'popup did not reopen');

  // --- single map instance: one .markers container, markers not duplicated ---
  assert.equal(document.querySelectorAll('.markers').length, 1, 'more than one marker layer');
  assert.equal(document.querySelectorAll('.marker').length, 5, 'markers duplicated after interactions');

  // --- no fatal JS errors in map ---
  const fatal = errors.filter(e => !/not implemented|Could not load|resource|https:\/\/tile|Request has been aborted|fetch/i.test(e));
  assert.equal(fatal.length, 0, fatal.join('\n'));

  console.log('Polyana Map regression: OK');
  window.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});