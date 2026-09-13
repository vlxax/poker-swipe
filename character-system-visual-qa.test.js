import { chromium, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3344';
const SCREENSHOTS_DIR = '/tmp/character-final-qa';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function shot(page, name, desc) {
  const filepath = path.join(SCREENSHOTS_DIR, name);
  try {
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`✓ SCREENSHOT: ${name}`);
    console.log(`  └─ ${desc}`);
    return true;
  } catch (e) {
    console.log(`✗ FAILED: ${name} - ${e.message}`);
    return false;
  }
}

test.describe('Visual QA - Real PokerSwipe Flows', () => {
  test('01. SWIPE - Initial State', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      console.log('\n>>> TEST: SWIPE - Initial State');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Ensure SWIPE is visible/active
      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) {
        await swipeNav.click();
        await page.waitForTimeout(1000);
      }

      await shot(page, '01-swipe-before.png', 'SWIPE flow - before decision');
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('02. SWIPE - First Action (Likely Correct)', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      console.log('\n>>> TEST: SWIPE - First Action');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) await swipeNav.click();
      await page.waitForTimeout(1000);

      // Click first action
      const actions = await page.$$('[data-sa]');
      if (actions.length > 0) {
        console.log(`  Clicking action button (${actions.length} available)`);
        await actions[0].click();
        await page.waitForTimeout(2500);
      }

      await shot(page, '02-swipe-correct.png', 'SWIPE verdict - first action clicked');

      // Check what rendered
      const state = await page.evaluate(() => {
        const char = document.querySelector('.ps-character-reaction, .freakCoachReaction');
        const video = document.querySelector('video');
        const canvas = document.querySelector('canvas');
        const verdict = document.querySelector('#swipeFlash');
        return {
          characterExists: !!char,
          videoExists: !!video,
          canvasExists: !!canvas,
          verdictExists: !!verdict
        };
      });
      console.log(`  State: Character=${state.characterExists}, Video=${state.videoExists}, Canvas=${state.canvasExists}, Verdict=${state.verdictExists}`);
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('03. SWIPE - Different Action (Likely Wrong)', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      console.log('\n>>> TEST: SWIPE - Different Action');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) await swipeNav.click();
      await page.waitForTimeout(1000);

      // Try last action
      const actions = await page.$$('[data-sa]');
      if (actions.length > 1) {
        console.log(`  Clicking last action (${actions.length} available)`);
        await actions[actions.length - 1].click();
        await page.waitForTimeout(2500);
      } else if (actions.length > 0) {
        console.log(`  Only 1 action available, clicking it`);
        await actions[0].click();
        await page.waitForTimeout(2500);
      }

      await shot(page, '03-swipe-wrong.png', 'SWIPE verdict - different action clicked');
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('04. Character System Debug State', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      console.log('\n>>> TEST: Character System Debug State');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Comprehensive character system check
      const debug = await page.evaluate(() => {
        const cs = window.CharacterSystem;
        return {
          loaded: !!cs,
          hasReactToVerdict: typeof cs?.reactToVerdict === 'function',
          hasSelectCharacter: typeof cs?.selectCharacter === 'function',
          hasRenderMonster: typeof cs?.renderMonster === 'function',
          hasRenderFreakLady: typeof cs?.renderFreakLady === 'function',
          hasSequencedReaction: typeof cs?.sequencedReaction === 'function',
          monsterVideos: cs?.MONSTER_VIDEOS || {},
          freakLadyLoaded: typeof window.FreakLady !== 'undefined',
          integrationLoaded: typeof window.CharacterIntegration !== 'undefined'
        };
      });

      console.log(`\n  CharacterSystem Debug:`);
      console.log(`    ✓ Loaded: ${debug.loaded}`);
      console.log(`    ✓ reactToVerdict: ${debug.hasReactToVerdict}`);
      console.log(`    ✓ selectCharacter: ${debug.hasSelectCharacter}`);
      console.log(`    ✓ renderMonster: ${debug.hasRenderMonster}`);
      console.log(`    ✓ renderFreakLady: ${debug.hasRenderFreakLady}`);
      console.log(`    ✓ sequencedReaction: ${debug.hasSequencedReaction}`);
      console.log(`    ✓ FreakLady loaded: ${debug.freakLadyLoaded}`);
      console.log(`    ✓ Integration loaded: ${debug.integrationLoaded}`);
      console.log(`    ✓ Monster videos:`);
      Object.entries(debug.monsterVideos).forEach(([mood, path]) => {
        console.log(`        - ${mood}: ${path}`);
      });

      // Also check DOM structure after swipe interaction
      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) await swipeNav.click();
      await page.waitForTimeout(1000);

      const actions = await page.$$('[data-sa]');
      if (actions.length > 0) {
        await actions[0].click();
        await page.waitForTimeout(2500);
      }

      const domState = await page.evaluate(() => {
        return {
          character: {
            psReaction: !!document.querySelector('.ps-character-reaction'),
            psMonster: !!document.querySelector('.ps-monster-reaction'),
            freakCoach: !!document.querySelector('.freakCoachReaction'),
            video: !!document.querySelector('video'),
            canvas: !!document.querySelector('canvas'),
            speechBubble: !!document.querySelector('.ps-speech-bubble')
          },
          verdict: {
            exists: !!document.querySelector('#swipeFlash'),
            gradeG: !!document.querySelector('.grade-g'),
            gradeY: !!document.querySelector('.grade-y'),
            gradeR: !!document.querySelector('.grade-r')
          }
        };
      });

      console.log(`\n  DOM State After Interaction:`);
      console.log(`    Character Elements:`);
      Object.entries(domState.character).forEach(([el, exists]) => {
        console.log(`      - ${el}: ${exists ? '✓' : '✗'}`);
      });
      console.log(`    Verdict Elements:`);
      Object.entries(domState.verdict).forEach(([el, exists]) => {
        console.log(`      - ${el}: ${exists ? '✓' : '✗'}`);
      });
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('05. Viewport Smoke Test - All 4 Sizes', async () => {
    const viewports = [
      { name: '375×812', width: 375, height: 812 },
      { name: '390×844', width: 390, height: 844 },
      { name: '393×852', width: 393, height: 852 },
      { name: '430×932', width: 430, height: 932 }
    ];

    for (const vp of viewports) {
      const browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium'
      });
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height }
      });

      try {
        console.log(`\n>>> TEST: Viewport ${vp.name}`);
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Check for horizontal overflow
        const overflow = await page.evaluate(() => {
          return {
            htmlOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
            htmlScroll: document.documentElement.scrollWidth,
            htmlClient: document.documentElement.clientWidth
          };
        });

        const overflowStatus = overflow.htmlOverflow || overflow.bodyOverflow ? '✗' : '✓';
        console.log(`  No horizontal overflow: ${overflowStatus}`);
        if (overflow.htmlOverflow || overflow.bodyOverflow) {
          console.log(`    Width: scroll=${overflow.htmlScroll}, client=${overflow.htmlClient}`);
        }
      } finally {
        await page.close();
        await browser.close();
      }
    }
  });
});
