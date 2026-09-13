/**
 * Runtime Evidence Test - Simplified Browser Test
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function test() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true
  });
  
  const page = await browser.newPage();
  const appUrl = `file://${path.resolve('./index.html')}`;
  
  console.log('\nLoading application...');
  await page.goto(appUrl, { waitUntil: 'networkidle' });

  // Wait for page to fully initialize
  await page.waitForTimeout(2000);

  // Get initial state
  const initialHands = await page.evaluate(() => window.S?.hands?.length || 0);
  console.log(`Initial S.hands: ${initialHands}`);

  // Try to find and render My Hands section
  const hasRenderMy = await page.evaluate(() => typeof window.renderMy === 'function');
  console.log(`renderMy function exists: ${hasRenderMy}`);

  if (hasRenderMy) {
    await page.evaluate(() => {
      window.selectedTab = 'my';
      window.renderMy();
    });

    await page.waitForTimeout(1000);
  }

  // Check what buttons are available
  const buttonCount = await page.locator('button').count();
  console.log(`Total buttons on page: ${buttonCount}`);

  // Look for import button
  const importButton = await page.locator('button#importHand').count();
  console.log(`Import button found: ${importButton > 0 ? 'YES' : 'NO'}`);

  // List all button texts
  const buttons = await page.locator('button').allTextContents();
  console.log(`Button texts (first 10):`);
  buttons.slice(0, 10).forEach((text, i) => {
    console.log(`  ${i+1}. ${text.slice(0, 50)}`);
  });

  // Try direct approach
  console.log('\nAttempting 1-hand import via direct function call...');
  
  const oneHandText = fs.readFileSync('./tests/test-1-hand.txt', 'utf8');
  
  const result = await page.evaluate((handText) => {
    // Directly call import function if it exists
    if (typeof window.importHandHistories === 'function') {
      window.importHandHistories(handText, 'AUTO');
      return { success: true, method: 'direct_call' };
    }
    return { success: false, method: 'none' };
  }, oneHandText);

  console.log(`Direct call result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

  // Wait a bit for import to complete
  if (result.success) {
    await page.waitForTimeout(2000);
  }

  // Get final state
  const finalHands = await page.evaluate(() => window.S?.hands?.length || 0);
  console.log(`Final S.hands: ${finalHands}`);
  console.log(`Hands imported: ${finalHands - initialHands}`);

  await browser.close();
  return true;
}

test().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
