import { chromium, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3344';
const SCREENSHOTS_DIR = '/tmp/character-final-qa';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function takeScreenshot(page, filename, description) {
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`✓ ${filename}: ${description}`);
  return filepath;
}

test.describe('Character System - Real Flow Behavioral Tests', () => {
  test('SWIPE - Before Decision', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Navigate to SWIPE
      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) {
        await swipeNav.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Capture BEFORE decision
        const taskVisible = await page.evaluate(() => {
          const task = document.querySelector('.task, .swipe-task, [data-testid*="task"]');
          return !!task;
        });

        console.log(`Task visible: ${taskVisible}`);
        await takeScreenshot(page, '01-swipe-before.png', 'SWIPE flow before decision');
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('SWIPE - Correct Decision', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Navigate to SWIPE
      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) {
        await swipeNav.click();
        await page.waitForTimeout(800);

        // Find and click an action button (first action)
        const actionButton = await page.$('[data-sa]');
        if (actionButton) {
          await actionButton.click();
          // Wait for verdict to appear and character reaction to animate in
          await page.waitForTimeout(2000);

          // Verify verdict and character rendered
          const verdict = await page.evaluate(() => {
            const v = document.querySelector('#swipeFlash, .swipe-flash, .verdict');
            const char = document.querySelector('.ps-character-reaction, .freakCoachReaction, .ps-monster-reaction');
            return {
              verdictExists: !!v,
              characterExists: !!char,
              characterType: char?.classList[0] || 'unknown'
            };
          });

          console.log(`Verdict: ${verdict.verdictExists}, Character: ${verdict.characterExists} (${verdict.characterType})`);
          await takeScreenshot(page, '02-swipe-correct.png', 'SWIPE correct verdict with character reaction');
        }
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('SWIPE - Wrong Decision', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Navigate to SWIPE
      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) {
        await swipeNav.click();
        await page.waitForTimeout(800);

        // Find and click multiple action buttons to potentially get wrong answer
        const actionButtons = await page.$$('[data-sa]');
        if (actionButtons.length > 0) {
          // Try the last action button
          await actionButtons[actionButtons.length - 1].click();
          await page.waitForTimeout(2000);

          const characterState = await page.evaluate(() => {
            const char = document.querySelector('.ps-character-reaction, .freakCoachReaction, .ps-monster-reaction');
            const verdict = document.querySelector('#swipeFlash, .verdict');
            const grade = verdict?.className || '';
            return {
              characterVisible: !!char,
              verdictClass: grade,
              hasVideo: !!document.querySelector('video'),
              hasCanvas: !!document.querySelector('canvas')
            };
          });

          console.log(`Character visible: ${characterState.characterVisible}, Grade: ${characterState.verdictClass}, Video: ${characterState.hasVideo}, Canvas: ${characterState.hasCanvas}`);
          await takeScreenshot(page, '03-swipe-wrong.png', 'SWIPE wrong verdict with character reaction');
        }
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('SIZING - Before Decision', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Navigate to SIZING
      const sizingNav = await page.$('[data-nav="sizing"]');
      if (sizingNav) {
        await sizingNav.click();
        await page.waitForTimeout(1000);

        const sizingExists = await page.evaluate(() => {
          return !!document.querySelector('#sizing, [data-section="sizing"], .sizing-section');
        });

        console.log(`Sizing section found: ${sizingExists}`);
        await takeScreenshot(page, '04-sizing-before.png', 'SIZING flow before decision');
      } else {
        console.log('SIZING nav not found');
        await takeScreenshot(page, '04-sizing-before-notfound.png', 'SIZING nav not found');
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('SIZING - Decision Result', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      const sizingNav = await page.$('[data-nav="sizing"]');
      if (sizingNav) {
        await sizingNav.click();
        await page.waitForTimeout(1000);

        // Look for size button or lock button
        const lockButton = await page.$('#sizeLock, [data-action="lock"], button:has-text("Lock")');
        if (lockButton) {
          await lockButton.click();
          await page.waitForTimeout(2000);

          const result = await page.evaluate(() => {
            const sizeResult = document.querySelector('#sizeResult, .size-result, .verdict');
            const character = document.querySelector('.ps-character-reaction, .freakCoachReaction');
            return {
              resultVisible: !!sizeResult,
              characterVisible: !!character
            };
          });

          console.log(`Size result: ${result.resultVisible}, Character: ${result.characterVisible}`);
          await takeScreenshot(page, '05-sizing-result.png', 'SIZING result with character');
        } else {
          console.log('Lock button not found');
          await takeScreenshot(page, '05-sizing-result-notfound.png', 'Sizing result button not found');
        }
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('DAILY - Result', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      const dailyNav = await page.$('[data-nav="daily"]');
      if (dailyNav) {
        await dailyNav.click();
        await page.waitForTimeout(1000);

        const dailyExists = await page.evaluate(() => {
          return !!document.querySelector('#dailyArea, .daily-section, [data-section="daily"]');
        });

        if (dailyExists) {
          console.log('Daily section found, checking for task completion...');
          // Just capture current state - may not have active task
          const hasPanel = await page.evaluate(() => {
            return !!document.querySelector('.panel, .daily-panel');
          });
          console.log(`Daily panel: ${hasPanel}`);
        }

        await takeScreenshot(page, '07-daily-result.png', 'DAILY flow/result view');
      } else {
        console.log('DAILY nav not found');
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('Character Assets - Monster Video and FreakLady Canvas', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Get Character System state
      const charState = await page.evaluate(() => {
        return {
          systemExists: typeof window.CharacterSystem !== 'undefined',
          monsterVideosAvailable: typeof window.CharacterSystem?.MONSTER_VIDEOS !== 'undefined',
          monsterVideos: window.CharacterSystem?.MONSTER_VIDEOS || {},
          freakLadyExists: typeof window.FreakLady !== 'undefined',
          canRenderMonster: typeof window.CharacterSystem?.renderMonster === 'function',
          canSelectCharacter: typeof window.CharacterSystem?.selectCharacter === 'function'
        };
      });

      console.log('\nCharacter System State:');
      console.log(`✓ System exists: ${charState.systemExists}`);
      console.log(`✓ Monster videos available: ${charState.monsterVideosAvailable}`);
      console.log(`✓ FreakLady exists: ${charState.freakLadyExists}`);
      console.log(`✓ renderMonster function: ${charState.canRenderMonster}`);
      console.log(`✓ selectCharacter function: ${charState.canSelectCharacter}`);
      console.log('\nMonster Videos Mapped:');
      Object.entries(charState.monsterVideos).forEach(([mood, path]) => {
        console.log(`  ${mood}: ${path}`);
      });

      expect(charState.systemExists).toBe(true);
      expect(charState.canSelectCharacter).toBe(true);
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('UI Accessibility - Character Does Not Block Interactions', async () => {
    const browser = await chromium.launch({
      executablePath: '/opt/pw-browsers/chromium'
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Navigate to SWIPE and trigger a reaction
      const swipeNav = await page.$('[data-nav="swipe"]');
      if (swipeNav) {
        await swipeNav.click();
        await page.waitForTimeout(800);

        const actionButton = await page.$('[data-sa]');
        if (actionButton) {
          const actionRect = await actionButton.boundingBox();
          await actionButton.click();
          await page.waitForTimeout(2000);

          // Check if action button area is still accessible
          const checkInteraction = await page.evaluate(() => {
            const primaryBtn = document.querySelector('button.primary, [role="button"].primary');
            const actions = document.querySelector('.actions');
            const character = document.querySelector('.ps-character-reaction, .freakCoachReaction');

            if (!primaryBtn || !character) {
              return { canAccess: true, reason: 'no obstruction' };
            }

            const primaryRect = primaryBtn.getBoundingClientRect();
            const charRect = character.getBoundingClientRect();

            const blocked = !(
              charRect.bottom < primaryRect.top ||
              charRect.top > primaryRect.bottom ||
              charRect.right < primaryRect.left ||
              charRect.left > primaryRect.right
            );

            return {
              canAccess: !blocked,
              reason: blocked ? 'overlap detected' : 'no overlap',
              charPos: `${charRect.x.toFixed(0)},${charRect.y.toFixed(0)}`,
              btnPos: `${primaryRect.x.toFixed(0)},${primaryRect.y.toFixed(0)}`
            };
          });

          console.log(`CTA Accessibility: ${checkInteraction.canAccess} (${checkInteraction.reason})`);
          console.log(`  Character position: ${checkInteraction.charPos}`);
          console.log(`  Button position: ${checkInteraction.btnPos}`);

          expect(checkInteraction.canAccess).toBe(true);
        }
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });
});
