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
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'exception') {
      consoleErrors.push(msg.text());
    }
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
    
    // Check state before click
    const beforeClick = await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      return {
        buttonExists: !!btn,
        hasOnClick: !!btn?.onclick,
        swipeTapFunction: typeof window.swipeTap === 'function',
        finalizeSwipeFunction: typeof window.finalizeSwipe === 'function',
        swLockedBefore: typeof window.swLocked !== 'undefined' ? window.swLocked : 'undefined'
      };
    });
    
    console.log('\n=== BEFORE CLICK ===');
    console.log(JSON.stringify(beforeClick, null, 2));
    
    // Add a custom click handler to debug
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (btn) {
        const originalOnClick = btn.onclick;
        btn.onclick = function(e) {
          console.log('[DEBUG] Button clicked, calling original onclick');
          if (originalOnClick) {
            return originalOnClick.call(this, e);
          }
        };
      }
    });
    
    console.log('\n>>> Clicking first action...');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (btn && btn.onclick) {
        btn.onclick({ target: btn });
      } else {
        btn?.click();
      }
    });
    
    await page.waitForTimeout(3500);
    
    // Check state after click
    const afterClick = await page.evaluate(() => {
      const flash = document.querySelector('#swipeFlash');
      const selected = document.querySelector('[data-sa].selected');
      return {
        verdictFlashExists: !!flash,
        selectedButtonExists: !!selected,
        selectedButtonGrade: selected?.className || 'none',
        swLockedAfter: typeof window.swLocked !== 'undefined' ? window.swLocked : 'undefined'
      };
    });
    
    console.log('\n=== AFTER CLICK ===');
    console.log(JSON.stringify(afterClick, null, 2));
    
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
