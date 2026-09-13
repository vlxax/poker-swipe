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
    
    // Directly navigate to SWIPE flow
    await page.evaluate(() => {
      if (typeof window.show === 'function') {
        window.show('swipe');
      }
      if (typeof window.renderSwipe === 'function') {
        window.renderSwipe();
      }
    });
    
    await page.waitForTimeout(1500);
    
    // Screenshot 02: SWIPE screen - before decision
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-02-before.png'), fullPage: false });
    console.log('✓ Screenshot: swap-02-before.png - SWIPE screen');
    
    // Check if action buttons exist
    const actionBtns = await page.$$('[data-sa]');
    console.log(`\n>>> Found ${actionBtns.length} action buttons`);
    
    if (actionBtns.length > 0) {
      const btnText = await actionBtns[0].textContent();
      console.log(`>>> Clicking first action: "${btnText?.trim()}"`);
      await actionBtns[0].click();
      await page.waitForTimeout(3500);
      
      // Screenshot 03: SWIPE verdict
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-03-correct.png'), fullPage: false });
      console.log('✓ Screenshot: swap-03-correct.png - Verdict after action');
      
      // Analyze verdict rendering
      const analysis = await page.evaluate(() => {
        const flash = document.querySelector('#swipeFlash');
        const selected = document.querySelector('[data-sa].selected');
        const grade = selected?.className.match(/grade-([gyr])/)?.[1] || 'unknown';
        return {
          verdictVisible: !!flash,
          verdictHTML: flash?.innerHTML?.substring(0, 250) || '',
          detectedGrade: grade,
          characterElements: {
            '.ps-character-reaction': !!document.querySelector('.ps-character-reaction'),
            '.ps-monster-reaction': !!document.querySelector('.ps-monster-reaction'),
            '.freakCoachReaction': !!document.querySelector('.freakCoachReaction'),
            'video': !!document.querySelector('video'),
            'canvas': !!document.querySelector('canvas')
          }
        };
      });
      
      console.log('\n=== VERDICT RENDERING ANALYSIS ===');
      console.log(JSON.stringify(analysis, null, 2));
      
      // Continue to capture wrong answer
      console.log('\n>>> Going to next hand for wrong answer test...');
      
      // Click "next" or wait for auto-advance
      await page.waitForTimeout(3000);
      
      const nextBtn = await page.$('#manualNext, .primary');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
      
      // Try to click a different action
      const actionBtns2 = await page.$$('[data-sa]');
      if (actionBtns2.length > 1) {
        const lastBtnText = await actionBtns2[actionBtns2.length - 1].textContent();
        console.log(`>>> Clicking different action: "${lastBtnText?.trim()}"`);
        await actionBtns2[actionBtns2.length - 1].click();
        await page.waitForTimeout(3500);
        
        // Screenshot 04: Wrong answer
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-04-wrong.png'), fullPage: false });
        console.log('✓ Screenshot: swap-04-wrong.png - Verdict for wrong action');
      }
    } else {
      console.log('✗ No action buttons found after renderSwipe()');
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
