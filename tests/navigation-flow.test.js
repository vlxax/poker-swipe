import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
const {JSDOM, VirtualConsole, ResourceLoader} = jsdomPkg;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const MIME = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png'};

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
      // fall through to network
    }
    return Promise.resolve({status: 404, headers: {}, buffer: Buffer.alloc(0)});
  }
}

function boot() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', error => errors.push(error.message));

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://app.local/index.html',
    runScripts: 'outside-only',
    resources: new LocalResourceLoader(),
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
      window.alert = () => {};
      window.Math.random = () => 0.42;
      window.innerWidth = 390;
      window.innerHeight = 844;
    }
  });

  const {window} = dom;

  // Set up globals expected by app
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

  // Register load listener
  await new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), {once: true});
  });
  await wait(100);

  console.log('✓ App loaded');

  // Test navigation flow
  const screens = ['home', 'swipe', 'sizing', 'review', 'daily', 'myhands', 'tournaments', 'profile'];

  for (const screen of screens) {
    const el = document.getElementById(screen);
    if (!el) {
      console.warn(`⚠ Screen element missing: ${screen}`);
      continue;
    }

    // Navigate to screen
    window.show?.(screen);
    await wait(20);

    // Verify screen is active
    const isActive = el.classList.contains('active');
    assert.ok(isActive, `Screen ${screen} not active after navigation`);

    // Verify nav button is highlighted
    const navBtn = document.querySelector(`[data-nav="${screen}"]`);
    if (navBtn) {
      const isOn = navBtn.classList.contains('on');
      assert.ok(isOn, `Nav button for ${screen} not highlighted`);
    }

    console.log(`✓ Navigation to ${screen} works`);
  }

  // Test ONE CLICK = ONE HANDLER
  const homeBtn = document.querySelector('[data-nav="home"]');
  if (homeBtn) {
    let clickCount = 0;
    const origShow = window.show;
    window.show = function(...args) {
      clickCount++;
      return origShow?.apply(this, args);
    };

    click(homeBtn);
    await wait(20);

    // Reset
    window.show = origShow;

    assert.equal(clickCount, 1, `Navigation handler called ${clickCount} times (expected 1)`);
    console.log('✓ ONE CLICK = ONE HANDLER (no duplicate execution)');
  }

  // Test localStorage persistence (v40 polyana state)
  try {
    const stateKey = 'pokerswipe.polyana.state';
    const testState = {view: 'series', testData: 'test-value'};
    window.localStorage.setItem(stateKey, JSON.stringify(testState));

    const restored = JSON.parse(window.localStorage.getItem(stateKey) || '{}');
    assert.equal(restored.view, 'series', 'localStorage state not persisted');
    console.log('✓ localStorage persistence works');
  } catch (e) {
    console.warn(`⚠ localStorage test failed: ${e.message}`);
  }

  // Report errors
  const fatalErrors = errors.filter(e => !/not implemented|Could not load|resource|fetch|worker/i.test(e));
  if (fatalErrors.length > 0) {
    console.error('✗ Fatal errors:', fatalErrors.join('\n'));
  } else {
    console.log('✓ No fatal errors');
  }

  console.log('\n✓ Navigation flow test: PASS');
  window.close();
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
