import { chromium } from 'playwright';
import fs from 'fs';

const VIEWPORTS = [
  { name: 'iPhone 12/13', width: 390, height: 844 },
  { name: 'iPhone X/11 Pro', width: 375, height: 812 },
  { name: 'iPhone 14', width: 393, height: 852 },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { name: 'iPhone SE', width: 320, height: 568 }
];

function checkIntersection(rect1, rect2) {
  if (!rect1 || !rect2) return null;
  
  const horizontalOverlap = rect1.left < rect2.right && rect1.right > rect2.left;
  const verticalOverlap = rect1.top < rect2.bottom && rect1.bottom > rect2.top;
  const collision = horizontalOverlap && verticalOverlap;
  
  return {
    collision,
    overlapWidth: collision ? Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left) : 0,
    overlapHeight: collision ? Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top) : 0,
    verticalGap: Math.max(0, Math.min(rect1.top, rect2.top) - Math.max(rect1.bottom, rect2.bottom))
  };
}

async function auditSIZING(page) {
  console.log(`    🔍 SIZING`);
  
  try {
    await page.evaluate(() => {
      if (typeof window.show === 'function') {
        window.show('sizing');
      }
    });
    
    await page.waitForTimeout(500);
    
    const elements = await page.evaluate(() => {
      const m = {};
      const selectors = {
        'sizeCards': '#sizeCards',
        'sizeRead': '#sizeRead',  
        'sizeRange': '#sizeRange',
        'sizeLock': '#sizeLock'
      };
      
      for (const [name, sel] of Object.entries(selectors)) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          m[name] = {top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height)};
        }
      }
      return m;
    });
    
    const nav = await page.evaluate(() => {
      const el = document.querySelector('.nav');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
    });
    
    const intersections = {};
    if (elements.sizeCards && elements.sizeRead) {
      intersections['cards_vs_sizeRead'] = checkIntersection(elements.sizeCards, elements.sizeRead);
    }
    if (elements.sizeCards && elements.sizeLock) {
      intersections['cards_vs_CTA'] = checkIntersection(elements.sizeCards, elements.sizeLock);
    }
    if (elements.sizeLock && nav) {
      intersections['CTA_vs_nav'] = checkIntersection(elements.sizeLock, nav);
    }
    
    console.log(`      ✅ Rendered`);
    return { status: 'success', elements, intersections, nav };
    
  } catch (e) {
    console.log(`      ❌ CRASH: ${e.message.substring(0, 60)}`);
    return { status: 'error', error: e.message };
  }
}

async function auditREVIEW(page) {
  console.log(`    🔍 REVIEW`);
  
  try {
    await page.evaluate(() => {
      if (typeof window.show === 'function') {
        window.show('review');
      }
    });
    
    await page.waitForTimeout(500);
    
    const elements = await page.evaluate(() => {
      const m = {};
      
      const timeline = document.getElementById('reviewTimeline');
      if (timeline) {
        const r = timeline.getBoundingClientRect();
        m['timeline'] = {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
      }
      
      const decisionBtn = document.getElementById('rvNone');
      if (decisionBtn) {
        const r = decisionBtn.getBoundingClientRect();
        m['decisionBtn'] = {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), text: decisionBtn.textContent.substring(0, 20)};
      }
      
      const actions = document.querySelector('.actions');
      if (actions) {
        const r = actions.getBoundingClientRect();
        m['actions'] = {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
      }
      
      return m;
    });
    
    const nav = await page.evaluate(() => {
      const el = document.querySelector('.nav');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
    });
    
    const intersections = {};
    if (elements.timeline && elements.decisionBtn) {
      intersections['timeline_vs_decision'] = checkIntersection(elements.timeline, elements.decisionBtn);
    }
    if (elements.decisionBtn && nav) {
      intersections['decision_vs_nav'] = checkIntersection(elements.decisionBtn, nav);
    }
    if (elements.actions && nav) {
      intersections['actions_vs_nav'] = checkIntersection(elements.actions, nav);
    }
    
    console.log(`      ✅ Rendered`);
    return { status: 'success', elements, intersections, nav };
    
  } catch (e) {
    console.log(`      ❌ Error: ${e.message.substring(0, 60)}`);
    return { status: 'error', error: e.message };
  }
}

async function auditDAILY(page) {
  console.log(`    🔍 DAILY`);
  
  try {
    await page.evaluate(() => {
      if (typeof window.show === 'function') {
        window.show('daily');
      }
    });
    
    await page.waitForTimeout(500);
    
    const elements = await page.evaluate(() => {
      const m = {};
      
      const selectors = {
        'history': '#dailyHistory',
        'table': '#dailyTable',
        'decision': '#dailyDecision',
        'startBtn': '#dailyStart'
      };
      
      for (const [name, sel] of Object.entries(selectors)) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          m[name] = {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
        }
      }
      
      return m;
    });
    
    const nav = await page.evaluate(() => {
      const el = document.querySelector('.nav');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
    });
    
    const intersections = {};
    if (elements.history && elements.table) {
      intersections['history_vs_table'] = checkIntersection(elements.history, elements.table);
    }
    if (elements.startBtn && nav) {
      intersections['startBtn_vs_nav'] = checkIntersection(elements.startBtn, nav);
    }
    
    console.log(`      ✅ Rendered`);
    return { status: 'success', elements, intersections, nav };
    
  } catch (e) {
    console.log(`      ❌ Error: ${e.message.substring(0, 60)}`);
    return { status: 'error', error: e.message };
  }
}

async function runAudit() {
  console.log('🚀 COMPREHENSIVE FORENSIC AUDIT (BASELINE)\n');
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });
  
  const results = {
    SIZING: [],
    REVIEW: [],
    DAILY: [],
    baseline: 'BEFORE renderSizing fix'
  };
  
  for (const viewport of VIEWPORTS) {
    console.log(`\n📱 ${viewport.name}`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1
    });
    
    const page = await context.newPage();
    
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => { errors.push(err.toString()); });
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    await page.evaluate(() => { if (typeof window.show === 'function') window.show('home'); });
    await page.waitForTimeout(500);
    
    results.SIZING.push(await auditSIZING(page));
    results.REVIEW.push(await auditREVIEW(page));
    results.DAILY.push(await auditDAILY(page));
    
    await context.close();
  }
  
  await browser.close();
  return results;
}

const results = await runAudit();
fs.writeFileSync('/tmp/claude-0/-home-user-poker-swipe/1f63b7bc-0693-5bf7-9188-d77e639a37f3/scratchpad/audit-baseline.json', JSON.stringify(results, null, 2));
console.log('\n✅ Baseline audit complete');
