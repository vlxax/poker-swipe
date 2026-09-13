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
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'qa-01-before.png'), fullPage: false });
    console.log('✓ qa-01-before.png');
    
    // Click first action
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (btn && btn.onclick) {
        btn.onclick({ target: btn });
      } else {
        btn?.click();
      }
    });
    
    console.log('>>> Waiting for verdict and character rendering...');
    await page.waitForTimeout(4000);
    
    // Screenshot with full content
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'qa-02-verdict.png'), fullPage: false });
    console.log('✓ qa-02-verdict.png');
    
    // Check for character rendering
    const charState = await page.evaluate(() => {
      const flash = document.querySelector('#swipeFlash');
      const integration = typeof window.CharacterIntegration !== 'undefined';
      const charSystem = typeof window.CharacterSystem !== 'undefined';
      
      return {
        verdictHTML: flash?.innerHTML?.substring(0, 400) || '',
        flashClasses: flash?.className || '',
        characterElements: {
          '.ps-character-reaction': !!document.querySelector('.ps-character-reaction'),
          '.ps-monster-reaction': !!document.querySelector('.ps-monster-reaction'),
          '.freakCoachReaction': !!document.querySelector('.freakCoachReaction'),
          'video': Array.from(document.querySelectorAll('video')).map(v => ({src: v.src.substring(0, 50), paused: v.paused, muted: v.muted})),
          'canvas': Array.from(document.querySelectorAll('canvas')).map(c => ({width: c.width, height: c.height}))
        },
        systemsLoaded: {
          charSystem,
          integration,
          reactToVerdict: typeof window.CharacterSystem?.reactToVerdict === 'function'
        }
      };
    });
    
    console.log('\n=== CHARACTER RENDERING STATE ===');
    console.log(JSON.stringify(charState, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
