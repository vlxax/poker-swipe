import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium'
});

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });

  const page = await context.newPage();
  
  // Collect all logs before loading
  const allLogs = [];
  page.on('console', msg => {
    allLogs.push({ type: msg.type(), text: msg.text() });
  });

  console.log('=== LOADING & LISTENING FOR ERRORS ===\n');
  await page.goto('http://localhost:8000/index.html', { 
    waitUntil: 'networkidle', 
    timeout: 30000 
  });

  await page.waitForTimeout(3000);

  // Check what's actually on window
  const windowState = await page.evaluate(() => {
    const functions = [
      'recordEvent', 'renderSwipe', 'renderHome', 'renderProfile', 
      'renderMy', 'show', 'save', 'ui', 'renderStory'
    ];
    
    const result = {};
    for (const fn of functions) {
      const value = window[fn];
      result[fn] = {
        type: typeof value,
        isFunc: typeof value === 'function',
        value: value ? value.toString().substring(0, 50) : 'N/A'
      };
    }
    
    return {
      ...result,
      PokerSwipeCore: typeof window.PokerSwipeCore,
      booted: window.__pokerBooted,
      S: typeof window.S,
      PokerBrain: typeof window.PokerBrain
    };
  });

  console.log('=== WINDOW STATE ===\n');
  console.log(JSON.stringify(windowState, null, 2));

  console.log('\n=== SCRIPT ERRORS ===\n');
  const errors = allLogs.filter(l => l.type === 'error');
  errors.slice(0, 10).forEach(e => {
    console.log(`[ERROR] ${e.text}`);
  });

  console.log('\n=== CRITICAL LOG LINES ===\n');
  const criticals = allLogs.filter(l => 
    l.text.includes('exposeV32') || 
    l.text.includes('BOOT FAILED') ||
    l.text.includes('core bridge') ||
    l.text.includes('missing')
  );
  criticals.forEach(c => {
    console.log(`[${c.type}] ${c.text}`);
  });

  if (criticals.length === 0) {
    console.log('(No critical messages found)');
  }

} finally {
  await browser.close();
}
