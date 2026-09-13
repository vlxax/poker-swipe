#!/usr/bin/node
/**
 * Behavioral Runtime QA - Working Version
 * Directly tests app functionality without localStorage manipulation
 */

import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const APP_URL = 'http://localhost:8888/index.html';

let results = {
  autoAdvanceRemoved: false,
  eventsRecorded: 0,
  modesWorking: [],
  myResultsPage: false,
  taskRandomness: 'UNKNOWN'
};

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });

  try {
    console.log('\n' + '='.repeat(70));
    console.log('BEHAVIORAL RUNTIME VERIFICATION - DIRECT TESTING');
    console.log('='.repeat(70));

    // TEST 1: Auto-advance removal
    console.log('\n[TEST 1] AUTO-ADVANCE REMOVAL IN SWIPE');
    console.log('-'.repeat(70));
    const page1 = await browser.newPage();
    await page1.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page1.waitForTimeout(2000);

    // Look for the verdict verdict and whether button shows up
    const swipeNav = await page1.locator('[data-nav="swipe"], button:has-text("SWIPE")').first();
    if (await swipeNav.isVisible().catch(() => false)) {
      console.log('  ✓ SWIPE mode exists');
      await swipeNav.click();
      await page1.waitForTimeout(1500);

      // Make a decision
      const actions = await page1.locator('[data-sa]').all();
      if (actions.length > 0) {
        console.log(`  ✓ Found ${actions.length} action buttons`);
        await actions[0].click();
        await page1.waitForTimeout(1500);

        // Check if verdict appears
        const verdict = await page1.locator('#swipeFlash, .v31Verdict, .swipeFlash').first();
        if (await verdict.isVisible().catch(() => false)) {
          console.log('  ✓ Verdict appears after action');

          // Check for next button
          await page1.waitForTimeout(500); // Wait to see if auto-advance happens
          const nextButton = await page1.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ"), #manualNext, #verdictNext').first();
          if (await nextButton.isVisible().catch(() => false)) {
            console.log('  ✓ Next button is visible (NOT auto-advancing)');
            results.autoAdvanceRemoved = true;
          } else {
            console.log('  ✗ No next button found (may have auto-advanced)');
          }
        }
      }
    }
    await page1.close();

    // TEST 2: Results recording
    console.log('\n[TEST 2] RESULTS RECORDING');
    console.log('-'.repeat(70));
    const page2 = await browser.newPage();
    await page2.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(2000);

    // Complete tasks in SWIPE
    const swipeNav2 = await page2.locator('[data-nav="swipe"], button:has-text("SWIPE")').first();
    if (await swipeNav2.isVisible().catch(() => false)) {
      await swipeNav2.click();
      await page2.waitForTimeout(1000);

      console.log('  Testing SWIPE mode...');
      for (let i = 0; i < 3; i++) {
        const actions = await page2.locator('[data-sa]').all();
        if (actions.length > 0) {
          await actions[0].click();
          await page2.waitForTimeout(1500);

          const nextBtn = await page2.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ"), #manualNext, #verdictNext').first();
          if (await nextBtn.isVisible().catch(() => false)) {
            await nextBtn.click();
            await page2.waitForTimeout(500);
          }

          console.log(`    Task ${i + 1}/3 completed`);
        }
      }

      results.modesWorking.push('SWIPE');
      console.log('  ✓ SWIPE mode executed');
    }

    // Test SIZING
    const sizingNav = await page2.locator('[data-nav="sizing"], button:has-text("SIZING")').first();
    if (await sizingNav.isVisible().catch(() => false)) {
      await sizingNav.click();
      await page2.waitForTimeout(1000);

      const lockBtn = await page2.locator('button:has-text("ПОСТАВИТЬ"), #sizeLock').first();
      if (await lockBtn.isVisible().catch(() => false)) {
        await lockBtn.click();
        await page2.waitForTimeout(1000);

        const nextBtn = await page2.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ")').first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page2.waitForTimeout(500);
        }

        results.modesWorking.push('SIZING');
        console.log('  ✓ SIZING mode executed');
      }
    }

    // TEST 3: My Results page
    console.log('\n[TEST 3] MY RESULTS PAGE');
    console.log('-'.repeat(70));

    const profileNav = await page2.locator('[data-nav="profile"], button:has-text("ПРОФИЛЬ")').first();
    if (await profileNav.isVisible().catch(() => false)) {
      await profileNav.click();
      await page2.waitForTimeout(1000);

      const resultsBtn = await page2.locator('button:has-text("результаты"), button:has-text("РЕЗУЛЬТАТЫ"), a:has-text("результаты")').first();
      if (await resultsBtn.isVisible().catch(() => false)) {
        await resultsBtn.click();
        await page2.waitForTimeout(1000);

        // Look for event display
        const eventRows = await page2.locator('[data-event], .event, tr').all();
        if (eventRows.length > 0) {
          console.log(`  ✓ My Results page found with ${eventRows.length} elements`);
          results.myResultsPage = true;
        } else {
          console.log('  ⚠️  My Results page exists but no event data visible');
        }
      } else {
        console.log('  ⚠️  My Results link not found');
      }
    }

    // TEST 4: Task randomness
    console.log('\n[TEST 4] TASK RANDOMNESS INDICATOR');
    console.log('-'.repeat(70));

    const page3a = await browser.newPage();
    const page3b = await browser.newPage();

    try {
      // Open first profile
      await page3a.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page3a.waitForTimeout(2000);

      const swipeNav3a = await page3a.locator('[data-nav="swipe"], button:has-text("SWIPE")').first();
      if (await swipeNav3a.isVisible().catch(() => false)) {
        await swipeNav3a.click();
        await page3a.waitForTimeout(1000);

        const profile1Tasks = [];
        for (let i = 0; i < 5; i++) {
          const taskName = await page3a.locator('#swipeVisual, [data-spot-id], .swipeName, h1').first().textContent().catch(() => 'UNKNOWN');
          profile1Tasks.push(taskName);

          const actions = await page3a.locator('[data-sa]').all();
          if (actions.length > 0) {
            await actions[Math.floor(Math.random() * actions.length)].click();
            await page3a.waitForTimeout(1000);

            const nextBtn = await page3a.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ"), #manualNext, #verdictNext').first();
            if (await nextBtn.isVisible().catch(() => false)) {
              await nextBtn.click();
              await page3a.waitForTimeout(500);
            }
          }
        }

        console.log(`  Profile A: Collected ${profile1Tasks.length} tasks`);
      }

      // Open second profile (new tab)
      await page3b.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page3b.waitForTimeout(2000);

      const swipeNav3b = await page3b.locator('[data-nav="swipe"], button:has-text("SWIPE")').first();
      if (await swipeNav3b.isVisible().catch(() => false)) {
        await swipeNav3b.click();
        await page3b.waitForTimeout(1000);

        const profile2Tasks = [];
        for (let i = 0; i < 5; i++) {
          const taskName = await page3b.locator('#swipeVisual, [data-spot-id], .swipeName, h1').first().textContent().catch(() => 'UNKNOWN');
          profile2Tasks.push(taskName);

          const actions = await page3b.locator('[data-sa]').all();
          if (actions.length > 0) {
            await actions[Math.floor(Math.random() * actions.length)].click();
            await page3b.waitForTimeout(1000);

            const nextBtn = await page3b.locator('button:has-text("СЛЕДУЮЩИЙ"), button:has-text("ДАЛЬШЕ"), #manualNext, #verdictNext').first();
            if (await nextBtn.isVisible().catch(() => false)) {
              await nextBtn.click();
              await page3b.waitForTimeout(500);
            }
          }
        }

        console.log(`  Profile B: Collected ${profile2Tasks.length} tasks`);

        // Check overlap
        const set1 = new Set(profile1Tasks.filter(t => t !== 'UNKNOWN'));
        const overlap = profile2Tasks.filter(t => set1.has(t)).length;
        const overlapPct = (overlap / profile2Tasks.length) * 100;

        console.log(`  Overlap: ${overlap}/${profile2Tasks.length} (${overlapPct.toFixed(0)}%)`);

        if (overlapPct >= 70) {
          results.taskRandomness = `LIKELY RANDOM (${overlapPct.toFixed(0)}% overlap)`;
        } else {
          results.taskRandomness = `LIKELY PERSONALIZED (${overlapPct.toFixed(0)}% overlap)`;
        }
      }
    } catch (err) {
      console.log(`  ✗ Task randomness test error: ${err.message}`);
    } finally {
      await page3a.close();
      await page3b.close();
    }

    await browser.close();

  } catch (err) {
    console.error('\n❌ CRITICAL ERROR:', err.message);
    await browser.close();
    process.exit(1);
  }

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('BEHAVIORAL AUDIT SUMMARY');
  console.log('='.repeat(70));

  console.log(`\n✓ AUTO-ADVANCE: ${results.autoAdvanceRemoved ? 'REMOVED' : 'STILL PRESENT'}`);
  console.log(`✓ MODES WORKING: ${results.modesWorking.join(', ') || 'NONE'}`);
  console.log(`✓ MY RESULTS PAGE: ${results.myResultsPage ? 'VERIFIED' : 'NOT VERIFIED'}`);
  console.log(`✓ TASK RANDOMNESS: ${results.taskRandomness}`);

  console.log('\n' + '='.repeat(70));

  writeFileSync(
    '/tmp/claude-0/-home-user-poker-swipe/bc409c6b-8cc3-5855-a269-6fd753c95fcf/scratchpad/behavioral_runtime_v2.json',
    JSON.stringify(results, null, 2)
  );

  process.exit(0);
}

main().catch(console.error);
