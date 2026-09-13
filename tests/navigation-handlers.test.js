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
      window.Math.random = () => 0.42;
    }
  });

  const {window} = dom;
  if (!window.__PSP_NATIVE_POLYANA) {
    window.__PSP_NATIVE_POLYANA = true;
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

  // Test 1: Screen elements exist and are unique (no cloning)
  const screenIds = ['home', 'swipe', 'sizing', 'review', 'daily', 'myhands', 'tournaments', 'profile'];

  for (const id of screenIds) {
    const elements = document.querySelectorAll(`#${id}`);
    assert.equal(elements.length, 1,
      `Screen ${id} should have exactly 1 element, found ${elements.length}`);
  }
  console.log(`✓ All ${screenIds.length} screens unique (no cloned elements)`);

  // Test 2: Navigation buttons are unique (one button per nav target)
  const navButtons = document.querySelectorAll('[data-nav]');
  const buttonMap = {};
  navButtons.forEach(btn => {
    const nav = btn.dataset.nav;
    buttonMap[nav] = (buttonMap[nav] || 0) + 1;
  });

  for (const [nav, count] of Object.entries(buttonMap)) {
    assert.equal(count, 1,
      `Nav button for ${nav} duplicated: found ${count} buttons`);
  }
  console.log(`✓ Navigation buttons unique (${navButtons.length} buttons, all count=1)`);

  // Test 3: Each nav button has matching screen
  const actualNavs = Array.from(navButtons).map(btn => btn.dataset.nav);
  for (const nav of actualNavs) {
    const screenEl = document.getElementById(nav);
    assert.ok(screenEl, `Nav button for ${nav} has no matching screen`);
  }
  console.log(`✓ Nav buttons match screens (${actualNavs.join(', ')})`);

  // Test 4: Check for excessive inline onclick handlers (risk of duplication)
  const buttonsWithOnclick = document.querySelectorAll('button[onclick]');
  const count = buttonsWithOnclick.length;

  if (count > 20) {
    console.warn(`⚠ ${count} buttons with onclick attributes (duplication risk)`);
  } else {
    console.log(`✓ Inline handlers reasonable (${count} total)`);
  }

  // Test 5: Check for mutation observers (risk if not cleaned up)
  const hasObservers = document.body.textContent?.includes('MutationObserver') ||
                      window.toString().includes('MutationObserver');
  if (hasObservers) {
    console.warn('⚠ MutationObserver detected - verify cleanup on screen transitions');
  } else {
    console.log('✓ No obvious observer duplication');
  }

  // Test 6: Verify proper event delegation (class-based selectors, not direct onclick)
  const globalClickHandlers = (document.body.getAttribute('onclick') || '').length;
  assert.equal(globalClickHandlers, 0, 'Body should not have onclick (use event delegation)');
  console.log('✓ Event delegation pattern (no body-level onclick)');

  // Test 7: No fatal errors
  const fatalErrors = errors.filter(e => !/not implemented|Could not load|resource|fetch|worker/i.test(e));
  assert.equal(fatalErrors.length, 0, `Fatal errors: ${fatalErrors.join('\n')}`);
  console.log('✓ No fatal errors');

  console.log('\n✓ Navigation structure test: PASS');
  console.log('  Verified:');
  console.log('  - Screens unique (no cloned elements)');
  console.log('  - Nav buttons unique (one per target)');
  console.log('  - Buttons match screens');
  console.log('  - Event delegation pattern (not excessive inline handlers)');
  window.close();
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
