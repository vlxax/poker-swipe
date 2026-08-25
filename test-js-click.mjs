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
    
    // Navigate to SWIPE
    await page.evaluate(() => {
      if (typeof window.show === 'function') window.show('swipe');
      if (typeof window.renderSwipe === 'function') window.renderSwipe();
    });
    
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-02-before.png'), fullPage: false });
    console.log('✓ swap-02-before.png - SWIPE screen');
    
    // Click first action using JavaScript
    console.log('\n>>> Clicking first action via JavaScript');
    const result = await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (!btn) return { error: 'Button not found' };
      const text = btn.dataset.sa || btn.textContent?.trim();
      btn.click();
      return { clicked: true, action: text };
    });
    
    if (result.error) {
      console.log(`✗ ${result.error}`);
      return;
    }
    
    console.log(`✓ Clicked: ${result.action}`);
    await page.waitForTimeout(3500);
    
    // Screenshot verdict
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'swap-03-correct.png'), fullPage: false });
    console.log('✓ swap-03-correct.png - Verdict');
    
    // Analyze
    const state = await page.evaluate(() => {
      const flash = document.querySelector('#swipeFlash');
      const selected = document.querySelector('[data-sa].selected');
      const gradeMatch = selected?.className.match(/grade-([gyr])/);
      return {
        verdictExists: !!flash,
        verdictHTML: flash?.innerHTML?.substring(0, 200) || '',
        grade: gradeMatch?.[1] || 'unknown',
        characters: {
          'ps-character-reaction': !!document.querySelector('.ps-character-reaction'),
          'ps-monster-reaction': !!document.querySelector('.ps-monster-reaction'),
          'freakCoachReaction': !!document.querySelector('.freakCoachReaction'),
          'video': !!document.querySelector('video'),
          'canvas': !!document.querySelector('canvas')
        }
      };
    });
    
    console.log('\n=== VERDICT STATE ===');
    console.log(JSON.stringify(state, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
