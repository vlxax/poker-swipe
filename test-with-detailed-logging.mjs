import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3344';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });
  
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    // Add detailed logging to integration
    await page.evaluate(() => {
      const orig = window.CharacterSystem.sequencedReaction;
      window.CharacterSystem.sequencedReaction = function(container, grade, context, sequence) {
        console.log(`[DEBUG] sequencedReaction called: grade=${grade}, context=${context}, hasContainer=${!!container}`);
        const result = orig.call(this, container, grade, context, sequence);
        console.log(`[DEBUG] sequencedReaction returned:`, !!result);
        return result;
      };
      
      const origReact = window.CharacterSystem.reactToVerdict;
      window.CharacterSystem.reactToVerdict = function(container, grade, context, options) {
        console.log(`[DEBUG] reactToVerdict called: grade=${grade}, hasContainer=${!!container}`);
        const result = origReact.call(this, container, grade, context, options);
        console.log(`[DEBUG] reactToVerdict returned element:`, result?.className || 'null');
        return result;
      };
    });
    
    // Navigate and click
    await page.evaluate(() => {
      if (typeof window.show === 'function') window.show('swipe');
      if (typeof window.renderSwipe === 'function') window.renderSwipe();
    });
    
    await page.waitForTimeout(1500);
    
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (btn && btn.onclick) {
        btn.onclick({ target: btn });
      } else {
        btn?.click();
      }
    });
    
    await page.waitForTimeout(3000);
    
    console.log('\n=== DEBUG LOGS ===');
    const debugLogs = logs.filter(l => l.includes('[DEBUG]') || l.includes('[Character'));
    debugLogs.forEach(log => console.log(`  ${log}`));
    
    // Check if characters are in DOM
    const finalState = await page.evaluate(() => {
      return {
        flash: !!document.querySelector('#swipeFlash'),
        psReaction: !!document.querySelector('.ps-character-reaction'),
        psMonster: !!document.querySelector('.ps-monster-reaction'),
        allDivs: document.querySelectorAll('#swipeFlash > div').length,
        flashChildren: document.querySelector('#swipeFlash')?.children.length || 0,
        flashHTML: document.querySelector('#swipeFlash')?.innerHTML.substring(0, 100)
      };
    });
    
    console.log('\n=== FINAL DOM STATE ===');
    console.log(JSON.stringify(finalState, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
