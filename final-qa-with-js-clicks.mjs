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
    console.log('=== FINAL REAL-FLOW VISUAL QA ===\n');
    
    // SETUP
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      if (typeof window.show === 'function') window.show('swipe');
      if (typeof window.renderSwipe === 'function') window.renderSwipe();
    });
    await page.waitForTimeout(1500);
    
    // 01. SWIPE - BEFORE DECISION
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-swipe-before.png'), fullPage: false });
    console.log('✓ 01-swipe-before.png - SWIPE screen with poker task');
    
    // Click first action
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3500);
    
    // 02. SWIPE - FIRST ACTION VERDICT
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-swipe-correct.png'), fullPage: false });
    const state1 = await page.evaluate(() => {
      const btn = document.querySelector('[data-sa].selected');
      const grade = btn?.className.match(/grade-([gyr])/)?.[1] || '?';
      const reaction = !!document.querySelector('.ps-character-reaction');
      return { grade, reaction };
    });
    console.log(`✓ 02-swipe-correct.png - Verdict (grade=${state1.grade}, psReaction=${state1.reaction})`);
    
    // Advance to next hand
    await page.evaluate(() => {
      const nextBtn = document.querySelector('#manualNext');
      if (nextBtn) nextBtn.click();
      else {
        // Auto-advance happens after delay, so just proceed
        console.log('[auto-advancing in 2 sec]');
      }
    });
    await page.waitForTimeout(3000);
    
    // Re-render if needed
    const actionCount = await page.evaluate(() => document.querySelectorAll('[data-sa]').length);
    if (actionCount === 0) {
      await page.evaluate(() => {
        if (typeof window.renderSwipe === 'function') window.renderSwipe();
      });
      await page.waitForTimeout(1000);
    }
    
    // 03. SWIPE - DIFFERENT ACTION
    const actions = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-sa]');
      return btns.length;
    });
    
    if (actions > 1) {
      await page.evaluate(() => {
        const btns = document.querySelectorAll('[data-sa]');
        if (btns.length > 1) btns[btns.length - 1].click();
      });
      await page.waitForTimeout(3500);
      
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-swipe-wrong.png'), fullPage: false });
      const state2 = await page.evaluate(() => {
        const btn = document.querySelector('[data-sa].selected');
        const grade = btn?.className.match(/grade-([gyr])/)?.[1] || '?';
        return { grade };
      });
      console.log(`✓ 03-swipe-wrong.png - Verdict (grade=${state2.grade})`);
    } else {
      console.log('✓ 03-swipe-wrong.png - (SKIPPED: not enough actions to differentiate)');
    }
    
    console.log('\n✓ FINAL REAL-FLOW VISUAL QA COMPLETE');
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
