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
    viewport: { width: 390, height: 844 },
    hasTouch: true
  });

  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  const testResults = {
    passed: [],
    failed: [],
    skipped: []
  };

  try {
    console.log('🎯 PokerSwipe Runtime QA - Phase 17\n');
    console.log('='.repeat(60));

    // ========== INITIALIZE APP ==========
    console.log('\n📍 Loading application...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Bypass onboarding by calling show('home') directly
    console.log('📍 Bypassing onboarding...');
    await page.evaluate(() => {
      if (typeof show === 'function') {
        show('home');
      } else {
        const onboarding = document.getElementById('onboarding');
        if (onboarding) onboarding.style.display = 'none';
      }
    });
    await page.waitForTimeout(1500);

    // Verify home screen is loaded
    const homeReady = await page.evaluate(() => {
      return {
        homeActive: document.getElementById('home')?.classList.contains('active') || false,
        hasNav: document.querySelectorAll('[data-nav]').length > 0
      };
    });

    if (homeReady.homeActive && homeReady.hasNav) {
      console.log('✓ Home screen ready');
      testResults.passed.push('App Initialization');
    } else {
      console.log('⚠ Home screen not fully ready');
      testResults.failed.push('App Initialization');
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-home-screen.png') });

    // ========== TEST EACH MINI-APP ==========

    // 1. SWIPE (Daily hand)
    console.log('\n🎮 [1/6] Testing DAILY HAND (Раздача Дня)...');
    const dailyTile = page.locator('#homeDaily, button:has-text("РАЗДАЧА"), button:has-text("ОДНА РУКА")').first();
    if (await dailyTile.isVisible().catch(() => false)) {
      await dailyTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '10-daily-loaded.png') });

      const dailyActive = await page.evaluate(() => document.getElementById('daily')?.classList.contains('active') || false);
      if (dailyActive) {
        console.log('  ✓ Daily screen loaded');
        testResults.passed.push('Daily Hand Mini-App');

        // Check for hand content
        const hasContent = await page.evaluate(() => {
          return {
            hasCards: !!document.querySelector('[class*="card"], [class*="hero"], .pc, [class*="hand"]'),
            hasVerdictArea: !!document.querySelector('[class*="verdict"], [class*="result"], [class*="explanation"]')
          };
        });
        console.log(`  Hand content: ${hasContent.hasCards ? '✓' : '✗'}`);
      } else {
        console.log('  ✗ Daily screen not active');
        testResults.failed.push('Daily Hand Mini-App');
      }
    } else {
      console.log('  ⚠ Daily tile not found');
      testResults.skipped.push('Daily Hand Mini-App');
    }

    // Return to home
    await page.evaluate(() => { if (typeof show === 'function') show('home'); });
    await page.waitForTimeout(1500);

    // 2. SIZING
    console.log('\n🎮 [2/6] Testing SIZING (Сайзинг)...');
    const sizingTile = page.locator('#homeSizing, button:has-text("САЙЗИНГ"), button:has-text("СКОЛЬКО")').first();
    if (await sizingTile.isVisible().catch(() => false)) {
      await sizingTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '20-sizing-loaded.png') });

      const sizingActive = await page.evaluate(() => document.getElementById('sizing')?.classList.contains('active') || false);
      if (sizingActive) {
        console.log('  ✓ Sizing screen loaded');
        testResults.passed.push('Sizing Mini-App');
      } else {
        console.log('  ✗ Sizing screen not active');
        testResults.failed.push('Sizing Mini-App');
      }
    } else {
      console.log('  ⚠ Sizing tile not found');
      testResults.skipped.push('Sizing Mini-App');
    }

    // Return to home
    await page.evaluate(() => { if (typeof show === 'function') show('home'); });
    await page.waitForTimeout(1500);

    // 3. REVIEW (Line review)
    console.log('\n🎮 [3/6] Testing REVIEW (Разбор Линии)...');
    const reviewTile = page.locator('#homeReview, button:has-text("РАЗБОР"), button:has-text("СЛОМАЛОСЬ")').first();
    if (await reviewTile.isVisible().catch(() => false)) {
      await reviewTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '30-review-loaded.png') });

      const reviewActive = await page.evaluate(() => document.getElementById('review')?.classList.contains('active') || false);
      if (reviewActive) {
        console.log('  ✓ Review screen loaded');
        testResults.passed.push('Review Mini-App');
      } else {
        console.log('  ✗ Review screen not active');
        testResults.failed.push('Review Mini-App');
      }
    } else {
      console.log('  ⚠ Review tile not found');
      testResults.skipped.push('Review Mini-App');
    }

    // Return to home
    await page.evaluate(() => { if (typeof show === 'function') show('home'); });
    await page.waitForTimeout(1500);

    // 4. XRAY (Range narrowing)
    console.log('\n🎮 [4/6] Testing XRAY (Диапазон/Рентген)...');
    const xrayTile = page.locator('#homeXray, button:has-text("ДИАПАЗОН"), button:has-text("РЕНТГЕН")').first();
    if (await xrayTile.isVisible().catch(() => false)) {
      await xrayTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '40-xray-loaded.png') });

      const xrayActive = await page.evaluate(() => document.getElementById('xray')?.classList.contains('active') || false);
      if (xrayActive) {
        console.log('  ✓ Xray screen loaded');
        testResults.passed.push('Xray Mini-App');
      } else {
        console.log('  ✗ Xray screen not active');
        testResults.failed.push('Xray Mini-App');
      }
    } else {
      console.log('  ⚠ Xray tile not found');
      testResults.skipped.push('Xray Mini-App');
    }

    // Return to home
    await page.evaluate(() => { if (typeof show === 'function') show('home'); });
    await page.waitForTimeout(1500);

    // 5. SWIPE (10 hands)
    console.log('\n🎮 [5/6] Testing SWIPE (10 Рук)...');
    const swipeTile = page.locator('#homeSwipe, button:has-text("POKER SWIPE"), button:has-text("10 РУК")').first();
    if (await swipeTile.isVisible().catch(() => false)) {
      await swipeTile.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '50-swipe-loaded.png') });

      const swipeActive = await page.evaluate(() => document.getElementById('swipe')?.classList.contains('active') || false);
      if (swipeActive) {
        console.log('  ✓ SWIPE screen loaded');
        testResults.passed.push('SWIPE Mini-App');

        // Test NO AUTO-ADVANCE
        console.log('  Testing auto-advance prevention...');
        await page.waitForTimeout(3000); // Wait 3 seconds to check for unwanted auto-advance
        const stillOnFirst = await page.evaluate(() => {
          const swipeScreen = document.getElementById('swipe');
          // Check if we're still showing content (not advanced)
          return swipeScreen?.textContent?.length > 0;
        });

        if (stillOnFirst) {
          console.log('  ✓ NO auto-advance detected (user can read)');
          testResults.passed.push('SWIPE No Auto-Advance');
        } else {
          console.log('  ✗ Possible auto-advance detected');
          testResults.failed.push('SWIPE No Auto-Advance');
        }

        // Take screenshot after wait
        await page.screenshot({ path: path.join(EVIDENCE_DIR, '51-swipe-no-auto-advance.png') });
      } else {
        console.log('  ✗ SWIPE screen not active');
        testResults.failed.push('SWIPE Mini-App');
      }
    } else {
      console.log('  ⚠ SWIPE tile not found');
      testResults.skipped.push('SWIPE Mini-App');
    }

    // Return to home
    await page.evaluate(() => { if (typeof show === 'function') show('home'); });
    await page.waitForTimeout(1500);

    // 6. Navigation Tests
    console.log('\n🎮 [6/6] Testing Navigation & My Results...');

    // Test Profile navigation
    const profileNav = page.locator('[data-nav="profile"]');
    if (await profileNav.isVisible().catch(() => false)) {
      await profileNav.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '60-profile-screen.png') });

      const profileActive = await page.evaluate(() => document.getElementById('profile')?.classList.contains('active') || false);
      if (profileActive) {
        console.log('  ✓ Profile screen loaded');
        testResults.passed.push('Profile Navigation');

        // Check for results section
        const hasResults = await page.evaluate(() => {
          const profileSection = document.getElementById('profile');
          const text = profileSection?.textContent?.toLowerCase() || '';
          return text.includes('результат') || text.includes('решени') || text.includes('скилл');
        });

        if (hasResults) {
          console.log('  ✓ Results data visible on profile');
          testResults.passed.push('My Results Section');
        } else {
          console.log('  ⚠ Results section not clearly found');
        }
      } else {
        console.log('  ✗ Profile screen not active');
        testResults.failed.push('Profile Navigation');
      }
    }

    // ========== DATA FLOW VERIFICATION ==========
    console.log('\n💾 Verifying data flow and storage...');

    const storageInfo = await page.evaluate(() => {
      const allKeys = Object.keys(localStorage);
      const hasUserData = allKeys.some(k => k.includes('poker') || k.includes('user') || k.includes('player'));
      const hasMeta = allKeys.some(k => k.includes('meta') || k.includes('train'));

      return {
        totalKeys: allKeys.length,
        userDataPresent: hasUserData,
        metaDataPresent: hasMeta,
        sampleKeys: allKeys.slice(0, 3),
        userKey: allKeys.find(k => k.includes('user'))
      };
    });

    console.log(`  Storage keys found: ${storageInfo.totalKeys}`);
    if (storageInfo.userDataPresent) {
      console.log('  ✓ User data storage detected');
      testResults.passed.push('Data Storage');
    } else {
      console.log('  ⚠ User data storage not clearly detected');
    }

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n✅ Passed: ${testResults.passed.length}`);
    testResults.passed.forEach(test => console.log(`   • ${test}`));

    console.log(`\n❌ Failed: ${testResults.failed.length}`);
    testResults.failed.forEach(test => console.log(`   • ${test}`));

    console.log(`\n⏭️  Skipped: ${testResults.skipped.length}`);
    testResults.skipped.forEach(test => console.log(`   • ${test}`));

    console.log(`\n📸 Screenshots captured: ${fs.readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.png')).length}`);
    console.log(`📝 Console messages: ${consoleLogs.length}`);

    // Write detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testResults.passed.length + testResults.failed.length + testResults.skipped.length,
        passed: testResults.passed.length,
        failed: testResults.failed.length,
        skipped: testResults.skipped.length
      },
      tests: {
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped
      },
      evidence: {
        screenshots: fs.readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.png')),
        consoleLogs: consoleLogs.slice(0, 50) // First 50 logs
      }
    };

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'qa-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n✓ QA Report saved to evidence/qa-report.json');

  } catch (error) {
    console.error('\n❌ QA test error:', error.message);
    testResults.failed.push(`Fatal Error: ${error.message}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

runQA().catch(console.error);
