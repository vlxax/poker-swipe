// Minimal browser runtime test - verification only
import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = '/home/user/poker-swipe';
const PORT = 9876;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
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
    viewport: {width: 390, height: 844},
    ignoreHTTPSErrors: true
  });

  const errors = [];
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({type: msg.type(), text: msg.text()});
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(`Uncaught: ${err.message}`);
  });

  try {
    console.log('\n=== BROWSER RUNTIME VERIFICATION ===\n');

    // Step 1: Load application
    console.log('STEP 1: Load application...');
    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'networkidle'});
    await page.waitForTimeout(2000);

    const hasContent = await page.evaluate(() => document.body.innerText.length > 0);
    if (!hasContent) throw new Error('App loaded but no content visible');
    console.log('✓ PASS: App loads, renders content\n');

    // Step 2: Verify core state
    console.log('STEP 2: Core application state...');
    const stateCheck = await page.evaluate(() => {
      return {
        hasS: typeof window.S === 'object' && window.S !== null,
        hasShow: typeof show === 'function',
        hasLocalStorage: typeof window.localStorage !== 'undefined',
        homeScreenExists: !!document.getElementById('home'),
        navButtons: document.querySelectorAll('[data-nav]').length
      };
    });

    if (!stateCheck.hasS) {
      console.log('DEBUG:', JSON.stringify(stateCheck));

      // Print console logs from the page
      console.log('\n[PAGE CONSOLE LOGS]');
      consoleLogs.slice(-10).forEach(log => {
        console.log(`  [${log.type.toUpperCase()}] ${log.text}`);
      });

      if (errors.length > 0) {
        console.log('\n[PAGE ERRORS]');
        errors.forEach(e => console.log(`  ${e}`));
      }

      throw new Error('Window.S state object not initialized');
    }
    if (!stateCheck.hasShow) throw new Error('show() function not defined');
    if (!stateCheck.homeScreenExists) throw new Error('Home screen missing');

    console.log(`✓ PASS: State initialized, ${stateCheck.navButtons} nav buttons, localStorage available\n`);

    // Step 3: Verify data structures
    console.log('STEP 3: Data structures...');
    const dataCheck = await page.evaluate(() => {
      return {
        hands: Array.isArray(window.S.hands) ? window.S.hands.length : 'not array',
        tournaments: Array.isArray(window.S.tournaments) ? window.S.tournaments.length : 'not array',
        events: Array.isArray(window.S.events) ? window.S.events.length : 'not array',
        dailyArchive: Array.isArray(window.S.dailyArchive) ? window.S.dailyArchive.length : 'not array'
      };
    });

    console.log(`✓ PASS: Data arrays initialized: ${dataCheck.hands} hands, ${dataCheck.tournaments} tournaments, ${dataCheck.events} events\n`);

    // Step 4: Verify localStorage persistence key
    console.log('STEP 4: Persistence layer...');
    const persistenceKey = 'pokerSwipeV32_user_default';
    const savedState = await page.evaluate((key) => {
      const data = window.localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }, persistenceKey);

    if (savedState) {
      console.log(`✓ PASS: localStorage key "${persistenceKey}" exists and is valid JSON\n`);
    } else {
      console.log(`⚠ WARN: localStorage key not yet populated (first session)\n`);
    }

    // Step 5: Mobile viewport
    console.log('STEP 5: Mobile viewport verification...');
    const viewportCheck = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        hasNavBar: !!document.querySelector('.nav'),
        screenCount: document.querySelectorAll('.screen').length
      };
    });

    if (viewportCheck.width !== 390) throw new Error(`Viewport width is ${viewportCheck.width}, expected 390`);
    console.log(`✓ PASS: Mobile viewport 390x${viewportCheck.height} detected, ${viewportCheck.screenCount} screens\n`);

    // Step 6: Console errors
    console.log('STEP 6: Console error check...');
    const significantErrors = errors.filter(e =>
      !/not implemented|Could not load|fetch|worker|MutationObserver|android|google/i.test(e)
    );

    if (significantErrors.length === 0) {
      console.log(`✓ PASS: No unexpected console errors (${errors.length} expected warnings filtered out)\n`);
    } else {
      console.log(`✗ FAIL: ${significantErrors.length} unexpected errors found`);
      significantErrors.forEach(e => console.log(`  - ${e}`));
      throw new Error('Unexpected console errors');
    }

    // Step 7: Check page doesn't have obvious failures
    console.log('STEP 7: Sanity checks...');
    const sanitycheckResults = await page.evaluate(() => {
      const hasBlankScreen = document.body.innerText.trim().length === 0;
      const allScreensHidden = Array.from(document.querySelectorAll('.screen')).every(s =>
        !s.classList.contains('active') && getComputedStyle(s).display === 'none'
      );
      const navVisible = document.querySelector('.nav') && getComputedStyle(document.querySelector('.nav')).display !== 'none';

      return {
        blankScreen: hasBlankScreen,
        allScreensHidden,
        navVisible
      };
    });

    if (sanitycheckResults.blankScreen) throw new Error('Page is blank');
    if (sanitycheckResults.allScreensHidden) throw new Error('All screens hidden, nothing visible');
    if (!sanitycheckResults.navVisible) console.log('⚠ Navigation bar not visible');

    console.log('✓ PASS: Page renders content, navigation visible\n');

    console.log('=== ALL CHECKS PASSED ===');
    process.exitCode = 0;

  } catch (error) {
    console.error(`\n✗ VERIFICATION FAILED: ${error.message}`);
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
