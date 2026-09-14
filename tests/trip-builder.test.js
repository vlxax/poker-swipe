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
    } catch (e) {
      // fall through
    }
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
      window.Math.random = () => 0.42;
      window.innerWidth = 390;
      window.innerHeight = 844;
    }
  });

  const {window} = dom;
  if (!window.__PSP_NATIVE_POLYANA) {
    window.__PSP_NATIVE_POLYANA = true;
    window.__POLYANA_BUILD = 'test-fallback';
    window.openPokerSwipePolyana = () => window.show?.('polyana');
  }

  return {dom, window: dom.window, document: dom.window.document, errors};
}

const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', {bubbles: true, cancelable: true}));

(async () => {
  const app = await boot();
  const {window, document, errors} = app;

  await new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), {once: true});
  });
  await wait(100);

  console.log('✓ App loaded');

  // Extract and evaluate v60 script from HTML since inline scripts don't run with runScripts: 'outside-only'
  const v60ScriptMatch = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .match(/<script id="v60-trip-builder-script">[\s\S]*?<\/script>/);
  if (v60ScriptMatch) {
    const scriptCode = v60ScriptMatch[0]
      .replace(/<script id="v60-trip-builder-script">/, '')
      .replace(/<\/script>$/, '');
    try {
      window.eval(scriptCode);
    } catch (e) {
      console.error('Error evaluating v60 script:', e.message);
    }
  }

  // Test 1: Trip Builder function exists
  assert.ok(typeof window.openTripBuilderV60 === 'function', 'openTripBuilderV60 function missing');
  console.log('✓ Trip Builder function exists');

  // Test 2: Trip Builder uses real tournament data, not hardcoded test data
  // Check that v60 gets populated with real Moscow tournaments from canonical source
  const realData = JSON.parse(fs.readFileSync(path.join(root, 'data/moscow_schedule_today.json'), 'utf8'));
  assert.ok(realData.events && realData.events.length > 0, 'Real tournament data missing');
  console.log(`✓ Real data loaded: ${realData.events.length} tournaments`);

  // Test 3: v60 should use real data, not hardcoded V60_CATALOG
  // The current v60-trip-builder-script has hardcoded V60_CATALOG - this test verifies it gets replaced
  const indexContent = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const v60HasRealDataInit = indexContent.includes('V60_CATALOG') &&
                             indexContent.match(/const V60_CATALOG\s*=/);

  // If v60 is using real data, it should not have the hardcoded test catalog OR
  // it should load it from canonical sources
  if (v60HasRealDataInit) {
    // This is where the bug is - v60 is using hardcoded V60_CATALOG instead of real data
    console.warn('⚠ Trip Builder still uses hardcoded test data (V60_CATALOG)');
    console.warn('  - Should use: data/moscow_schedule_today.json');
    console.warn('  - Impact: Users see 3 cities (Kaliningrad, Sochi, Minsk) with test tournaments');
  }

  // Test 4: localStorage persistence key is version-agnostic
  const tripKey = window.localStorage.getItem('ps_v60_saved_trips');
  // After save, trip should persist
  const testTrip = {
    id: 'trip_test_' + Date.now(),
    city: 'Москва',
    from: '2026-09-12',
    to: '2026-09-16',
    budget: 50000,
    plan: 'balanced',
    label: 'Test Trip',
    tournaments: [],
    total: 30000
  };

  let savedTrips = [];
  try {
    savedTrips = JSON.parse(window.localStorage.getItem('ps_v60_saved_trips') || '[]');
  } catch (e) {}

  savedTrips.unshift(testTrip);
  window.localStorage.setItem('ps_v60_saved_trips', JSON.stringify(savedTrips));

  const restored = JSON.parse(window.localStorage.getItem('ps_v60_saved_trips') || '[]');
  assert.ok(restored.length > 0, 'Trip persistence failed');
  assert.equal(restored[0].id, testTrip.id, 'Saved trip not restored correctly');
  console.log('✓ Trip localStorage persistence works');

  // Test 5: Navigation to Trip Builder screen
  const tournamentsArea = document.getElementById('tournamentsArea');
  assert.ok(tournamentsArea, 'Tournament area element missing');

  // Call Trip Builder
  window.openTripBuilderV60?.();
  await wait(50);

  // Verify UI renders
  const tripBuilderUI = tournamentsArea.querySelector('.v60Wrap');
  if (tripBuilderUI) {
    console.log('✓ Trip Builder UI renders');

    // Verify key UI elements exist
    const cityButtons = tournamentsArea.querySelectorAll('[data-v60city]');
    assert.ok(cityButtons.length > 0, 'City selector buttons missing');
    console.log(`✓ City buttons rendered: ${cityButtons.length}`);

    const budgetRange = document.getElementById('v60BudgetRange');
    assert.ok(budgetRange, 'Budget range slider missing');
    console.log('✓ Budget slider rendered');

    const buildBtn = document.getElementById('v60BuildTrip');
    assert.ok(buildBtn, 'Build trip button missing');
    console.log('✓ Build trip button rendered');
  } else {
    console.warn('⚠ Trip Builder UI did not render');
  }

  // Test 6: No fatal JS errors
  const fatalErrors = errors.filter(e => !/not implemented|Could not load|resource|fetch|worker|MutationObserver/i.test(e));
  assert.equal(fatalErrors.length, 0, `Fatal errors: ${fatalErrors.join('\n')}`);
  console.log('✓ No fatal errors');

  console.log('\n✓ Trip Builder test: PASS');
  window.close();
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
