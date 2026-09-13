import { chromium } from '@playwright/test';
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
    
    // Initialize
    await page.evaluate(() => {
      if (typeof window.renderHome === 'function') {
        window.renderHome();
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Screenshot home
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-01-home.png'), fullPage: false });
    console.log('✓ Screenshot: swap-01-home.png');
    
    // Try scrolling to make the button visible
    await page.evaluate(() => {
      const swipeBtn = document.querySelector('#v36Swipe');
      if (swipeBtn) {
        swipeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await page.waitForTimeout(500);
    
    // Click with force option
    await page.click('#v36Swipe', { force: true });
    console.log('>>> Clicked SWIPE button');
    await page.waitForTimeout(1500);
    
    // Screenshot before interaction
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-02-before.png'), fullPage: false });
    console.log('✓ Screenshot: swap-02-before.png');
    
    // Find and click first action
    const actionBtns = await page.$$('[data-sa]');
    console.log(`>>> Found ${actionBtns.length} action buttons`);
    
    if (actionBtns.length > 0) {
      await actionBtns[0].click();
      console.log('>>> Clicked first action');
      await page.waitForTimeout(3500);
      
      // Screenshot verdict
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-03-action1.png'), fullPage: false });
      console.log('✓ Screenshot: swap-03-action1.png');
      
      // Check verdict
      const state = await page.evaluate(() => {
        const flash = document.querySelector('#swipeFlash');
        const selectedBtn = document.querySelector('[data-sa].selected');
        const chars = {
          psReaction: !!document.querySelector('.ps-character-reaction'),
          psMonster: !!document.querySelector('.ps-monster-reaction'),
          video: !!document.querySelector('video'),
          canvas: !!document.querySelector('canvas')
        };
        return {
          flashExists: !!flash,
          buttonGrade: selectedBtn?.className.match(/grade-[gyr]/)?.[0] || 'none',
          characters: chars
        };
      });
      
      console.log('\n=== VERDICT STATE ===');
      console.log(JSON.stringify(state, null, 2));
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
