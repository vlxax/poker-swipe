import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

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
    
    // Initialize the app
    await page.evaluate(() => {
      if (typeof window.renderHome === 'function') {
        window.renderHome();
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Screenshot 01: Home screen
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-01-home.png'), fullPage: false });
    console.log('✓ Screenshot: swap-01-home.png - Home screen with menu');
    
    // Click SWIPE button (correct ID: v36Swipe)
    const swipeBtn = await page.$('#v36Swipe');
    if (!swipeBtn) {
      console.log('✗ v36Swipe button not found');
      return;
    }
    
    console.log('\n>>> Clicking SWIPE button (#v36Swipe)');
    await swipeBtn.click();
    await page.waitForTimeout(1500);
    
    // Screenshot 02: SWIPE screen - before decision
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-02-before.png'), fullPage: false });
    console.log('✓ Screenshot: swap-02-before.png - SWIPE screen with poker task visible');
    
    // Get action buttons
    const actionBtns = await page.$$('[data-sa]');
    console.log(`\n>>> Found ${actionBtns.length} action buttons`);
    
    if (actionBtns.length > 0) {
      // Click first action (likely correct)
      const firstBtnText = await actionBtns[0].textContent();
      console.log(`>>> Clicking first action: "${firstBtnText?.trim()}"`);
      await actionBtns[0].click();
      await page.waitForTimeout(3500);
      
      // Screenshot 03: SWIPE verdict - first action
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-03-action1.png'), fullPage: false });
      console.log('✓ Screenshot: swap-03-action1.png - Verdict after first action');
      
      // Check verdict rendering
      const verdictData = await page.evaluate(() => {
        const flash = document.querySelector('#swipeFlash');
        const selectedBtn = document.querySelector('[data-sa].selected');
        return {
          flashExists: !!flash,
          flashHTML: flash?.innerHTML?.substring(0, 300) || '',
          selectedButtonGrade: selectedBtn?.className.match(/grade-[gyr]/)?.[0] || 'unknown',
          characterElements: {
            psReaction: !!document.querySelector('.ps-character-reaction'),
            psMonster: !!document.querySelector('.ps-monster-reaction'),
            freakCoach: !!document.querySelector('.freakCoachReaction'),
            video: !!document.querySelector('video'),
            canvas: !!document.querySelector('canvas')
          }
        };
      });
      
      console.log('\n=== VERDICT ANALYSIS ===');
      console.log(`Flash exists: ${verdictData.flashExists}`);
      console.log(`Selected button grade: ${verdictData.selectedButtonGrade}`);
      console.log(`Character rendering:`, verdictData.characterElements);
      console.log(`Flash HTML preview: ${verdictData.flashHTML.substring(0, 100)}...`);
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
