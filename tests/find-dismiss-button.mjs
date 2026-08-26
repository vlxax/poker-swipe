import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function findDismiss() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true
  });

  const page = await context.newPage();

  try {
    console.log('Loading...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Find all clickable elements in the onboarding section
    const buttons = await page.evaluate(() => {
      const onboarding = document.getElementById('onboarding');
      if (!onboarding) return [];

      return Array.from(onboarding.querySelectorAll('button, [role="button"], [onclick], a, [style*="cursor:pointer"]')).map((el, idx) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          idx,
          tag: el.tagName,
          id: el.id,
          class: el.className.slice(0, 60),
          text: el.textContent.slice(0, 50),
          html: el.outerHTML.slice(0, 120),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0,
          onclick: !!el.onclick,
          dataAttrs: Object.fromEntries(Object.entries(el.dataset))
        };
      });
    });

    console.log('\n=== CLICKABLE ELEMENTS IN ONBOARDING ===\n');
    buttons.forEach(btn => {
      console.log(`[${btn.idx}] <${btn.tag}> ${btn.id ? '#' + btn.id : ''} .${btn.class}`);
      console.log(`    Text: "${btn.text}"`);
      console.log(`    Visible: ${btn.visible}, Has onclick: ${btn.onclick}`);
      console.log(`    HTML: ${btn.html}`);
      console.log();
    });

    // Try finding the swipe gesture or any indication of how to proceed
    const storyInfo = await page.evaluate(() => {
      const cinema = document.querySelector('.storyCinema21');
      const step = document.querySelector('.storyStep21');
      const orbit = document.querySelector('.storyOrbit21');

      return {
        cinema: cinema ? {
          visible: window.getComputedStyle(cinema).display !== 'none',
          classes: cinema.className,
          children: Array.from(cinema.children).map(c => c.className)
        } : null,
        step: step ? {
          visible: window.getComputedStyle(step).display !== 'none',
          classes: step.className,
          textContent: step.textContent.slice(0, 100)
        } : null,
        hasSwipeListener: !!window.onswipe || !!document.onswipe || !!window.ontouchstart
      };
    });

    console.log('\n=== STORY STRUCTURE ===');
    console.log(JSON.stringify(storyInfo, null, 2));

    // Skip click attempt, go straight to direct navigation
    console.log('\n=== SKIPPING ANIMATED CLICK, USING DIRECT NAV ===');

    const afterTap = await page.evaluate(() => {
      return {
        onboardingVisible: document.getElementById('onboarding').style.display !== 'none',
        onboardingDisplayComputed: window.getComputedStyle(document.getElementById('onboarding')).display,
        homeActive: document.getElementById('home').classList.contains('active'),
      };
    });

    console.log('After tap:');
    console.log(`  Onboarding visible: ${afterTap.onboardingVisible}`);
    console.log(`  Onboarding display (computed): ${afterTap.onboardingDisplayComputed}`);
    console.log(`  Home is active: ${afterTap.homeActive}`);

    await page.screenshot({ path: './evidence/after-tap.png' });

    // Try navigating directly to home via show() function if it exists
    console.log('\n=== TRYING DIRECT NAVIGATION ===');
    const navSuccess = await page.evaluate(() => {
      if (typeof show === 'function') {
        show('home');
        return true;
      }
      // Hide onboarding directly
      const onboarding = document.getElementById('onboarding');
      if (onboarding) {
        onboarding.style.display = 'none';
        onboarding.classList.add('hidden');
        return true;
      }
      return false;
    });

    console.log(`Direct nav success: ${navSuccess}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: './evidence/after-direct-nav.png' });

    // Final check
    const finalState = await page.evaluate(() => {
      return {
        onboardingDisplay: window.getComputedStyle(document.getElementById('onboarding')).display,
        homeActive: document.getElementById('home').classList.contains('active'),
        navVisible: Array.from(document.querySelectorAll('[data-nav]')).some(el => el.offsetParent !== null),
        homeChildren: document.getElementById('home')?.children.length || 0
      };
    });

    console.log('\nFinal state:');
    console.log(JSON.stringify(finalState, null, 2));

  } finally {
    await context.close();
    await browser.close();
  }
}

findDismiss().catch(console.error);
