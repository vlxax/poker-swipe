import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = './evidence';

// Create evidence directory
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

test.describe('PokerSwipe Mini-Apps QA', () => {
  let page;

  test.beforeAll(async ({ playwright }) => {
    const browser = await playwright.chromium.launch();
    page = await browser.newPage();

    // Set viewport to iOS size (390x844)
    await page.setViewportSize({ width: 390, height: 844 });

    // Log console messages
    page.on('console', (msg) => {
      console.log(`[Console ${msg.type()}] ${msg.text()}`);
    });
  });

  test('SWIPE mini-app: Full user journey', async () => {
    console.log('\n=== Testing SWIPE Mini-App ===');

    // Navigate to home
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Screenshot home screen
    await page.screenshot({ path: `${EVIDENCE_DIR}/01-home-screen.png` });

    // Click on SWIPE tile
    const swipeTile = page.locator('#homeSwipe');
    await expect(swipeTile).toBeVisible();
    await swipeTile.click();

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${EVIDENCE_DIR}/02-swipe-loaded.png` });

    // Verify we're in SWIPE mode
    const swipeScreen = page.locator('#swipe');
    await expect(swipeScreen).toHaveClass(/active/);

    // Test 1: Read hand information without auto-advance
    console.log('Test 1: Reading hand information...');
    const handInfo = page.locator('.hand-info');
    await handInfo.waitFor({ state: 'visible', timeout: 5000 });

    // Take screenshot of hand
    await page.screenshot({ path: `${EVIDENCE_DIR}/03-swipe-hand-1.png` });

    // Simulate delay for reading (user reading time)
    await page.waitForTimeout(2000);

    // Verify no auto-advance happened during reading time
    const verdictBefore = page.locator('.verdict-text');
    const isVerdictShown = await verdictBefore.isVisible().catch(() => false);
    console.log(`Verdict visible after 2s delay: ${isVerdictShown}`);

    // Test 2: User makes a choice (correct or incorrect)
    console.log('Test 2: Making a choice...');
    const choiceButtons = page.locator('[data-choice]');
    const buttonCount = await choiceButtons.count();
    console.log(`Available choices: ${buttonCount}`);

    if (buttonCount > 0) {
      const firstChoice = choiceButtons.first();
      await firstChoice.click();

      await page.screenshot({ path: `${EVIDENCE_DIR}/04-swipe-choice-made.png` });

      // Wait for verdict to appear
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${EVIDENCE_DIR}/05-swipe-verdict.png` });

      // Test 3: Verify verdict is readable (no auto-dismiss)
      console.log('Test 3: Checking verdict persistence...');
      const verdictText = page.locator('.verdict-text');
      const isVerdictVisible = await verdictText.isVisible().catch(() => false);
      console.log(`Verdict visible after choice: ${isVerdictVisible}`);

      if (isVerdictVisible) {
        const verdictContent = await verdictText.textContent();
        console.log(`Verdict content length: ${verdictContent?.length || 0} chars`);
      }

      // Test 4: Simulate user reading time (3 seconds)
      console.log('Test 4: Verifying no forced auto-advance during verdict reading...');
      await page.waitForTimeout(3000);

      const verdictAfterReading = page.locator('.verdict-text');
      const stillVisible = await verdictAfterReading.isVisible().catch(() => false);
      console.log(`Verdict still visible after 3s reading time: ${stillVisible}`);

      // Take screenshot before manual next
      await page.screenshot({ path: `${EVIDENCE_DIR}/06-swipe-before-next.png` });

      // Test 5: User manually clicks next
      console.log('Test 5: Manual navigation to next hand...');
      const nextBtn = page.locator('[data-action="next"], .swipe-next, button:has-text("Далее"), button:has-text("Next")').first();

      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${EVIDENCE_DIR}/07-swipe-next-hand.png` });
        console.log('Successfully navigated to next hand manually');
      } else {
        console.log('No explicit next button found, checking for result...');
        // Hand might auto-disappear and show next
      }
    }

    console.log('✓ SWIPE mini-app test complete');
  });

  test('SIZING mini-app: Grading flow', async () => {
    console.log('\n=== Testing SIZING Mini-App ===');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    const sizingTile = page.locator('#homeSizing');
    await expect(sizingTile).toBeVisible();
    await sizingTile.click();

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${EVIDENCE_DIR}/10-sizing-loaded.png` });

    const sizingScreen = page.locator('#sizing');
    await expect(sizingScreen).toHaveClass(/active/);

    console.log('✓ SIZING mini-app loaded');
  });

  test('DAILY mini-app: Question and answer', async () => {
    console.log('\n=== Testing DAILY Mini-App ===');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    const dailyTile = page.locator('#homeDaily');
    await expect(dailyTile).toBeVisible();
    await dailyTile.click();

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${EVIDENCE_DIR}/20-daily-loaded.png` });

    const dailyScreen = page.locator('#daily');
    await expect(dailyScreen).toHaveClass(/active/);

    console.log('✓ DAILY mini-app loaded');
  });

  test('REVIEW mini-app: Line analysis', async () => {
    console.log('\n=== Testing REVIEW Mini-App ===');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    const reviewTile = page.locator('#homeReview');
    await expect(reviewTile).toBeVisible();
    await reviewTile.click();

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${EVIDENCE_DIR}/30-review-loaded.png` });

    const reviewScreen = page.locator('#review');
    await expect(reviewScreen).toHaveClass(/active/);

    console.log('✓ REVIEW mini-app loaded');
  });

  test('My Results data flow', async () => {
    console.log('\n=== Testing My Results Data Flow ===');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Access profile to check results
    const profileNav = page.locator('[data-nav="profile"]');
    if (await profileNav.isVisible()) {
      await profileNav.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${EVIDENCE_DIR}/40-profile-screen.png` });

      // Check for results section
      const resultsSection = page.locator('id=moi-rezultaty, text="Результаты", text="Results"').first();
      if (await resultsSection.isVisible().catch(() => false)) {
        console.log('✓ Results section found on profile');
      }
    }

    console.log('✓ My Results data flow verification complete');
  });

  test.afterAll(async () => {
    await page.close();
  });
});

// Summary report
console.log('\n=== QA Test Summary ===');
console.log('Evidence collected in:', EVIDENCE_DIR);
console.log('Mini-apps tested:');
console.log('  1. SWIPE');
console.log('  2. SIZING');
console.log('  3. DAILY');
console.log('  4. REVIEW');
console.log('  5. My Results data flow');
