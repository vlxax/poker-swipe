import { chromium } from '@playwright/test';

async function diagnose() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });

  const page = await context.newPage();
  
  const errors = [];
  const logs = [];

  page.on('pageerror', error => {
    errors.push({
      type: 'uncaught',
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push({
        type: 'console.error',
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  try {
    console.log('Loading http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    console.log('\n=== WAITING 2 SECONDS FOR BOOT SEQUENCE ===');
    await page.waitForTimeout(2000);

    const state = await page.evaluate(() => ({
      S_defined: typeof window.S !== 'undefined',
      PokerSwipeCore_defined: typeof window.PokerSwipeCore !== 'undefined',
      show_defined: typeof show !== 'undefined',
      ui_defined: typeof ui !== 'undefined',
      renderHome_defined: typeof renderHome !== 'undefined',
      renderSizing_defined: typeof renderSizing !== 'undefined',
      renderDiagnostic_defined: typeof renderDiagnostic !== 'undefined',
      booted: !!window.__pokerBooted,
      S_value: window.S ? { version: window.S.version, nick: window.S.nick } : null
    }));

    console.log('\n=== PAGE STATE ===');
    console.log(JSON.stringify(state, null, 2));

  } catch (error) {
    console.error('Page load error:', error.message);
  }

  console.log('\n=== UNCAUGHT ERRORS ===');
  if (errors.length === 0) {
    console.log('✓ No uncaught errors');
  } else {
    errors.forEach((err, i) => {
      console.log(`\n${i+1}. ${err.name}: ${err.message}`);
      console.log('Stack:');
      console.log(err.stack);
    });
  }

  console.log('\n=== CONSOLE ERRORS ===');
  if (logs.length === 0) {
    console.log('✓ No console errors');
  } else {
    logs.forEach((log, i) => {
      console.log(`\n${i+1}. ${log.text}`);
      console.log('Location:', log.location);
    });
  }

  await context.close();
  await browser.close();
}

diagnose().catch(console.error);
