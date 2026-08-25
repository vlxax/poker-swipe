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
    
    await page.evaluate(() => {
      if (typeof window.renderHome === 'function') {
        window.renderHome();
      }
    });
    
    await page.waitForTimeout(1500);
    
    const buttons = await page.evaluate(() => {
      const home = document.querySelector('#home');
      return Array.from(home?.querySelectorAll('button') || []).map(btn => ({
        id: btn.id || 'no-id',
        class: btn.className,
        text: btn.textContent?.trim().substring(0, 50),
        onclick: !!btn.onclick || !!btn.getAttribute('onclick')
      }));
    });
    
    console.log('Buttons found:');
    buttons.forEach((btn, i) => {
      console.log(`  ${i+1}. id="${btn.id}" text="${btn.text}"`);
    });
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
