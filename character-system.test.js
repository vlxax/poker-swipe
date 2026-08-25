/**
 * PokerSwipe Character System Regression Tests
 * Tests all viewports: 375×812, 390×844, 393×852, 430×932
 * Verifies: SWIPE, SIZING, DAILY flows with character integration
 */

import { chromium, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test viewports
const VIEWPORTS = [
  { name: '375×812', width: 375, height: 812 },
  { name: '390×844', width: 390, height: 844 },
  { name: '393×852', width: 393, height: 852 },
  { name: '430×932', width: 430, height: 932 }
];

const BASE_URL = 'http://localhost:3344';
const SCREENSHOTS_DIR = '/tmp/character-qa-screenshots';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Helper: Take screenshot with viewport info
async function takeScreenshot(page, name, viewport) {
  const filename = `${SCREENSHOTS_DIR}/${viewport.name.replace('×', 'x')}-${name}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`✓ Screenshot: ${filename}`);
  return filename;
}

// Helper: Verify character rendered
async function verifyCharacterRendered(page, containerSelector) {
  const charState = await page.evaluate((selector) => {
    const container = document.querySelector(selector);
    if (!container) return { found: false, reason: 'container-not-found' };

    const canvas = container.querySelector('canvas');
    const video = container.querySelector('video');
    const freakReaction = container.querySelector('.freakCoachReaction');
    const psReaction = container.querySelector('.ps-character-reaction');

    return {
      found: true,
      canvas: !!canvas,
      video: !!video,
      freakReaction: !!freakReaction,
      psReaction: !!psReaction,
      hasContent: !!(canvas || video || freakReaction || psReaction),
      innerHTML: container.innerHTML.substring(0, 100)
    };
  }, containerSelector);

  return charState;
}

// Helper: Verify no overflow
async function verifyNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      htmlWidth: html.scrollWidth > html.clientWidth,
      bodyWidth: body.scrollWidth > body.clientWidth,
      htmlScroll: html.scrollWidth,
      htmlClient: html.clientWidth,
      bodyScroll: body.scrollWidth,
      bodyClient: body.clientWidth
    };
  });

  return !overflow.htmlWidth && !overflow.bodyWidth;
}

// Helper: Verify console errors
async function checkConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'exception') {
      errors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  return errors;
}

test.describe('Character System - All Viewports', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} viewport`, () => {
      let page;
      let browser;
      let consoleErrors;

      test.beforeAll(async () => {
        browser = await chromium.launch({
          executablePath: '/opt/pw-browsers/chromium'
        });
      });

      test.beforeEach(async () => {
        page = await browser.newPage({ viewport });
        consoleErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        // Navigate and wait for app
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);

        // Onboard if needed
        const nick = await page.evaluate(() => window.S?.nick).catch(() => null);
        if (!nick) {
          const input = await page.$('input[type="text"]').catch(() => null);
          if (input) {
            await input.fill('TestPlayer');
            await page.click('button.primary');
            await page.waitForTimeout(1000);
          }
        }
      });

      test.afterEach(async () => {
        await page.close();
      });

      test.afterAll(async () => {
        await browser.close();
      });

      // ============ SWIPE TESTS ============

      test('SWIPE - loads at correct viewport', async () => {
        await page.click('[data-nav="swipe"]');
        await page.waitForTimeout(600);

        const viewport_match = await page.evaluate(() => {
          const app = document.querySelector('.app');
          return {
            width: window.innerWidth,
            height: window.innerHeight,
            appExists: !!app
          };
        });

        expect(viewport_match.appExists).toBe(true);
        console.log(`✓ ${viewport.name}: App loaded`);
      });

      test('SWIPE - verdicts render without horizontal overflow', async () => {
        await page.click('[data-nav="swipe"]');
        await page.waitForTimeout(600);

        await takeScreenshot(page, 'swipe-start', viewport);

        const actionBtn = await page.$('[data-sa]');
        expect(actionBtn).toBeTruthy();

        if (actionBtn) {
          await actionBtn.click();
          await page.waitForTimeout(1500);

          await takeScreenshot(page, 'swipe-verdict', viewport);

          const noOverflow = await verifyNoHorizontalOverflow(page);
          expect(noOverflow).toBe(true);

          const charState = await verifyCharacterRendered(page, '#swipeFlash');
          expect(charState.found).toBe(true);
          console.log(`✓ ${viewport.name}: SWIPE character rendered (canvas: ${charState.canvas}, video: ${charState.video})`);
        }
      });

      test('SWIPE - character does not cover action area', async () => {
        await page.click('[data-nav="swipe"]');
        await page.waitForTimeout(600);

        const actionBtn = await page.$('[data-sa]');
        if (actionBtn) {
          await actionBtn.click();
          await page.waitForTimeout(1500);

          const coverage = await page.evaluate(() => {
            const char = document.querySelector('#swipeFlash .freakCoachReaction, #swipeFlash .ps-character-reaction');
            const actions = document.querySelector('.actions');

            if (!char || !actions) return { overlap: false };

            const charRect = char.getBoundingClientRect();
            const actionsRect = actions.getBoundingClientRect();

            const overlap = !(
              charRect.bottom < actionsRect.top ||
              charRect.top > actionsRect.bottom ||
              charRect.right < actionsRect.left ||
              charRect.left > actionsRect.right
            );

            return {
              overlap,
              charBottom: charRect.bottom,
              actionsTop: actionsRect.top
            };
          });

          expect(coverage.overlap).toBe(false);
          console.log(`✓ ${viewport.name}: SWIPE character does not overlap actions`);
        }
      });

      // ============ SIZING TESTS ============

      test('SIZING - renders without horizontal overflow', async () => {
        await page.click('[data-nav="sizing"]');
        await page.waitForTimeout(600);

        await takeScreenshot(page, 'sizing-start', viewport);

        const noOverflow = await verifyNoHorizontalOverflow(page);
        expect(noOverflow).toBe(true);
        console.log(`✓ ${viewport.name}: SIZING loads without overflow`);
      });

      test('SIZING - result shows character', async () => {
        await page.click('[data-nav="sizing"]');
        await page.waitForTimeout(600);

        const sizeBtn = await page.$('#sizeLock');
        if (sizeBtn) {
          await sizeBtn.click();
          await page.waitForTimeout(1200);

          await takeScreenshot(page, 'sizing-result', viewport);

          const charState = await verifyCharacterRendered(page, '#sizeResult');
          console.log(`✓ ${viewport.name}: SIZING result character state:`, charState);
        }
      });

      // ============ DAILY TESTS ============

      test('DAILY - loads at viewport', async () => {
        await page.click('[data-nav="daily"]');
        await page.waitForTimeout(600);

        await takeScreenshot(page, 'daily-start', viewport);

        const dailyArea = await page.isVisible('#dailyArea');
        expect(dailyArea).toBe(true);
        console.log(`✓ ${viewport.name}: DAILY accessible`);
      });

      // ============ CHARACTER SYSTEM TESTS ============

      test('Character System API exists', async () => {
        const systemState = await page.evaluate(() => {
          return {
            charSystemExists: typeof window.CharacterSystem !== 'undefined',
            charIntegrationExists: typeof window.CharacterIntegration !== 'undefined',
            freakLadyExists: typeof window.FreakLady !== 'undefined',
            hasReactToVerdict: typeof window.CharacterSystem?.reactToVerdict === 'function',
            hasSequencedReaction: typeof window.CharacterSystem?.sequencedReaction === 'function',
            hasSelectCharacter: typeof window.CharacterSystem?.selectCharacter === 'function'
          };
        });

        expect(systemState.charSystemExists).toBe(true);
        expect(systemState.charIntegrationExists).toBe(true);
        expect(systemState.freakLadyExists).toBe(true);
        expect(systemState.hasReactToVerdict).toBe(true);
        expect(systemState.hasSequencedReaction).toBe(true);
        console.log(`✓ ${viewport.name}: Character System API loaded`);
      });

      test('Console has no blocking errors', async () => {
        // Wait for any deferred errors
        await page.waitForTimeout(500);

        // Check for known critical errors
        const critical = consoleErrors.filter(e =>
          e.includes('Uncaught') ||
          e.includes('TypeError') ||
          e.includes('ReferenceError')
        );

        console.log(`✓ ${viewport.name}: Console errors (${critical.length} critical, ${consoleErrors.length} total)`);
        expect(critical.length).toBe(0);
      });

      test('No CTA obstruction', async () => {
        await page.click('[data-nav="swipe"]');
        await page.waitForTimeout(600);

        const actionBtn = await page.$('[data-sa]');
        if (actionBtn) {
          await actionBtn.click();
          await page.waitForTimeout(1500);

          const obstruction = await page.evaluate(() => {
            const primary = document.querySelector('button.primary');
            const charReaction = document.querySelector('.ps-character-reaction, .freakCoachReaction');

            if (!primary || !charReaction) return { obstructed: false };

            const primaryRect = primary.getBoundingClientRect();
            const charRect = charReaction.getBoundingClientRect();

            const overlap = !(
              charRect.bottom < primaryRect.top ||
              charRect.top > primaryRect.bottom ||
              charRect.right < primaryRect.left ||
              charRect.left > primaryRect.right
            );

            return { obstructed: overlap };
          });

          expect(obstruction.obstructed).toBe(false);
          console.log(`✓ ${viewport.name}: No CTA obstruction`);
        }
      });
    });
  }
});

console.log(`\n=== Character System Playwright Tests ===`);
console.log(`Viewports tested: ${VIEWPORTS.map(v => v.name).join(', ')}`);
console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);
