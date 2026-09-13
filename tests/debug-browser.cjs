const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: false,  // Show browser for debugging
    args: ['--disable-gpu']
  });
  const page = await browser.newPage();
  const appUrl = `file://${path.resolve('./index.html')}`;
  
  await page.goto(appUrl);
  await page.waitForLoadState('networkidle');

  // Wait a bit and take a screenshot
  await page.waitForTimeout(2000);

  // Get page content
  const html = await page.content();
  const buttons = await page.locator('button').count();
  
  console.log(`Found ${buttons} buttons on page`);
  console.log('Button IDs:', await page.locator('button').evaluateAll(buttons => 
    buttons.map(b => b.id || b.textContent?.slice(0, 20)).filter(Boolean)
  ));

  // Check if S.hands exists
  const hands = await page.evaluate(() => window.S?.hands?.length || 0);
  console.log(`Current S.hands count: ${hands}`);

  await browser.close();
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
