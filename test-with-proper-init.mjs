import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3344';
const SCREENSHOTS_DIR = '/tmp/character-final-qa';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });

  try {
    console.log('>>> Loading app...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    // Manually initialize the app if renderHome wasn't called
    await page.evaluate(() => {
      if (typeof window.renderHome === 'function') {
        window.renderHome();
      }
    });
    
    await page.waitForTimeout(1500);
    
    // Screenshot 01: Home screen
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-home-screen.png'), fullPage: false });
    console.log('✓ Captured 01-home-screen.png');
    
    // Click SWIPE button
    const swipeBtn = await page.$('#homeSwipe');
    if (swipeBtn) {
      console.log('\n>>> Clicking SWIPE button');
      await swipeBtn.click();
      await page.waitForTimeout(1500);
      
      // Screenshot 02: SWIPE screen - before decision
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-swipe-before.png'), fullPage: false });
      console.log('✓ Captured 02-swipe-before.png');
      
      // Click first action button
      const actionBtns = await page.$$('[data-sa]');
      if (actionBtns.length > 0) {
        const firstBtnText = await actionBtns[0].textContent();
        console.log(`\n>>> Clicking action: "${firstBtnText?.trim()}"`);
        await actionBtns[0].click();
        await page.waitForTimeout(3000);
        
        // Screenshot 03: SWIPE verdict - correct
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-swipe-correct.png'), fullPage: false });
        console.log('✓ Captured 03-swipe-correct.png');
        
        // Check what rendered
        const verdictState = await page.evaluate(() => {
          const verdict = document.querySelector('#swipeVerdict');
          const flash = document.querySelector('#swipeFlash');
          return {
            verdictVisible: verdict && window.getComputedStyle(verdict).display !== 'none',
            flashExists: !!flash,
            flashHTML: flash?.innerHTML?.substring(0, 200),
            characterElements: {
              psReaction: !!document.querySelector('.ps-character-reaction'),
              psMonster: !!document.querySelector('.ps-monster-reaction'),
              freakCoach: !!document.querySelector('.freakCoachReaction'),
              video: !!document.querySelector('video'),
              canvas: !!document.querySelector('canvas')
            },
            gradeClasses: {
              g: !!document.querySelector('[class*="grade-g"]'),
              y: !!document.querySelector('[class*="grade-y"]'),
              r: !!document.querySelector('[class*="grade-r"]')
            }
          };
        });
        
        console.log('\n=== VERDICT STATE ===');
        console.log(JSON.stringify(verdictState, null, 2));
      } else {
        console.log('✗ No action buttons found');
      }
    } else {
      console.log('✗ SWIPE button (#homeSwipe) not found');
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
