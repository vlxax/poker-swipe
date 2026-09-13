import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3344';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => {
      return {
        swipeDataExists: typeof window.SWIPE !== 'undefined',
        swipeDataLength: window.SWIPE?.length || 0,
        showFunction: typeof window.show === 'function',
        renderHomeFunction: typeof window.renderHome === 'function',
        mainAppDiv: !!document.querySelector('#mainApp'),
        homeDiv: !!document.querySelector('#home'),
        homeDivContent: document.querySelector('#home')?.innerHTML.length || 0,
        allSections: Array.from(document.querySelectorAll('.screen, [id*="Area"]')).map(s => ({
          id: s.id,
          display: window.getComputedStyle(s).display,
          content: s.innerHTML.length > 0 ? 'has content' : 'empty'
        }))
      };
    });
    
    console.log(JSON.stringify(state, null, 2));
    
    // Try to manually call renderHome
    await page.evaluate(() => {
      if (typeof window.renderHome === 'function') {
        console.log('[Manual] Calling renderHome()...');
        window.renderHome();
      }
    });
    
    await page.waitForTimeout(1000);
    
    const afterManualRender = await page.evaluate(() => {
      return {
        homeContent: document.querySelector('#home')?.innerHTML.length || 0,
        homeButtons: document.querySelectorAll('#home button').length,
        visibleSection: Array.from(document.querySelectorAll('.screen')).find(s => 
          window.getComputedStyle(s).display !== 'none' && 
          s.id !== 'mainApp'
        )?.id || 'none'
      };
    });
    
    console.log('\n=== AFTER MANUAL renderHome() ===');
    console.log(JSON.stringify(afterManualRender, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
