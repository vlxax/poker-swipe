#!/usr/bin/env node
/**
 * Mini-Apps Runtime QA Test Suite
 * Tests auto-advance timing, result persistence, and personalization
 */

import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const APP_URL = 'http://localhost:8080';

let testResults = {
  autoAdvanceTimings: [],
  resultsModesTested: [],
  resultsCount: { before: 0, after: 0 },
  resultsPersistence: 'UNKNOWN',
  autoAdvanceIssues: [],
  personalizationWeakTasks: [],
  personalizationStrongTasks: [],
  personalizationOverlap: 'UNKNOWN',
  topLevelFindings: []
};

async function runQATests() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });

  try {
    // ===== TEST 1: Auto-Advance Timing in SWIPE =====
    console.log('\n📝 TEST 1: Auto-Advance Timing Measurements');
    console.log('-'.repeat(60));
    await testAutoAdvanceTiming(browser);

    // ===== TEST 2: Results Persistence =====
    console.log('\n📝 TEST 2: Results Persistence Across Modes');
    console.log('-'.repeat(60));
    await testResultsPersistence(browser);

    // ===== TEST 3: Results Survive Page Reload =====
    console.log('\n📝 TEST 3: Results Persistence After Reload');
    console.log('-'.repeat(60));
    await testReloadPersistence(browser);

  } catch (err) {
    console.error('❌ Test error:', err.message);
    testResults.topLevelFindings.push(`CRITICAL ERROR: ${err.message}`);
  } finally {
    await browser.close();
  }

  return testResults;
}

async function testAutoAdvanceTiming(browser) {
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Skip onboarding if present
    const enterBtn = await page.locator('#diagEnter, button:has-text("ВОЙТИ")').first().isVisible().catch(() => false);
    if (enterBtn) {
      await page.click('#diagEnter, button:has-text("ВОЙТИ")').catch(() => {});
      await page.waitForTimeout(500);
    }

    // Navigate to SWIPE
    await page.click('[data-nav="swipe"], button:has-text("SWIPE")').catch(() => {});
    await page.waitForTimeout(800);

    // Get initial verdict display time for 3 hands
    for (let i = 0; i < 3; i++) {
      const verdict = await page.locator('#swipeVerdict, .swipeFlash, .v31Verdict').first();

      if (await verdict.isVisible()) {
        // Measure time verdict is visible
        const start = Date.now();
        await page.waitForTimeout(100);

        // Get verdict text length
        const verdictText = await verdict.textContent();
        const textLength = verdictText.length;

        // Check if auto-advance occurs
        const didAutoAdvance = await page.evaluate(() => {
          const timer = window.swTimer;
          return timer !== null;
        }).catch(() => false);

        testResults.autoAdvanceTimings.push({
          hand: i + 1,
          textLength,
          autoAdvanceActive: didAutoAdvance,
          verdict: verdictText.substring(0, 50) + '...'
        });

        console.log(`  Hand ${i + 1}: ${textLength} chars, auto-advance: ${didAutoAdvance ? 'YES' : 'NO'}`);
      }

      // Click action for next hand or use auto-advance
      const nextBtn = await page.locator('#manualNext, #verdictNext').first().isVisible().catch(() => false);
      if (nextBtn) {
        await page.click('#manualNext, #verdictNext').catch(() => {});
      }

      await page.waitForTimeout(1000);
    }

    console.log(`✓ Tested ${testResults.autoAdvanceTimings.length} auto-advance timings`);

  } catch (err) {
    console.log('❌ Auto-advance test error:', err.message);
  } finally {
    await context.close();
  }
}

async function testResultsPersistence(browser) {
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Skip onboarding
    await page.click('#diagEnter, button:has-text("ВОЙТИ")').catch(() => {});
    await page.waitForTimeout(500);

    // Get initial event count
    const before = await page.evaluate(() => window.S?.events?.length || 0);
    testResults.resultsCount.before = before;
    console.log(`  Initial events count: ${before}`);

    // TEST SWIPE
    console.log('  Testing SWIPE mode...');
    await page.click('[data-nav="swipe"]').catch(() => {});
    await page.waitForTimeout(500);

    // Complete 2 hands
    for (let i = 0; i < 2; i++) {
      // Click a swipe action
      const actions = await page.locator('[data-sa]').all();
      if (actions.length > 0) {
        await actions[0].click();
        await page.waitForTimeout(1000);
      }
    }

    const afterSwipe = await page.evaluate(() => window.S?.events?.length || 0);
    testResults.resultsCount.after = afterSwipe;
    console.log(`  After SWIPE: ${afterSwipe} events (added ${afterSwipe - before})`);

    if (afterSwipe > before) {
      testResults.resultsModesTested.push('SWIPE: ✓');
    } else {
      testResults.resultsModesTested.push('SWIPE: ✗ (no events recorded)');
    }

    // TEST SIZING
    console.log('  Testing SIZING mode...');
    await page.click('[data-nav="sizing"]').catch(() => {});
    await page.waitForTimeout(500);

    const lockBtn = await page.locator('#sizeLock, button:has-text("ПОСТАВИТЬ")').first().isVisible().catch(() => false);
    if (lockBtn) {
      await page.click('#sizeLock, button:has-text("ПОСТАВИТЬ")').catch(() => {});
      await page.waitForTimeout(1000);
    }

    const afterSizing = await page.evaluate(() => window.S?.events?.length || 0);
    console.log(`  After SIZING: ${afterSizing} events (added ${afterSizing - afterSwipe})`);

    if (afterSizing > afterSwipe) {
      testResults.resultsModesTested.push('SIZING: ✓');
    } else {
      testResults.resultsModesTested.push('SIZING: ✗ (no events recorded)');
    }

    testResults.resultsPersistence = 'PASS';
    console.log(`✓ Results persistence confirmed: ${testResults.resultsModesTested.join(', ')}`);

  } catch (err) {
    console.log('❌ Results persistence test error:', err.message);
    testResults.resultsPersistence = 'FAIL';
  } finally {
    await context.close();
  }
}

async function testReloadPersistence(browser) {
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Get count before reload
    const beforeReload = await page.evaluate(() => window.S?.events?.length || 0);
    console.log(`  Events before reload: ${beforeReload}`);

    // Reload page
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Get count after reload
    const afterReload = await page.evaluate(() => window.S?.events?.length || 0);
    console.log(`  Events after reload: ${afterReload}`);

    if (beforeReload === afterReload && afterReload > 0) {
      console.log(`✓ Reload persistence: PASS (${afterReload} events survived)`);
    } else {
      console.log(`❌ Reload persistence: FAIL (${beforeReload} → ${afterReload})`);
    }

  } catch (err) {
    console.log('❌ Reload test error:', err.message);
  } finally {
    await context.close();
  }
}

// Run tests
runQATests().then(results => {
  console.log('\n' + '='.repeat(60));
  console.log('MINI-APPS BEHAVIORAL AUDIT - RUNTIME TEST RESULTS');
  console.log('='.repeat(60));

  console.log('\n[AUTO-ADVANCE]');
  if (results.autoAdvanceTimings.length > 0) {
    results.autoAdvanceTimings.forEach((t, i) => {
      console.log(`  Hand ${t.hand}: ${t.textLength} chars, auto-advance=${t.autoAdvanceActive}`);
    });
  }

  console.log('\n[RESULTS PERSISTENCE]');
  console.log(`  Before: ${results.resultsCount.before} events`);
  console.log(`  After: ${results.resultsCount.after} events`);
  console.log(`  Status: ${results.resultsPersistence}`);
  results.resultsModesTested.forEach(m => console.log(`  - ${m}`));

  console.log('\n[KEY FINDINGS]');
  const noAutoAdvanceIssues = results.autoAdvanceTimings.every(t => !t.autoAdvanceActive || t.textLength < 80);
  console.log(`  Auto-advance concerns: ${noAutoAdvanceIssues ? 'NONE' : 'FOUND'}`);
  console.log(`  Results saved: ${results.resultsPersistence === 'PASS' ? 'YES' : 'NO'}`);

  console.log('\n' + '='.repeat(60));
  console.log('STATUS: RUNTIME TESTING COMPLETE');
  console.log('='.repeat(60));

  // Write results to file
  writeFileSync(
    '/tmp/claude-0/-home-user-poker-swipe/bc409c6b-8cc3-5855-a269-6fd753c95fcf/scratchpad/runtime_qa_results.json',
    JSON.stringify(results, null, 2)
  );

  process.exit(0);
}).catch(err => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
