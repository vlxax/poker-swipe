/**
 * Runtime Evidence Test - Browser-Based Execution
 *
 * This test actually executes the import pipeline through a real browser
 * to provide measurable runtime evidence.
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = './evidence';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR);
}

async function runTests() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true
  });
  const page = await browser.newPage();

  console.log('\n' + '█'.repeat(70));
  console.log('RUNTIME EVIDENCE TEST - BROWSER EXECUTION');
  console.log('█'.repeat(70) + '\n');

  // Navigate to the application
  const appUrl = `file://${path.resolve('./index.html')}`;
  console.log(`Loading application: ${appUrl}\n`);

  await page.goto(appUrl);
  await page.waitForLoadState('networkidle');

  // Navigate to My Hands section first
  await page.evaluate(() => {
    // Call the renderMy() function to show the My Hands section
    if (typeof renderMy === 'function') {
      window.selectedTab = 'my';
      renderMy();
    }
  });

  await page.waitForSelector('button#importHand', { timeout: 5000 });

  // Test 1: Import 1 hand
  console.log('TEST 1: Import 1 Hand');
  console.log('-'.repeat(70));

  const oneHandText = fs.readFileSync('./tests/test-1-hand.txt', 'utf8');

  // Click import button
  await page.click('button#importHand');
  await page.waitForSelector('#hhText');

  // Enter hand text
  await page.fill('#hhText', oneHandText);

  // Start import and measure time
  const start1 = Date.now();
  await page.click('button#hhGo');

  // Wait for import to complete
  await page.waitForSelector('h2:has-text("ГОТОВО")', { timeout: 10000 }).catch(() => null);
  const elapsed1 = Date.now() - start1;

  // Get results from page
  const result1 = await page.evaluate(() => {
    const imported = document.querySelector('[style*="color:#42e786"]')?.textContent || '0';
    const duplicates = document.querySelector('[style*="color:#ffd257"]')?.textContent || '0';
    const invalid = document.querySelector('[style*="color:#ff4b68"]')?.textContent || '0';

    return {
      imported: parseInt(imported.match(/\d+/)?.[0] || '0'),
      duplicates: parseInt(duplicates.match(/\d+/)?.[0] || '0'),
      invalid: parseInt(invalid.match(/\d+/)?.[0] || '0'),
      sHandsCount: localStorage.getItem('S') ? JSON.parse(localStorage.getItem('S')).hands?.length || 0 : 0
    };
  });

  console.log(`INPUT:           1 hand`);
  console.log(`IMPORTED:        ${result1.imported}`);
  console.log(`DUPLICATES:      ${result1.duplicates}`);
  console.log(`INVALID:         ${result1.invalid}`);
  console.log(`FINAL S.hands:   ${result1.sHandsCount}`);
  console.log(`TIME:            ${elapsed1} ms\n`);

  // Close modal to continue
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Test 2: Import 10 hands
  console.log('TEST 2: Import 10 Hands');
  console.log('-'.repeat(70));

  const tenHandsText = fs.readFileSync('./tests/test-10-hands.txt', 'utf8');

  // Clear page and start new import
  await page.click('button#importHand');
  await page.waitForSelector('#hhText');
  await page.fill('#hhText', tenHandsText);

  const start10 = Date.now();
  await page.click('button#hhGo');

  await page.waitForSelector('h2:has-text("ГОТОВО")', { timeout: 10000 }).catch(() => null);
  const elapsed10 = Date.now() - start10;

  const result10 = await page.evaluate(() => {
    const imported = document.querySelector('[style*="color:#42e786"]')?.textContent || '0';
    const duplicates = document.querySelector('[style*="color:#ffd257"]')?.textContent || '0';
    const invalid = document.querySelector('[style*="color:#ff4b68"]')?.textContent || '0';

    return {
      imported: parseInt(imported.match(/\d+/)?.[0] || '0'),
      duplicates: parseInt(duplicates.match(/\d+/)?.[0] || '0'),
      invalid: parseInt(invalid.match(/\d+/)?.[0] || '0'),
      sHandsCount: localStorage.getItem('S') ? JSON.parse(localStorage.getItem('S')).hands?.length || 0 : 0
    };
  });

  console.log(`INPUT:           10 hands`);
  console.log(`IMPORTED:        ${result10.imported}`);
  console.log(`DUPLICATES:      ${result10.duplicates}`);
  console.log(`INVALID:         ${result10.invalid}`);
  console.log(`FINAL S.hands:   ${result10.sHandsCount}`);
  console.log(`TIME:            ${elapsed10} ms\n`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Test 3: Deduplication
  console.log('TEST 3: Deduplication Test');
  console.log('-'.repeat(70));
  console.log('RUN 1: Import 5 hands');

  const fiveHandsText = fs.readFileSync('./tests/test-10-hands.txt', 'utf8')
    .split('---')
    .slice(0, 5)
    .join('---');

  // Clear storage for clean test
  await page.evaluate(() => localStorage.removeItem('S'));
  await page.reload();

  await page.click('button#importHand');
  await page.waitForSelector('#hhText');
  await page.fill('#hhText', fiveHandsText);
  await page.click('button#hhGo');

  await page.waitForSelector('h2:has-text("ГОТОВО")', { timeout: 10000 }).catch(() => null);

  const run1 = await page.evaluate(() => {
    const imported = document.querySelector('[style*="color:#42e786"]')?.textContent || '0';
    const duplicates = document.querySelector('[style*="color:#ffd257"]')?.textContent || '0';
    return {
      imported: parseInt(imported.match(/\d+/)?.[0] || '0'),
      duplicates: parseInt(duplicates.match(/\d+/)?.[0] || '0'),
      total: localStorage.getItem('S') ? JSON.parse(localStorage.getItem('S')).hands?.length || 0 : 0
    };
  });

  console.log(`IMPORTED:  ${run1.imported}`);
  console.log(`DUPLICATES: ${run1.duplicates}`);
  console.log(`TOTAL:     ${run1.total}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  console.log('\nRUN 2: Re-import same 5 hands');

  await page.click('button#importHand');
  await page.waitForSelector('#hhText');
  await page.fill('#hhText', fiveHandsText);
  await page.click('button#hhGo');

  await page.waitForSelector('h2:has-text("ГОТОВО")', { timeout: 10000 }).catch(() => null);

  const run2 = await page.evaluate(() => {
    const imported = document.querySelector('[style*="color:#42e786"]')?.textContent || '0';
    const duplicates = document.querySelector('[style*="color:#ffd257"]')?.textContent || '0';
    return {
      imported: parseInt(imported.match(/\d+/)?.[0] || '0'),
      duplicates: parseInt(duplicates.match(/\d+/)?.[0] || '0'),
      total: localStorage.getItem('S') ? JSON.parse(localStorage.getItem('S')).hands?.length || 0 : 0
    };
  });

  console.log(`IMPORTED:  ${run2.imported}`);
  console.log(`DUPLICATES: ${run2.duplicates}`);
  console.log(`TOTAL:     ${run2.total}`);
  console.log(`DEDUP STATUS: ${run2.duplicates === 5 ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 4: Persistence
  console.log('TEST 4: Persistence Test');
  console.log('-'.repeat(70));

  const handsBefore = result10.sHandsCount;
  console.log(`BEFORE IMPORT: ${handsBefore} hands (from previous test)`);

  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');

  const handsAfterReload = await page.evaluate(() => {
    return localStorage.getItem('S') ? JSON.parse(localStorage.getItem('S')).hands?.length || 0 : 0;
  });

  console.log(`AFTER RELOAD: ${handsAfterReload} hands`);
  console.log(`PERSISTENCE: ${handsAfterReload === handsBefore ? '✓ PASS' : '✗ FAIL'}\n`);

  // Test 5: Invalid data
  console.log('TEST 5: Invalid Data Handling');
  console.log('-'.repeat(70));

  const testCases = [
    {
      name: 'DUPLICATE HERO CARD',
      text: `Hand #9999999991
PokerOK - Texas Holdem 6-max
2024-01-15 14:30:45 UTC
Blinds 0.50/1.00

Hero received hole cards: [As As]

Hero: raises 3.00

Hero wins the pot`
    },
    {
      name: 'MISSING HERO CARDS',
      text: `Hand #9999999992
PokerOK - Texas Holdem 6-max
2024-01-15 14:30:45 UTC
Blinds 0.50/1.00

Player_A: raises 3.00

Hero wins the pot`
    }
  ];

  for (const testCase of testCases) {
    await page.click('button#importHand').catch(() => null);
    await page.waitForSelector('#hhText', { timeout: 1000 }).catch(() => null);
    await page.fill('#hhText', testCase.text);
    await page.click('button#hhGo');

    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => {
      const invalid = document.querySelector('[style*="color:#ff4b68"]');
      return invalid ? 1 : 0;
    });

    console.log(`${testCase.name}: ${result > 0 ? 'REJECTED ✓' : 'ACCEPTED ✗'}`);
    await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(300);
  }

  console.log('\n' + '█'.repeat(70));
  console.log('EXECUTION SUMMARY');
  console.log('█'.repeat(70) + '\n');

  console.log('1 HAND:   input/imported/invalid/ms');
  console.log(`          1/${result1.imported}/${result1.invalid}/${elapsed1}`);

  console.log('\n10 HANDS: input/imported/invalid/ms');
  console.log(`          10/${result10.imported}/${result10.invalid}/${elapsed10}`);

  console.log('\nDEDUPLICATION RUN 1: imported/duplicates/total');
  console.log(`                     ${run1.imported}/${run1.duplicates}/${run1.total}`);

  console.log('\nDEDUPLICATION RUN 2: imported/duplicates/total');
  console.log(`                     ${run2.imported}/${run2.duplicates}/${run2.total}`);

  console.log('\nPERSISTENCE: before/after reload');
  console.log(`             ${handsBefore}/${handsAfterReload}`);

  console.log('\n✓ All tests executed in real browser environment');
  console.log('✓ Runtime measurements captured');
  console.log('✓ Evidence available in browser console and storage\n');

  await browser.close();
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
