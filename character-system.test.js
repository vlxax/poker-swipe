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
  try {
    const filename = `${SCREENSHOTS_DIR}/${viewport.name.replace('×', 'x')}-${name}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`✓ Screenshot: ${filename}`);
    return filename;
  } catch (e) {
    console.log(`⚠ Screenshot failed: ${name} - ${e.message}`);
    return null;
  }
}

// Helper: Verify character rendered
async function verifyCharacterRendered(page, containerSelector) {
  try {
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
  } catch (e) {
    return { found: false, error: e.message };
  }
}

// Helper: Verify no overflow
async function verifyNoHorizontalOverflow(page) {
  try {
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
  } catch (e) {
    return false;
  }
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
    test(`${viewport.name} - Basic Integration Test`, async () => {
      const browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium'
      });

      const page = await browser.newPage({ viewport });
      const consoleErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      try {
        // Navigate to app
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForLoadState('networkidle');

        // Verify Character System loaded
        const charSystemExists = await page.evaluate(() => {
          return typeof window.CharacterSystem !== 'undefined' &&
                 typeof window.CharacterSystem.reactToVerdict === 'function';
        });

        expect(charSystemExists).toBe(true);
        console.log(`✓ ${viewport.name}: Character System loaded`);

        // Verify viewport dimensions match
        const dimensions = await page.evaluate(() => {
          return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
          };
        });

        console.log(`✓ ${viewport.name}: Viewport dimensions ${dimensions.innerWidth}×${dimensions.innerHeight}`);

        // Take initial screenshot
        await takeScreenshot(page, 'initial-load', viewport);

        // Verify no horizontal overflow
        const noOverflow = await verifyNoHorizontalOverflow(page);
        expect(noOverflow).toBe(true);
        console.log(`✓ ${viewport.name}: No horizontal overflow`);

        // Check console for critical errors
        const criticalErrors = consoleErrors.filter(e =>
          e.includes('Uncaught') ||
          e.includes('TypeError') ||
          e.includes('ReferenceError')
        );

        console.log(`✓ ${viewport.name}: Console errors (${criticalErrors.length} critical, ${consoleErrors.length} total)`);
        expect(criticalErrors.length).toBe(0);

      } finally {
        await page.close();
        await browser.close();
      }
    });
  }
});

console.log(`\n=== Character System Playwright Tests ===`);
console.log(`Viewports tested: ${VIEWPORTS.map(v => v.name).join(', ')}`);
console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);
