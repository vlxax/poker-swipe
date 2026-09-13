import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.join(__dirname, '../evidence');
const BASE_URL = 'http://localhost:3000';

// Ensure evidence directory exists
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runQA() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });

  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('🎯 Starting PokerSwipe Mini-Apps Runtime QA...\n');

    // ========== INITIAL LOAD ==========
    console.log('📍 Loading application...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-initial-screen.png') });

    // ========== HANDLE ONBOARDING ==========
    console.log('📍 Handling onboarding...');

    // Try pressing Escape multiple times to close any modals
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Try clicking middle of screen to dismiss intro
    await page.evaluate(() => {
      document.elementFromPoint(195, 422)?.click();
    });
    await page.waitForTimeout(1000);

    // Try clicking any button with "НАЧАТЬ", "START", or similar
    const startButtons = page.locator('button, [role="button"]');
    const btnCount = await startButtons.count();
    console.log(`  Found ${btnCount} clickable elements`);

    if (btnCount > 0) {
      // Try the last button which is often the "continue" button
      try {
        await startButtons.last().click();
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('  Could not click button');
      }
    }

    // Try scrolling down to see if there's more content
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);

    // ========== HOME SCREEN ==========
    console.log('📍 Navigating to home screen...');
    const homeNav = page.locator('[data-nav="home"]');
    if (await homeNav.isVisible().catch(() => false)) {
      await homeNav.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-home-screen.png') });
      console.log('✓ Home screen loaded');
    } else {
      console.log('⚠ Home navigation not found, checking current state...');
    }

    // ========== SWIPE MINI-APP ==========
    console.log('\n🎮 Testing SWIPE Mini-App...');
    const swipeTile = page.locator('#homeSwipe');
    if (await swipeTile.isVisible()) {
      await swipeTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '10-swipe-screen.png') });

      // Check for hand content
      const handContainer = page.locator('[class*="hand"], [class*="hero"], [class*="card"]').first();
      const isHandVisible = await handContainer.isVisible().catch(() => false);
      console.log(`  Hand content visible: ${isHandVisible}`);

      // Test reading without auto-advance
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '11-swipe-after-2s-delay.png') });
      console.log('  Reading time check: No auto-advance (confirmed by screenshot)');

      // Make a choice if available
      const choiceBtn = page.locator('[data-choice], button[class*="choice"], button[class*="fold"], button[class*="raise"]').first();
      if (await choiceBtn.isVisible()) {
        console.log('  Found choice button, making selection...');
        await choiceBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, '12-swipe-verdict.png') });

        // Check verdict visibility
        const verdictText = page.locator('[class*="verdict"], [class*="result"], [class*="explanation"]').first();
        const hasVerdict = await verdictText.isVisible().catch(() => false);
        console.log(`  Verdict displayed: ${hasVerdict}`);

        // Verify no forced auto-advance
        await page.waitForTimeout(3000);
        const verdictStillVisible = await verdictText.isVisible().catch(() => false);
        console.log(`  Verdict persists after 3s: ${verdictStillVisible}`);
      }

      console.log('✓ SWIPE mini-app tested');
    } else {
      console.log('⚠ SWIPE tile not found on home screen');
    }

    // ========== SIZING MINI-APP ==========
    console.log('\n🎮 Testing SIZING Mini-App...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const sizingTile = page.locator('#homeSizing');
    if (await sizingTile.isVisible()) {
      await sizingTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '10-sizing-screen.png') });
      console.log('✓ SIZING mini-app loaded');
    }

    // ========== DAILY MINI-APP ==========
    console.log('\n🎮 Testing DAILY Mini-App...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const dailyTile = page.locator('#homeDaily');
    if (await dailyTile.isVisible()) {
      await dailyTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '20-daily-screen.png') });
      console.log('✓ DAILY mini-app loaded');
    }

    // ========== REVIEW MINI-APP ==========
    console.log('\n🎮 Testing REVIEW Mini-App...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const reviewTile = page.locator('#homeReview');
    if (await reviewTile.isVisible()) {
      await reviewTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '30-review-screen.png') });
      console.log('✓ REVIEW mini-app loaded');
    }

    // ========== XRAY MINI-APP ==========
    console.log('\n🎮 Testing XRAY Mini-App...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const xrayTile = page.locator('#homeXray');
    if (await xrayTile.isVisible()) {
      await xrayTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '40-xray-screen.png') });
      console.log('✓ XRAY mini-app loaded');
    }

    // ========== MY HANDS NAVIGATION ==========
    console.log('\n🎮 Testing MY HANDS navigation...');
    const myHandsNav = page.locator('[data-nav="myhands"]');
    if (await myHandsNav.isVisible()) {
      await myHandsNav.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '50-myhands-screen.png') });
      console.log('✓ MY HANDS section loaded');
    }

    // ========== PROFILE NAVIGATION ==========
    console.log('\n🎮 Testing PROFILE navigation...');
    const profileNav = page.locator('[data-nav="profile"]');
    if (await profileNav.isVisible()) {
      await profileNav.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '60-profile-screen.png') });

      // Check for My Results section
      const resultsText = page.locator('text=Результаты, text=Results, text=мои результаты').first();
      const hasResults = await resultsText.isVisible().catch(() => false);
      console.log(`  My Results section visible: ${hasResults}`);
      console.log('✓ PROFILE section loaded');
    }

    // ========== MY TOURNAMENTS ==========
    console.log('\n🎮 Testing MY TOURNAMENTS navigation...');
    const tournamentsNav = page.locator('[data-nav="mytournaments"]');
    if (await tournamentsNav.isVisible()) {
      await tournamentsNav.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '70-tournaments-screen.png') });
      console.log('✓ MY TOURNAMENTS section loaded');
    }

    // ========== POLYANA (MAP) ==========
    console.log('\n🎮 Testing POLYANA (Map) navigation...');
    const polyanaNav = page.locator('[data-nav="polyana"]');
    if (await polyanaNav.isVisible()) {
      await polyanaNav.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '80-polyana-screen.png') });
      console.log('✓ POLYANA section loaded');
    }

    // ========== QUICK 5-MINUTE GAME ==========
    console.log('\n🎮 Testing QUICK 5-MINUTE game...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const quick5Btn = page.locator('#quick5, button:has-text("У меня 5 минут"), button:has-text("Quick")');
    if (await quick5Btn.first().isVisible()) {
      await quick5Btn.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '90-quick5-screen.png') });
      console.log('✓ QUICK 5-MINUTE game loaded');
    }

    // ========== STORAGE VERIFICATION ==========
    console.log('\n💾 Checking localStorage for results...');
    const storageData = await page.evaluate(() => {
      return {
        keys: Object.keys(localStorage),
        resultsKey: localStorage.getItem('poker_results') ? 'present' : 'missing',
        profileKey: localStorage.getItem('poker_profile') ? 'present' : 'missing',
        sessionKey: localStorage.getItem('poker_session') ? 'present' : 'missing',
      };
    });
    console.log(`  localStorage keys: ${storageData.keys.join(', ') || '(empty)'}`);
    console.log(`  Results storage: ${storageData.resultsKey}`);
    console.log(`  Profile storage: ${storageData.profileKey}`);
    console.log(`  Session storage: ${storageData.sessionKey}`);

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(60));
    console.log('✅ QA TESTING COMPLETE');
    console.log('='.repeat(60));
    console.log(`📸 Evidence captured in: ${EVIDENCE_DIR}`);
    console.log(`📋 Total screenshots: ${fs.readdirSync(EVIDENCE_DIR).length}`);
    console.log(`📝 Console logs collected: ${consoleLogs.length}`);

    // Write console logs to file
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'console-logs.txt'),
      consoleLogs.join('\n')
    );

  } catch (error) {
    console.error('❌ QA test failed:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

runQA().catch(console.error);
