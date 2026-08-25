import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3344';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });

  try {
    console.log('>>> Loading app...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    console.log('\n=== HOME SCREEN ===');
    const homeState = await page.evaluate(() => {
      return {
        homeVisible: !!document.querySelector('#home'),
        swipeButton: !!document.querySelector('#homeSwipe'),
        allButtons: document.querySelectorAll('button').length
      };
    });
    console.log(JSON.stringify(homeState, null, 2));
    
    // Click SWIPE button on home
    const swipeBtn = await page.$('#homeSwipe');
    if (swipeBtn) {
      console.log('\n>>> Clicking #homeSwipe button');
      await swipeBtn.click();
      await page.waitForTimeout(1500);
    }
    
    console.log('\n=== SWIPE SCREEN ===');
    const swipeState = await page.evaluate(() => {
      const card = document.querySelector('#swipeCard');
      const actions = document.querySelector('#swipeActions');
      return {
        cardHTML: card?.innerHTML?.substring(0, 300),
        actionsHTML: actions?.innerHTML?.substring(0, 300),
        actionButtons: Array.from(document.querySelectorAll('[data-sa]')).map(btn => ({
          text: btn.textContent?.trim(),
          dataValue: btn.getAttribute('data-sa'),
          clickable: btn.offsetParent !== null
        }))
      };
    });
    console.log(JSON.stringify(swipeState, null, 2));
    
    // Click first action button
    const firstAction = await page.$('[data-sa]');
    if (firstAction) {
      const actionText = await firstAction.textContent();
      console.log(`\n>>> Clicking first action: "${actionText?.trim()}"`);
      await firstAction.click();
      await page.waitForTimeout(3000);
    }
    
    console.log('\n=== AFTER ACTION CLICK ===');
    const afterClick = await page.evaluate(() => {
      const verdict = document.querySelector('#swipeVerdict');
      const flash = document.querySelector('#swipeFlash');
      return {
        verdictHidden: verdict?.classList.contains('hidden'),
        verdictDisplay: window.getComputedStyle(verdict).display,
        verdictContent: verdict?.innerHTML?.substring(0, 500),
        flashExists: !!flash,
        flashClass: flash?.className,
        characterElements: {
          psReaction: !!document.querySelector('.ps-character-reaction'),
          psMonster: !!document.querySelector('.ps-monster-reaction'),
          freakCoach: !!document.querySelector('.freakCoachReaction'),
          video: !!document.querySelector('video'),
          canvas: !!document.querySelector('canvas')
        },
        gradeClasses: Array.from(document.querySelectorAll('[class*="grade"]')).map(el => ({
          class: el.className,
          text: el.textContent?.substring(0, 50)
        }))
      };
    });
    console.log(JSON.stringify(afterClick, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
