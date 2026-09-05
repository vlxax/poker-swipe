/**
 * Temporary auth bypass verification — AUTH_REQUIRED=false boots directly into PokerSwipe.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdomPkg from 'jsdom';
import { resetTrainerCache, listCharts } from '../trainer-knowledge/lookup.js';
import { PersistentLearnerMemory } from '../range-learning/persistence.js';

const { JSDOM, VirtualConsole, ResourceLoader } = jsdomPkg;

class LocalResourceLoader extends ResourceLoader {
  fetch(url, options) {
    const href = String(url);
    if (href.startsWith('https://telegram.org/')) {
      return Promise.resolve(Buffer.from(''));
    }
    try {
      const parsed = new URL(href);
      if (parsed.hostname === 'app.local') {
        const file = path.join(root, decodeURIComponent(parsed.pathname.replace(/^\//, '')));
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          return Promise.resolve(fs.readFileSync(file));
        }
      }
    } catch (_) { /* ignore */ }
    return super.fetch(url, options);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AUTH_SCREEN_IDS = ['authWelcome', 'authEmail', 'authOtp', 'authOtpSuccess'];

function isAuthScreenVisible(document) {
  return AUTH_SCREEN_IDS.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

function makeSession(userId = 'user-test-abc') {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: userId, email: 'test@example.com' },
    savedAt: Date.now()
  };
}

async function bootPage({
  deviceId = 'auth-bypass-device',
  session = null,
  learningKey = null,
  learningPayload = null,
  url = `http://app.local/index.html?device=${deviceId}`,
  viewport = { width: 390, height: 844 }
} = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url,
    runScripts: 'dangerously',
    resources: new LocalResourceLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.innerWidth = viewport.width;
      window.innerHeight = viewport.height;
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.alert = () => {};
      window.fetch = async (input) => {
        const href = String(input);
        if (href.includes('supabase.co')) {
          if (href.includes('/profiles')) {
            const profile = [{
              id: session?.user?.id || 'user-test-abc',
              onboarding_completed: true,
              migrated_from_local: false,
              initial_assessment: { legacy: false }
            }];
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify(profile),
              json: async () => profile
            };
          }
          return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };

      window.localStorage.setItem('pokerSwipeDeviceId', deviceId);
      if (session) {
        window.localStorage.setItem('pokerswipe_auth_session', JSON.stringify(session));
      }
      if (learningKey && learningPayload) {
        window.localStorage.setItem(learningKey, JSON.stringify(learningPayload));
      }
    }
  });

  await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  await wait(1200);

  const start = Date.now();
  while (Date.now() - start < 3000) {
    if (dom.window.PokerSwipeAuthBootstrap?.getState?.() === 'HOME') break;
    await wait(50);
  }

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    errors,
    deviceId
  };
}

describe('auth bypass (AUTH_REQUIRED=false)', () => {
  it('config flag is false in central pokerswipe-config.js', () => {
    const cfgSource = fs.readFileSync(path.join(root, 'js/pokerswipe-config.js'), 'utf8');
    assert.match(cfgSource, /AUTH_REQUIRED:\s*false/);
  });

  it('bypasses auth screen and boots main app directly', async () => {
    const { document, window } = await bootPage();
    assert.equal(window.PokerSwipeConfig?.AUTH_REQUIRED, false);
    assert.equal(window.PokerSwipeAuthBootstrap?.isAuthRequired?.(), false);
    assert.equal(isAuthScreenVisible(document), false, 'auth screen should stay hidden');
    const mainApp = document.getElementById('mainApp');
    assert.ok(mainApp, 'mainApp exists');
    assert.equal(mainApp.classList.contains('hidden'), false, 'mainApp should be visible');
    assert.equal(window.PokerSwipeAuthBootstrap?.getState?.(), 'HOME');
  });

  it('keeps stable guest/device identity across reload', async () => {
    const deviceId = 'auth-bypass-stable-device';
    const first = await bootPage({ deviceId });
    const firstId = first.window.localStorage.getItem('pokerSwipeDeviceId');
    assert.equal(firstId, deviceId);

    const second = await bootPage({ deviceId });
    const secondId = second.window.localStorage.getItem('pokerSwipeDeviceId');
    assert.equal(secondId, deviceId);
    assert.equal(firstId, secondId);
  });

  it('does not destroy an existing Supabase session', async () => {
    const session = makeSession('persist-user-1');
    const { window } = await bootPage({ session });
    const stored = window.localStorage.getItem('pokerswipe_auth_session');
    assert.ok(stored, 'session should remain in localStorage');
    const parsed = JSON.parse(stored);
    assert.equal(parsed.user.id, 'persist-user-1');
    assert.equal(parsed.access_token, 'test-access-token');
    const user = window.PokerSwipeAuth?.getUser?.();
    if (user?.id) {
      assert.equal(user.id, 'persist-user-1');
    }
  });

  it('preserves learning progress across reload', async () => {
    const deviceId = 'auth-bypass-learning';
    const learningKey = `pokerSwipe_mistakeMemory_v1:device:${deviceId}`;
    const learningPayload = {
      schemaVersion: 1,
      storeSchema: 1,
      userId: `device:${deviceId}`,
      savedAt: Date.now(),
      payload: {
        items: {
          'UO_2-4_EP:AA': {
            id: 'UO_2-4_EP:AA',
            attempts: 3,
            correct: 2,
            lastSeenAt: Date.now()
          }
        }
      }
    };

    const first = await bootPage({ deviceId, learningKey, learningPayload });
    const mem = new PersistentLearnerMemory({ storage: first.window.localStorage });
    mem.load();
    assert.equal(mem.userId, `device:${deviceId}`);
    assert.ok(mem.store.get('UO_2-4_EP:AA'));

    const second = await bootPage({ deviceId, learningKey, learningPayload });
    const mem2 = new PersistentLearnerMemory({ storage: second.window.localStorage });
    mem2.load();
    assert.equal(mem2.userId, `device:${deviceId}`);
    assert.equal(mem2.store.get('UO_2-4_EP:AA')?.attempts, 3);
  });

  it('does not enter an auth redirect loop on callback errors', async () => {
    const errorUrl =
      'http://app.local/index.html?error=access_denied&error_description=Expired';
    const { document, window } = await bootPage({ url: errorUrl });
    assert.equal(isAuthScreenVisible(document), false);
    assert.equal(document.getElementById('mainApp')?.classList.contains('hidden'), false);
    assert.equal(window.PokerSwipeAuthBootstrap?.getState?.(), 'HOME');
    const hasErrorParam = /(?:^|[?&])error=/.test(window.location.search);
    assert.equal(hasErrorParam, false, 'callback params cleaned');
  });

  it('mobile viewport 390x844 still boots directly', async () => {
    const { document, window } = await bootPage({ viewport: { width: 390, height: 844 } });
    assert.equal(window.innerWidth, 390);
    assert.equal(window.innerHeight, 844);
    assert.equal(isAuthScreenVisible(document), false);
    assert.equal(document.getElementById('mainApp')?.classList.contains('hidden'), false);
  });

  it('trainer charts.length remains 1698', () => {
    resetTrainerCache();
    assert.equal(listCharts().length, 1698);
  });
});
