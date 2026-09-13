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
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    console.log('=== INITIAL APP STATE ===');
    const initialState = await page.evaluate(() => {
      return {
        hasSwipeCard: !!document.querySelector('#swipeCard'),
        hasSwipeActions: !!document.querySelector('#swipeActions'),
        swipeCardDisplay: window.getComputedStyle(document.querySelector('#swipeCard')).display,
        swipeVerdict: {
          hidden: document.querySelector('#swipeVerdict')?.classList.contains('hidden'),
          display: window.getComputedStyle(document.querySelector('#swipeVerdict')).display,
          content: document.querySelector('#swipeVerdict')?.innerHTML?.substring(0, 200)
        },
        hasNavButtons: {
          swipe: !!document.querySelector('[data-nav="swipe"]'),
          sizing: !!document.querySelector('[data-nav="sizing"]'),
          review: !!document.querySelector('[data-nav="review"]')
        }
      };
    });
    console.log(JSON.stringify(initialState, null, 2));
    
    // Click SWIPE nav
    const swipeNav = await page.$('[data-nav="swipe"]');
    if (swipeNav) {
      console.log('\n>>> Clicking SWIPE nav button');
      await swipeNav.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('\n=== AFTER SWIPE NAV CLICK ===');
    const afterNav = await page.evaluate(() => {
      const card = document.querySelector('#swipeCard');
      const actions = document.querySelector('#swipeActions');
      return {
        cardVisible: card && window.getComputedStyle(card).display !== 'none',
        actionsVisible: actions && window.getComputedStyle(actions).display !== 'none',
        actionsHTML: actions?.innerHTML?.substring(0, 300),
        actionButtons: Array.from(document.querySelectorAll('[data-sa]')).length,
        actionButtonsDetails: Array.from(document.querySelectorAll('[data-sa]')).slice(0, 3).map(btn => ({
          text: btn.textContent?.trim().substring(0, 30),
          classes: btn.className,
          clickable: btn.offsetParent !== null
        }))
      };
    });
    console.log(JSON.stringify(afterNav, null, 2));
    
    // Look for and interact with action button
    const actionBtns = await page.$$('[data-sa]');
    console.log(`\n>>> Found ${actionBtns.length} action buttons`);
    
    if (actionBtns.length > 0) {
      const firstBtn = actionBtns[0];
      const btnText = await firstBtn.textContent();
      console.log(`>>> Clicking first action: "${btnText?.substring(0, 30)}"`);
      
      await firstBtn.click();
      await page.waitForTimeout(3000);
      
      console.log('\n=== AFTER ACTION BUTTON CLICK ===');
      const afterClick = await page.evaluate(() => {
        const verdict = document.querySelector('#swipeVerdict');
        return {
          verdictHidden: verdict?.classList.contains('hidden'),
          verdictDisplay: window.getComputedStyle(verdict).display,
          verdictContent: verdict?.innerHTML?.substring(0, 500),
          hasCharacter: {
            psReaction: !!document.querySelector('.ps-character-reaction'),
            psMonster: !!document.querySelector('.ps-monster-reaction'),
            freakCoach: !!document.querySelector('.freakCoachReaction'),
            video: !!document.querySelector('video'),
            canvas: !!document.querySelector('canvas')
          },
          actionButtons: Array.from(document.querySelectorAll('[data-sa]')).map(btn => ({
            text: btn.textContent?.trim().substring(0, 30),
            selected: btn.classList.contains('selected'),
            grade: btn.className.match(/grade-[gyr]/)?.[0] || 'none'
          }))
        };
      });
      console.log(JSON.stringify(afterClick, null, 2));
    }
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
