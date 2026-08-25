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
    
    // Ensure SWIPE is visible
    const swipeNav = await page.$('[data-nav="swipe"]');
    if (swipeNav) {
      await swipeNav.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('\n=== BEFORE ACTION CLICK ===');
    const beforeDOM = await page.evaluate(() => {
      return {
        swipeFlash: !!document.querySelector('#swipeFlash'),
        allIds: Array.from(document.querySelectorAll('[id]')).map(el => el.id).slice(0, 20),
        verdictDivs: Array.from(document.querySelectorAll('[class*="verdict"], [class*="flash"]')).map(el => ({tag: el.tagName, id: el.id, class: el.className})).slice(0, 10)
      };
    });
    console.log(JSON.stringify(beforeDOM, null, 2));
    
    // Click first action
    const actions = await page.$$('[data-sa]');
    if (actions.length > 0) {
      console.log(`\nClicking action button (${actions.length} available)`);
      await actions[0].click();
      await page.waitForTimeout(2500);
    }
    
    console.log('\n=== AFTER ACTION CLICK ===');
    const afterDOM = await page.evaluate(() => {
      const allVerdicts = document.querySelectorAll('[class*="verdict"], [class*="flash"], [class*="grade"], [id*="verdict"], [id*="flash"]');
      const verdictElements = [];
      allVerdicts.forEach(el => {
        verdictElements.push({
          tag: el.tagName,
          id: el.id,
          class: el.className.substring(0, 100),
          text: el.textContent?.substring(0, 50) || ''
        });
      });
      
      return {
        swipeFlash: !!document.querySelector('#swipeFlash'),
        allVerdictElements: verdictElements.slice(0, 15),
        characterElements: {
          psReaction: !!document.querySelector('.ps-character-reaction'),
          psMonster: !!document.querySelector('.ps-monster-reaction'),
          freakCoach: !!document.querySelector('.freakCoachReaction'),
          video: !!document.querySelector('video'),
          canvas: !!document.querySelector('canvas')
        },
        actionButtons: Array.from(document.querySelectorAll('[data-sa]')).map(el => ({
          text: el.textContent?.substring(0, 30),
          class: el.className.substring(0, 50),
          grade: el.classList.contains('grade-g') ? 'g' : el.classList.contains('grade-y') ? 'y' : el.classList.contains('grade-r') ? 'r' : 'none',
          selected: el.classList.contains('selected')
        }))
      };
    });
    console.log(JSON.stringify(afterDOM, null, 2));
    
  } finally {
    await page.close();
    await browser.close();
  }
})();
