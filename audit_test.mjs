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
  const logs = [];
  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    logs.push({ type, text });
    if (type === 'error') errors.push(text);
    if (type === 'warn') warnings.push(text);
  });

  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  console.log('=== LOADING APP ===\n');
  await page.goto('http://localhost:8000/index.html', { 
    waitUntil: 'networkidle', 
    timeout: 30000 
  });

  await page.waitForTimeout(3000);

  const audit = await page.evaluate(() => {
    return {
      // Script functions
      show: typeof window.show,
      recordEvent: typeof window.recordEvent,
      renderSwipe: typeof window.renderSwipe,
      renderSizing: typeof window.renderSizing,
      renderReview: typeof window.renderReview,
      renderHome: typeof window.renderHome,
      renderProfile: typeof window.renderProfile,
      renderMy: typeof window.renderMy,
      
      // Global state
      S_exists: typeof window.S === 'object',
      S_keys: window.S ? Object.keys(window.S).slice(0, 5) : null,
      
      // Bootstrap
      PokerSwipeAuthBootstrap: typeof window.PokerSwipeAuthBootstrap,
      PokerSwipeAuth: typeof window.PokerSwipeAuth,
      
      // DOM
      mainApp: {
        exists: !!document.getElementById('mainApp'),
        hidden: document.getElementById('mainApp')?.classList.contains('hidden'),
        display: window.getComputedStyle(document.getElementById('mainApp')).display,
        visible: document.getElementById('mainApp')?.offsetParent !== null
      },
      
      authEmail: {
        exists: !!document.querySelector('#auth-email, [id*="email"]'),
        display: window.getComputedStyle(document.querySelector('#auth-email, [id*="email"]')).display
      },
      
      app: {
        exists: !!document.querySelector('.app'),
        display: window.getComputedStyle(document.querySelector('.app')).display
      },
      
      screens: {
        total: document.querySelectorAll('.screen').length,
        active: document.querySelector('.screen.active')?.id,
        homeActive: document.getElementById('home')?.classList.contains('active'),
        homeDisplay: window.getComputedStyle(document.getElementById('home')).display
      },
      
      // V32+ status
      v32_baseShow: typeof window.__v32_baseShow,
      charts: window.charts ? window.charts.length : 'undefined',
      
      // Root styles
      rootBg: window.getComputedStyle(document.documentElement).getPropertyValue('--bg'),
      rootColor: window.getComputedStyle(document.documentElement).getPropertyValue('--text'),
      
      // Try to call show
      canCallShow: (() => {
        try {
          return typeof window.show === 'function';
        } catch (e) {
          return 'ERROR: ' + e.message;
        }
      })()
    };
  });

  console.log('=== AUDIT RESULTS ===\n');
  console.log('SCRIPT FUNCTIONS:');
  console.log('  show():', audit.show);
  console.log('  recordEvent():', audit.recordEvent);
  console.log('  renderSwipe():', audit.renderSwipe);
  console.log('  renderHome():', audit.renderHome);
  console.log('  renderProfile():', audit.renderProfile);
  console.log('  renderMy():', audit.renderMy);
  
  console.log('\nGLOBAL STATE:');
  console.log('  S exists:', audit.S_exists);
  console.log('  S keys:', audit.S_keys);
  console.log('  PokerSwipeAuth:', audit.PokerSwipeAuth);
  console.log('  PokerSwipeAuthBootstrap:', audit.PokerSwipeAuthBootstrap);
  
  console.log('\nDOM STRUCTURE:');
  console.log('  mainApp exists:', audit.mainApp.exists);
  console.log('  mainApp hidden:', audit.mainApp.hidden);
  console.log('  mainApp display:', audit.mainApp.display);
  console.log('  mainApp visible:', audit.mainApp.visible);
  console.log('  authEmail display:', audit.authEmail.display);
  console.log('  app display:', audit.app.display);
  
  console.log('\nSCREENS:');
  console.log('  total screens:', audit.screens.total);
  console.log('  active screen:', audit.screens.active);
  console.log('  home active:', audit.screens.homeActive);
  console.log('  home display:', audit.screens.homeDisplay);
  
  console.log('\nV32+ STATUS:');
  console.log('  __v32_baseShow:', audit.v32_baseShow);
  console.log('  charts length:', audit.charts);
  
  console.log('\nSTYLES:');
  console.log('  root --bg:', audit.rootBg);
  console.log('  root --text:', audit.rootColor);
  
  console.log('\nFUNCTION TEST:');
  console.log('  Can call show():', audit.canCallShow);
  
  console.log('\n=== CONSOLE LOGS ===\n');
  logs.slice(0, 30).forEach(log => {
    console.log(`[${log.type}] ${log.text}`);
  });
  
  if (logs.length > 30) {
    console.log(`\n... and ${logs.length - 30} more logs`);
  }
  
  console.log('\n=== CRITICAL ERRORS ===\n');
  if (errors.length > 0) {
    errors.slice(0, 10).forEach(err => console.log('ERROR:', err));
  } else {
    console.log('No critical errors detected');
  }

} finally {
  await browser.close();
}
