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
    console.log('>>> Loading app...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    console.log('\n=== HOME ELEMENTS ===');
    const homeElements = await page.evaluate(() => {
      const home = document.querySelector('#home');
      if (!home) return { error: 'home not found' };
      
      return {
        homeHTML: home.innerHTML.substring(0, 500),
        buttons: Array.from(home.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim().substring(0, 40),
          id: btn.id,
          class: btn.className.substring(0, 50)
        })).slice(0, 10),
        allIds: Array.from(home.querySelectorAll('[id]')).map(el => el.id).slice(0, 20)
      };
    });
    console.log(JSON.stringify(homeElements, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
