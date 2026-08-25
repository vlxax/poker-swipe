import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3344';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });
  
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'warn') {
      const text = msg.text();
      if (text.includes('[Character') || text.includes('Loaded')) {
        consoleLogs.push(text);
      }
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
    
    // Click action
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sa]');
      if (btn && btn.onclick) {
        btn.onclick({ target: btn });
      } else {
        btn?.click();
      }
    });
    
    await page.waitForTimeout(3000);
    
    console.log('\n=== CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(`  ${log}`));
    
    if (consoleLogs.length === 0) {
      console.log('  (No Character logs found)');
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
