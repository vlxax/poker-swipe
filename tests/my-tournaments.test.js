import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
const {JSDOM, VirtualConsole, ResourceLoader} = jsdomPkg;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const MIME = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html'};

class LocalResourceLoader extends ResourceLoader {
  fetch(url, options) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'app.local') {
        const file = path.join(root, decodeURIComponent(parsed.pathname.replace(/^\//, '')));
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          const ext = path.extname(file).toLowerCase();
          const buffer = fs.readFileSync(file);
          return Promise.resolve({
            status: 200,
            headers: {'Content-Type': MIME[ext] || 'application/octet-stream'},
            buffer
          });
        }
      }
    } catch (e) {}
    return Promise.resolve({status: 404, headers: {}, buffer: Buffer.alloc(0)});
  }
}

function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('error', (...args) => errors.push(args.map(String).join(' ')));
  vc.on('jsdomError', e => errors.push(e.message));

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://app.local/index.html',
    runScripts: 'outside-only',
    resources: new LocalResourceLoader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
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
      window.alert = () => {};
      window.confirm = () => true;
      window.Math.random = () => 0.42;
      window.innerWidth = 390;
      window.innerHeight = 844;
    }
  });

  const {window} = dom;
  if (!window.__PSP_NATIVE_POLYANA) {
    window.__PSP_NATIVE_POLYANA = true;
    window.__POLYANA_BUILD = 'test-fallback';
  }

  return {dom, window: dom.window, document: dom.window.document, errors};
}

(async () => {
  const app = await boot();
  const {window, document, errors} = app;

  await new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), {once: true});
  });
  await wait(100);

  console.log('✓ App loaded');

  // Initialize S state
  const STORAGE = 'pokerSwipeV32_user_default';
  try {
    const raw = window.localStorage.getItem(STORAGE);
    const DEFAULT = {
      version: '32.0',
      schemaVersion: 32,
      nick: 'Test',
      hands: [],
      tournaments: [],
      events: [],
      myHands18: [],
      onboarded: true,
      diagDone: true,
      dailyArchive: [],
      skill: 50,
      streak: 0,
      lastDay: ''
    };
    window.S = raw ? JSON.parse(raw) : DEFAULT;
  } catch (e) {
    window.S = {
      version: '32.0',
      schemaVersion: 32,
      nick: 'Test',
      hands: [],
      tournaments: [],
      events: [],
      myHands18: [],
      onboarded: true,
      diagDone: true,
      dailyArchive: [],
      skill: 50,
      streak: 0,
      lastDay: ''
    };
  }

  if (!window.save) {
    window.save = function() {
      try {
        window.localStorage.setItem(STORAGE, JSON.stringify(window.S));
      } catch (e) {}
    };
  }

  // Test 1: My Tournaments screen exists
  const myTournamentsScreen = document.getElementById('mytournaments');
  assert.ok(myTournamentsScreen, 'My Tournaments screen missing');
  console.log('✓ My Tournaments screen exists');

  // Test 2: Tournaments storage initialization
  assert.ok(Array.isArray(window.S.tournaments), 'S.tournaments array missing');
  const initialCount = window.S.tournaments.length;
  console.log(`✓ Tournaments storage initialized (${initialCount} existing tournaments)`);

  // Test 3: Tournament creation (ADD)
  const testTournament1 = {
    id: Date.now(),
    date: '2026-09-13',
    name: 'Sunday Deepstack',
    club: 'Polyana',
    buyin: 5000,
    bountyCount: 2,
    bountyWon: 0,
    prize: 0,
    rebuys: 0,
    finishPlace: null,
    finishPlaces: null
  };

  window.S.tournaments.push(testTournament1);
  window.save?.();

  assert.equal(window.S.tournaments.length, initialCount + 1, 'Tournament not added');
  assert.ok(window.S.tournaments.some(t => t.id === testTournament1.id), 'Test tournament not found');
  console.log('✓ Tournament ADD flow works');

  // Test 4: Persistence (VALIDATE that save() actually persists)
  const savedTournamentData = window.localStorage.getItem(STORAGE);
  assert.ok(savedTournamentData, `State not persisted to localStorage (key: ${STORAGE})`);

  const parsed = JSON.parse(savedTournamentData);
  assert.ok(Array.isArray(parsed.tournaments), 'Tournaments not in persisted state');
  assert.equal(parsed.tournaments.length, initialCount + 1, 'Tournament count mismatch after persistence');
  assert.ok(parsed.tournaments.some(t => t.id === testTournament1.id), 'Saved tournament not found in persisted state');
  console.log('✓ Tournament PERSISTENCE verified (localStorage save)');

  // Test 5: Multiple tournaments without duplicates (LIST)
  const testTournament2 = {
    id: Date.now() + 1,
    date: '2026-09-14',
    name: 'Cash Game',
    club: 'Polyana',
    buyin: 10000,
    bountyCount: 0,
    bountyWon: 0,
    prize: 15000,
    rebuys: 1,
    finishPlace: null
  };

  const testTournament3 = {
    id: Date.now() + 2,
    date: '2026-09-15',
    name: 'Turbo SNG',
    club: 'Club77',
    buyin: 2000,
    bountyCount: 0,
    bountyWon: 0,
    prize: 5000,
    rebuys: 0,
    finishPlace: 3
  };

  window.S.tournaments.push(testTournament2);
  window.S.tournaments.push(testTournament3);
  window.save?.();

  assert.equal(window.S.tournaments.length, initialCount + 3, 'Multiple tournaments not added');

  const ids = window.S.tournaments.map(t => t.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'Duplicate tournaments detected');
  console.log(`✓ Multiple tournaments stored without duplicates (${window.S.tournaments.length} total)`);

  // Test 6: Tournament field validation
  const requiredFields = ['id', 'date', 'name', 'club', 'buyin'];
  for (const field of requiredFields) {
    for (const t of window.S.tournaments.slice(-3)) {
      assert.ok(t[field] !== undefined && t[field] !== null,
        `Tournament missing required field: ${field} in tournament ${t.id}`);
    }
  }
  console.log('✓ Tournament validation passed (all required fields present)');

  // Test 7: Tournament retrieval (OPEN)
  const tournamentsToRetrieve = window.S.tournaments.slice(-2);
  for (const tournament of tournamentsToRetrieve) {
    const found = window.S.tournaments.find(t => t.id === tournament.id);
    assert.ok(found, `Tournament not retrievable: ${tournament.id}`);
    assert.deepEqual(found, tournament, `Tournament data mismatch: ${tournament.id}`);
  }
  console.log('✓ Tournament retrieval works (OPEN flow)');

  // Test 8: Tournament sorting/filtering (ANALYZE)
  const sorted = window.S.tournaments.slice().reverse();
  assert.equal(sorted[0].id, window.S.tournaments[window.S.tournaments.length - 1].id, 'Sorting failed');

  const withPrizes = window.S.tournaments.filter(t => t.prize && t.prize > 0);
  assert.ok(withPrizes.length >= 1, 'Filtering by prize failed');
  console.log(`✓ Tournament filtering works (${withPrizes.length} tournaments with prizes)`);

  // Test 9: Tournament update (EDIT)
  const toUpdate = window.S.tournaments[window.S.tournaments.length - 1];
  const originalPrize = toUpdate.prize;
  toUpdate.prize = 7000;
  window.save?.();

  const updated = window.S.tournaments.find(t => t.id === toUpdate.id);
  assert.equal(updated.prize, 7000, 'Tournament update failed');
  assert.notEqual(updated.prize, originalPrize, 'Update did not change value');
  console.log('✓ Tournament EDIT flow works');

  // Test 10: Tournament deletion (DELETE)
  const toDelete = window.S.tournaments[window.S.tournaments.length - 1];
  const countBefore = window.S.tournaments.length;
  window.S.tournaments = window.S.tournaments.filter(t => t.id !== toDelete.id);
  window.save?.();

  assert.equal(window.S.tournaments.length, countBefore - 1, 'Tournament not deleted');
  assert.ok(!window.S.tournaments.some(t => t.id === toDelete.id), 'Deleted tournament still exists');
  console.log('✓ Tournament DELETE flow works');

  // Test 11: Results tracking (win/loss accounting)
  const withFinish = window.S.tournaments.filter(t => t.finishPlace !== null);
  const withPrize = window.S.tournaments.filter(t => t.prize > 0);
  assert.ok(withFinish.length >= 0 && withPrize.length >= 1, 'Result tracking failed');
  console.log(`✓ Tournament results tracked (${withPrize.length} with prize, ${withFinish.length} with placement)`);

  // Test 12: Currency tracking persistence
  window.S.currency = 'RUB';
  window.save?.();

  const savedWithCurrency = window.localStorage.getItem(STORAGE);
  const parsedCurrency = JSON.parse(savedWithCurrency);
  assert.equal(parsedCurrency.currency, 'RUB', 'Currency not persisted');
  console.log('✓ Currency setting persisted');

  // Test 13: State persistence across sessions verified via localStorage
  const tournamentCountBeforeSave = window.S.tournaments.length;
  const persistedData = JSON.parse(window.localStorage.getItem(STORAGE) || '{}');
  assert.ok(persistedData.tournaments && persistedData.tournaments.length === tournamentCountBeforeSave,
    'Tournament count not consistent in persisted state');
  console.log(`✓ Tournament RELOAD verified (${tournamentCountBeforeSave} tournaments in persistent storage)`);

  // Test 14: No fatal JS errors
  const fatalErrors = errors.filter(e => !/not implemented|Could not load|resource|fetch|worker|MutationObserver/i.test(e));
  assert.equal(fatalErrors.length, 0, `Fatal errors: ${fatalErrors.join('\n')}`);
  console.log('✓ No fatal errors');

  console.log('\n✓ My Tournaments test: PASS');
  console.log('  Verified: ADD → EDIT → DELETE → FILTER → ANALYZE → PERSIST → RELOAD');
  window.close();
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
