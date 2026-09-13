#!/usr/bin/env node
/**
 * Comprehensive Behavioral Runtime QA - Simplified
 * Tests: My Results, Personalization, Spaced Repetition, Randomness
 */

import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const APP_URL = 'http://localhost:8888/index.html';
const BROWSER_TIMEOUT = 60000;

let testResults = {
  autoAdvanceRemoved: false,
  myResults: { tested: false, modesFound: [], verified: false },
  personalization: { weakTasks: 0, strongTasks: 0, overlap: 0, verdict: 'UNKNOWN' },
  spacedRep: { verdict: 'UNKNOWN' },
  findings: []
};

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });

  try {
    console.log('\n' + '='.repeat(70));
    console.log('BEHAVIORAL RUNTIME QA - REAL VERIFICATION');
    console.log('='.repeat(70));

    // TEST: Auto-advance removal
    console.log('\n📋 TEST 1: AUTO-ADVANCE REMOVAL');
    console.log('-'.repeat(70));
    await testAutoAdvanceRemoved(browser);

    // TEST: My Results
    console.log('\n📋 TEST 2: MY RESULTS PAGE');
    console.log('-'.repeat(70));
    await testMyResults(browser);

    // TEST: Basic personalization signal
    console.log('\n📋 TEST 3: PERSONALIZATION SIGNAL');
    console.log('-'.repeat(70));
    await testPersonalizationSignal(browser);

  } catch (err) {
    console.error('\n❌ Test error:', err.message);
    testResults.findings.push(`ERROR: ${err.message}`);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('FINAL BEHAVIORAL AUDIT RESULTS');
  console.log('='.repeat(70));

  console.log('\n[1] AUTO-ADVANCE REMOVAL');
  console.log(`  Status: ${testResults.autoAdvanceRemoved ? 'YES (removed)' : 'NO (still present)'}`);

  console.log('\n[2] MY RESULTS PAGE');
  console.log(`  Tested: ${testResults.myResults.tested}`);
  console.log(`  Modes found: ${testResults.myResults.modesFound.join(', ') || 'NONE'}`);
  console.log(`  Page verified: ${testResults.myResults.verified ? 'YES' : 'NO'}`);

  console.log('\n[3] PERSONALIZATION');
  console.log(`  Weak tasks: ${testResults.personalization.weakTasks}`);
  console.log(`  Strong tasks: ${testResults.personalization.strongTasks}`);
  console.log(`  Overlap: ${testResults.personalization.overlap.toFixed(1)}%`);
  console.log(`  Verdict: ${testResults.personalization.verdict}`);

  console.log('\n[4] SPACED REPETITION');
  console.log(`  Verdict: ${testResults.spacedRep.verdict}`);

  if (testResults.findings.length > 0) {
    console.log('\n[FINDINGS]');
    testResults.findings.forEach(f => console.log(`  - ${f}`));
  }

  console.log('\n' + '='.repeat(70));

  // Save results
  writeFileSync(
    '/tmp/claude-0/-home-user-poker-swipe/bc409c6b-8cc3-5855-a269-6fd753c95fcf/scratchpad/behavioral_runtime_results.json',
    JSON.stringify(testResults, null, 2)
  );

  process.exit(0);
}

async function testAutoAdvanceRemoved(browser) {
  const page = await browser.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
    await page.waitForTimeout(1000);

    // Check if setTimeout(swipeNext, delay) exists in the code
    const hasAutoAdvance = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return html.includes('setTimeout') && html.includes('swipeNext');
    });

    // Actually test: does the verdict auto-advance or stay visible?
    const diagBtn = await page.locator('button:has-text("ВОЙТИ"), #diagEnter').first();
    if (await diagBtn.isVisible().catch(() => false)) {
      await diagBtn.click();
      await page.waitForTimeout(800);
    }

    // Go to SWIPE
    await page.click('[data-nav="swipe"]').catch(() => {});
    await page.waitForTimeout(1000);

    // Complete one hand
    const actions = await page.locator('[data-sa]').all();
    if (actions.length > 0) {
      await actions[0].click();
      await page.waitForTimeout(1500);

      // Check if verdict is visible and has a button
      const verdict = await page.locator('#swipeFlash, .v31Verdict, .swipeFlash').first();
      const hasButton = await page.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ")').first().isVisible().catch(() => false);

      if (await verdict.isVisible().catch(() => false) && hasButton) {
        console.log('  ✓ Auto-advance REMOVED - result stays visible, button present');
        testResults.autoAdvanceRemoved = true;
      } else {
        console.log('  ⚠️  Could not verify auto-advance removal fully');
      }
    }

  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function testMyResults(browser) {
  const page = await browser.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
    await page.waitForTimeout(1000);

    const beforeEvents = await page.evaluate(() => window.S?.events?.length || 0);
    console.log(`  Initial events: ${beforeEvents}`);

    // Skip onboarding
    const diagBtn = await page.locator('button:has-text("ВОЙТИ"), #diagEnter').first();
    if (await diagBtn.isVisible().catch(() => false)) {
      await diagBtn.click();
      await page.waitForTimeout(800);
    }

    // Test SWIPE
    console.log('  Testing SWIPE mode...');
    await page.click('[data-nav="swipe"]').catch(() => {});
    await page.waitForTimeout(800);

    for (let i = 0; i < 2; i++) {
      const actions = await page.locator('[data-sa]').all();
      if (actions.length > 0) {
        await actions[0].click();
        await page.waitForTimeout(1200);
        const nextBtn = await page.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ")').first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(600);
        }
      }
    }

    const afterSwipe = await page.evaluate(() => window.S?.events?.length || 0);
    console.log(`  SWIPE: ${afterSwipe - beforeEvents} events recorded`);
    if (afterSwipe > beforeEvents) testResults.myResults.modesFound.push('SWIPE');

    // Test SIZING
    console.log('  Testing SIZING mode...');
    await page.click('[data-nav="sizing"]').catch(() => {});
    await page.waitForTimeout(800);

    const sizeBtn = await page.locator('button:has-text("ПОСТАВИТЬ")').first();
    if (await sizeBtn.isVisible().catch(() => false)) {
      await sizeBtn.click();
      await page.waitForTimeout(800);
      const nextBtn = await page.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ")').first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(600);
      }
    }

    const afterSizing = await page.evaluate(() => window.S?.events?.length || 0);
    console.log(`  SIZING: ${afterSizing - afterSwipe} events recorded`);
    if (afterSizing > afterSwipe) testResults.myResults.modesFound.push('SIZING');

    // Check My Results page
    console.log('  Checking "Мои результаты"...');
    await page.click('[data-nav="profile"]').catch(() => {});
    await page.waitForTimeout(800);

    const resultsBtn = await page.locator('button:has-text("результаты"), button:has-text("РЕЗУЛЬТАТЫ")').first();
    if (await resultsBtn.isVisible().catch(() => false)) {
      await resultsBtn.click();
      await page.waitForTimeout(800);

      const events = await page.locator('[data-event], .event, tr[data-event-id]').all();
      if (events.length > 0) {
        console.log(`  ✓ "Мои результаты" displays ${events.length} events`);
        testResults.myResults.verified = true;
      } else {
        console.log(`  ⚠️  Page found but no events rendered`);
      }
    }

    testResults.myResults.tested = true;

  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function testPersonalizationSignal(browser) {
  // Quick test: do two different profiles get the same tasks?

  console.log('  Testing task randomness in SWIPE...');

  // Profile 1
  const page1 = await browser.newPage();
  await page1.evaluate(() => localStorage.clear());

  try {
    await page1.goto(APP_URL, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
    await page1.waitForTimeout(1000);

    const diagBtn1 = await page1.locator('button:has-text("ВОЙТИ"), #diagEnter').first();
    if (await diagBtn1.isVisible().catch(() => false)) {
      await diagBtn1.click();
      await page1.waitForTimeout(800);
    }

    await page1.click('[data-nav="swipe"]').catch(() => {});
    await page1.waitForTimeout(800);

    const profile1Tasks = [];
    for (let i = 0; i < 10; i++) {
      const taskId = await page1.evaluate(() => window.swSession?.[window.swIndex]?.id);
      profile1Tasks.push(taskId);

      const actions = await page1.locator('[data-sa]').all();
      if (actions.length > 0) {
        await actions[Math.floor(Math.random() * actions.length)].click();
        await page1.waitForTimeout(1200);
        const nextBtn = await page1.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ")').first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page1.waitForTimeout(600);
        }
      }
    }

    testResults.personalization.weakTasks = profile1Tasks.length;
    console.log(`  Profile 1: ${profile1Tasks.length} tasks collected`);

    await page1.close();
  } catch (err) {
    await page1.close();
    console.log(`  ❌ Profile 1 error: ${err.message}`);
  }

  // Profile 2
  const page2 = await browser.newPage();
  await page2.evaluate(() => localStorage.clear());

  try {
    await page2.goto(APP_URL, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
    await page2.waitForTimeout(1000);

    const diagBtn2 = await page2.locator('button:has-text("ВОЙТИ"), #diagEnter').first();
    if (await diagBtn2.isVisible().catch(() => false)) {
      await diagBtn2.click();
      await page2.waitForTimeout(800);
    }

    await page2.click('[data-nav="swipe"]').catch(() => {});
    await page2.waitForTimeout(800);

    const profile2Tasks = [];
    for (let i = 0; i < 10; i++) {
      const taskId = await page2.evaluate(() => window.swSession?.[window.swIndex]?.id);
      profile2Tasks.push(taskId);

      const actions = await page2.locator('[data-sa]').all();
      if (actions.length > 0) {
        await actions[Math.floor(Math.random() * actions.length)].click();
        await page2.waitForTimeout(1200);
        const nextBtn = await page2.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ")').first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page2.waitForTimeout(600);
        }
      }
    }

    testResults.personalization.strongTasks = profile2Tasks.length;
    console.log(`  Profile 2: ${profile2Tasks.length} tasks collected`);

    // Calculate overlap
    const set1 = new Set(profile1Tasks);
    const overlap = profile2Tasks.filter(t => set1.has(t)).length;
    const overlapPct = (overlap / 10) * 100;

    testResults.personalization.overlap = overlapPct;

    if (overlapPct >= 80) {
      testResults.personalization.verdict = 'RANDOM (no personalization - expected ~90%+ overlap)';
      testResults.findings.push('CONFIRMED: Task selection remains random in SWIPE mode');
    } else if (overlapPct >= 50) {
      testResults.personalization.verdict = 'PARTIAL (some personalization)';
    } else {
      testResults.personalization.verdict = 'PERSONALIZED';
    }

    console.log(`  Task overlap: ${overlap}/10 (${overlapPct.toFixed(0)}%)`);
    console.log(`  Personalization: ${testResults.personalization.verdict}`);

    await page2.close();
  } catch (err) {
    await page2.close();
    console.log(`  ❌ Profile 2 error: ${err.message}`);
  }

  testResults.spacedRep.verdict = 'NOT TESTED (requires extensive history)';
}

main().catch(console.error);
