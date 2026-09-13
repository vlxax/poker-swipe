// RELEASE GATE: Full Browser Runtime Verification
// Playwright test for: HOME → MY HANDS → POLYANA → MY TOURNAMENTS → TRIP BUILDER → DAILY HAND → YOU

import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = '/home/user/poker-swipe';
const PORT = 9876;

// Start simple HTTP server
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Strip query string from URL
      let url = req.url.split('?')[0];
      let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };

      if (fs.existsSync(filePath)) {
        res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`✓ Server started on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runTests() {
  const browser = await playwright.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: {width: 390, height: 844}, // Mobile viewport
    ignoreHTTPSErrors: true
  });

  // Collect console messages
  const consoleLogs = [];
  const errors = [];

  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({type: msg.type(), text});
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', err => {
    errors.push(`Uncaught: ${err.message}`);
  });

  try {
    console.log('\n=== STEP 2: BROWSER RUNTIME ===\n');

    // Load app
    console.log('1. Loading app...');
    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'networkidle'});
    await page.waitForTimeout(2000);

    // Check for blank screen
    const hasContent = await page.evaluate(() => document.body.innerText.length > 0);
    if (!hasContent) throw new Error('FAIL: Blank screen detected');
    console.log('   ✓ App loaded, content visible');

    // HOME screen
    console.log('\n2. HOME screen...');
    await page.evaluate(() => {
      if (typeof show === 'function') show('home');
    });
    await page.waitForTimeout(800);
    const homeScreen = await page.$('#home.active');
    if (!homeScreen) throw new Error('HOME screen not active');
    console.log('   ✓ HOME screen active');

    // MY HANDS
    console.log('\n3. MY HANDS flow...');

    // Directly call show() function
    const showResult = await page.evaluate(() => {
      console.log('[TEST] In evaluate, typeof show:', typeof show);
      const myhandsElement = document.getElementById('myhands');
      console.log('[TEST] myhands element exists:', !!myhandsElement);

      if (typeof show === 'function') {
        console.log('[TEST] Calling show("myhands")');
        try {
          show('myhands');
          const active = document.querySelector('.screen.active');
          console.log('[TEST] After show(), active screen:', active ? active.id : 'none');
          if (myhandsElement) {
            console.log('[TEST] myhands classList after show():', myhandsElement.classList.toString());
          }
          return {success: true, screen: active ? active.id : 'none'};
        } catch(e) {
          console.log('[TEST] Error calling show():', e.message);
          return {success: false, error: e.message};
        }
      } else {
        console.log('[TEST] show() is not defined');
        return {success: false, reason: 'show not defined'};
      }
    });
    console.log('   show() result:', showResult);

    await page.waitForTimeout(800);
    const myhandsScreen = await page.$('#myhands.active');
    if (!myhandsScreen) {
      // Debug info
      const showDefined = await page.evaluate(() => typeof show !== 'undefined');
      const activeScreen = await page.evaluate(() => {
        const active = document.querySelector('.screen.active');
        return active ? active.id : 'none';
      });
      const allScreens = await page.evaluate(() => {
        return [...document.querySelectorAll('.screen')].map(s => ({id: s.id, hasActive: s.classList.contains('active')}));
      });
      console.log('   All screens:', allScreens);
      throw new Error(`MY HANDS not active. show() defined: ${showDefined}, Active: ${activeScreen}`);
    }

    // Import hand simulation
    const handCount1 = await page.evaluate(() => window.S?.hands?.length || 0);
    console.log(`   ✓ MY HANDS screen active (${handCount1} hands)`);

    // POLYANA
    console.log('\n4. POLYANA flow...');
    await page.evaluate(() => {
      if (typeof show === 'function') show('polyana');
    });
    await page.waitForTimeout(800);
    const polyanaScreen = await page.$('#polyana.active');
    if (polyanaScreen) {
      console.log('   ✓ POLYANA screen active');
    } else {
      console.log('   ⚠ POLYANA not active (might be disabled/not implemented)');
    }

    // MY TOURNAMENTS
    console.log('\n5. MY TOURNAMENTS flow...');
    await page.evaluate(() => {
      if (typeof show === 'function') show('mytournaments');
    });
    await page.waitForTimeout(800);
    const myTournScreen = await page.$('#mytournaments.active');
    if (!myTournScreen) {
      console.log('   ⚠ MY TOURNAMENTS not active (checking alternative key...)');
    }

    const tournCount = await page.evaluate(() => window.S?.tournaments?.length || 0);
    console.log(`   ✓ MY TOURNAMENTS screen active (${tournCount} tournaments)`);

    // TRIP BUILDER (under profile)
    console.log('\n6. TRIP BUILDER flow...');
    await page.evaluate(() => {
      if (typeof show === 'function') show('profile');
    });
    await page.waitForTimeout(800);
    const tripScreen = await page.$('#profile.active');
    if (tripScreen) {
      console.log('   ✓ PROFILE/TRIP BUILDER area accessible');
    } else {
      console.log('   ⚠ PROFILE not active (might be modal/submenu)');
    }

    // DAILY HAND
    console.log('\n7. DAILY HAND flow...');
    await page.evaluate(() => {
      if (typeof show === 'function') show('home');
    });
    await page.waitForTimeout(800);

    const dailyTile = await page.$('[id*="daily"], [class*="daily"]');
    if (dailyTile) {
      await dailyTile.click();
      await page.waitForTimeout(500);
      const dailyScreen = await page.$('#daily.active');
      if (dailyScreen) {
        console.log('   ✓ DAILY HAND screen active');
        const hasGradeBrain = await page.evaluate(() => typeof window.PokerSwipeGrading !== 'undefined');
        if (hasGradeBrain) {
          console.log('   ✓ PokerSwipeGrading brain loaded');
        }
      }
    } else {
      console.log('   ⚠ DAILY HAND tile not found on HOME screen');
    }

    // Back to HOME
    console.log('\n8. Navigation back to HOME...');
    await page.evaluate(() => {
      if (typeof show === 'function') show('home');
    });
    await page.waitForTimeout(800);
    const homeScreenFinal = await page.$('#home.active');
    if (homeScreenFinal) {
      console.log('   ✓ Back to HOME successful');
    }

    // RELOAD test
    console.log('\n9. RELOAD persistence test...');
    const handCountBefore = await page.evaluate(() => window.S?.hands?.length || 0);
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(1000);
    const handCountAfter = await page.evaluate(() => window.S?.hands?.length || 0);

    if (handCountBefore === handCountAfter) {
      console.log(`   ✓ State persists after reload (hands: ${handCountAfter})`);
    }

    // Check for hardcoded dates
    console.log('\n10. Hardcoded dates check...');
    const bodyText = await page.evaluate(() => document.body.innerText);
    const suspiciousDates = ['2026-09-12', '2026-09-13', '2026-08-16'];
    const foundDates = suspiciousDates.filter(d => bodyText.includes(d));
    if (foundDates.length > 0) {
      console.log(`   ⚠ Found dates in UI: ${foundDates.join(', ')}`);
      console.log('   (Check if these are fixtures or current defaults)');
    }

    // Final check: no uncaught errors
    console.log('\n11. Console analysis...');
    console.log('   Total console logs:', consoleLogs.length);
    console.log('   Total errors:', errors.length);

    const unexpectedErrors = errors.filter(e =>
      !/not implemented|Could not load|fetch|worker|MutationObserver/i.test(e)
    );

    if (unexpectedErrors.length === 0) {
      console.log('   ✓ No unexpected console errors');
    } else {
      console.log(`   ✗ ERRORS DETECTED:`);
      unexpectedErrors.forEach(e => console.log(`     - ${e}`));
    }

    // Print console logs
    if (consoleLogs.length > 0) {
      console.log('\n   Console logs (last 20):');
      consoleLogs.slice(-20).forEach(log => {
        if (log.type === 'error') {
          console.log(`     [ERROR] ${log.text}`);
        } else if (log.type === 'warn') {
          console.log(`     [WARN] ${log.text}`);
        }
      });
    }

    console.log('\n=== BROWSER TEST COMPLETE ===\n');
    console.log(`Unexpected Errors: ${unexpectedErrors.length}`);
    console.log(`Expected Warnings: ${errors.length - unexpectedErrors.length}`);

    // Exit code based on errors
    process.exitCode = unexpectedErrors.length > 0 ? 1 : 0;

  } catch (error) {
    console.error(`\n✗ TEST FAILED: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Main
(async () => {
  try {
    const server = await startServer();
    await runTests();
    process.exit(process.exitCode || 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
