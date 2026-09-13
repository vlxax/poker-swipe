import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function inspectDOM() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });

  const page = await context.newPage();

  try {
    console.log('🔍 Loading application...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: './evidence/dom-inspect.png' });

    // Inspect DOM
    const domInfo = await page.evaluate(() => {
      return {
        // Check for navigation
        navButtons: Array.from(document.querySelectorAll('[data-nav]')).map(el => ({
          dataNav: el.dataset.nav,
          text: el.textContent.slice(0, 50),
          visible: el.offsetParent !== null
        })),

        // Check for screen elements
        screens: Array.from(document.querySelectorAll('[id*="screen"], section[id], .screen')).map(el => ({
          id: el.id,
          class: el.className,
          visible: el.offsetParent !== null,
          display: window.getComputedStyle(el).display
        })),

        // Check for home tiles
        tiles: Array.from(document.querySelectorAll('#homeSwipe, #homeSizing, #homeDaily, #homeReview, #homeXray')).map(el => ({
          id: el.id,
          text: el.textContent.slice(0, 50),
          visible: el.offsetParent !== null
        })),

        // Check for quick5 button
        quick5: document.getElementById('quick5') ? 'FOUND' : 'NOT FOUND',

        // Check app container
        appContainer: {
          hasMainApp: !!document.getElementById('mainApp'),
          hasHome: !!document.getElementById('home'),
          hasSwipe: !!document.getElementById('swipe'),
          hasSizing: !!document.getElementById('sizing'),
          hasReview: !!document.getElementById('review'),
          hasDaily: !!document.getElementById('daily'),
          hasXray: !!document.getElementById('xray'),
        },

        // Check for intro/onboarding
        onboarding: {
          hasStoryOverlay: !!document.querySelector('.storyCinema21'),
          hasOnboarding: !!document.getElementById('onboarding'),
          hasHello: !!document.getElementById('hello'),
        },

        // Check what's visible
        visibleElements: Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
        }).slice(0, 20).map(el => ({
          tag: el.tagName,
          id: el.id,
          class: el.className.slice(0, 40),
          text: el.textContent.slice(0, 30)
        }))
      };
    });

    console.log('\n=== DOM INSPECTION RESULTS ===\n');
    console.log('Navigation Buttons:');
    domInfo.navButtons.forEach(btn => {
      console.log(`  [${btn.dataNav}] ${btn.text} (visible: ${btn.visible})`);
    });

    console.log('\nScreen Elements:');
    domInfo.screens.forEach(screen => {
      console.log(`  #${screen.id} (${screen.class.slice(0, 30)}) - visible: ${screen.visible}, display: ${screen.display}`);
    });

    console.log('\nHome Tiles:');
    domInfo.tiles.forEach(tile => {
      console.log(`  #${tile.id} - visible: ${tile.visible}`);
    });

    console.log(`\nQuick 5 Button: ${domInfo.quick5}`);

    console.log('\nApp Containers:');
    Object.entries(domInfo.appContainer).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\nOnboarding:');
    Object.entries(domInfo.onboarding).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\nTop visible elements:');
    domInfo.visibleElements.forEach(el => {
      console.log(`  <${el.tag} id="${el.id}" class="${el.class}"> ${el.text}`);
    });

    // Try to find and click through any intro
    console.log('\n=== Attempting to dismiss intro ===');

    const dismissed = await page.evaluate(async () => {
      // Try escape key
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Look for common dismiss patterns
      const closeBtn = document.querySelector('[data-mt="detail-close"], .close-btn, [class*="close"]');
      if (closeBtn) {
        closeBtn.click();
        return 'Clicked close button';
      }

      // Try clicking the onboarding section itself
      const onboarding = document.getElementById('onboarding');
      if (onboarding && onboarding.style.display !== 'none') {
        onboarding.click();
        return 'Clicked onboarding';
      }

      // Try clicking main content area
      const main = document.getElementById('mainApp');
      if (main) {
        main.click();
        return 'Clicked mainApp';
      }

      return 'Nothing to dismiss';
    });

    console.log(`Dismissal attempt: ${dismissed}`);
    await page.waitForTimeout(2000);

    // Take another screenshot
    await page.screenshot({ path: './evidence/dom-inspect-after-dismiss.png' });

    // Check again
    const secondCheck = await page.evaluate(() => {
      return {
        navVisible: Array.from(document.querySelectorAll('[data-nav]')).filter(el => el.offsetParent !== null).map(el => el.dataset.nav),
        homeVisible: !!document.querySelector('#home.active'),
        homeHasTiles: document.querySelectorAll('#homeSwipe, #homeSizing, #homeDaily').length
      };
    });

    console.log('\nAfter dismissal:');
    console.log(`  Nav visible: ${secondCheck.navVisible.join(', ')}`);
    console.log(`  Home is active: ${secondCheck.homeVisible}`);
    console.log(`  Home tiles found: ${secondCheck.homeHasTiles}`);

  } finally {
    await context.close();
    await browser.close();
  }
}

inspectDOM().catch(console.error);
