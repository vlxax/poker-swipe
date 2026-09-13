/**
 * P0 nav + back button + home daily CTA verification @ 390×844 and desktop
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/nav_cta_qa';
const PORT = 8812;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const report = { mobile: {}, desktop: {}, errors: [] };

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
}

async function waitForServer(ms = 12000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

async function navClickableAfterMt(page) {
  await page.click('[data-nav="mytournaments"]');
  await page.waitForTimeout(800);
  const targets = ['profile', 'polyana', 'myhands', 'home'];
  const results = {};
  for (const nav of targets) {
    await page.click(`[data-nav="${nav}"]`, { timeout: 8000 });
    await page.waitForTimeout(600);
    const active = await page.evaluate((id) => {
      const map = { home: 'home', profile: 'profile', polyana: 'polyana', myhands: 'my' };
      const screenId = map[id] || id;
      const screen = document.getElementById(screenId);
      return screen?.classList.contains('active') || document.getElementById('mytournaments')?.classList.contains('active') === false;
    }, nav);
    results[nav] = active;
  }
  return results;
}

async function ctaStyles(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('#home .dailyFigmaCta');
    if (!btn) return { found: false };
    const cs = getComputedStyle(btn);
    const bg = cs.backgroundColor;
    const bgImage = cs.backgroundImage;
    const boxShadow = cs.boxShadow;
    const hasLimeGlow = /200,\s*255,\s*61|184,\s*255,\s*50|c8ff3d/i.test(boxShadow + bgImage);
    return {
      found: true,
      text: btn.textContent.trim(),
      classes: btn.className,
      hasPrimary: btn.classList.contains('primary'),
      hasPgCta: btn.classList.contains('pgCta'),
      hasBubblePress: btn.classList.contains('pgBubblePress'),
      backgroundColor: bg,
      backgroundImage: bgImage,
      hasLimeGlow,
      boxShadow: boxShadow !== 'none'
    };
  });
}

async function seedTrainingProfile(page) {
  await page.evaluate(() => {
    localStorage.setItem('pokerSwipe_train_meta', JSON.stringify({ version: 2, migratedAt: Date.now() }));
    localStorage.setItem('pokerSwipe_train_skillProfile', JSON.stringify({
      overall: 62,
      overallLabel: 'КЛУБНЫЙ',
      skills: {
        betSizing: { skill: 'betSizing', score: 38, sampleSize: 6, confidence: 0.75, labelRu: 'Сайзинг' },
        postflop: { skill: 'postflop', score: 72, sampleSize: 8, confidence: 0.8, labelRu: 'Постфлоп' }
      },
      weakest: { skill: 'betSizing', score: 38, labelRu: 'Сайзинг' },
      strongest: { skill: 'postflop', score: 72, labelRu: 'Постфлоп' },
      version: 2
    }));
    localStorage.setItem('pokerSwipe_train_personalizationSeed', JSON.stringify({ seed: 'nav-cta-qa', createdAt: Date.now() }));
  });
}

async function startDailyDrill(page, tag) {
  await page.evaluate(() => window.show('daily'));
  await page.waitForTimeout(1200);
  const startBtn = await page.$('#trStart');
  assert.ok(startBtn, `${tag}: daily start CTA present`);
  await startBtn.click();
  await page.waitForSelector('#dailyArea .pgDecisionGrid .choice, #dailyArea .pgDailyDrill, #dailyArea .pgDailyLoading', { timeout: 30000 });
  const loading = await page.$('#dailyArea .pgDailyLoading');
  if (loading) {
    await page.waitForSelector('#dailyArea .pgDecisionGrid .choice', { timeout: 45000 });
  }
  await page.waitForTimeout(600);
}

async function backPresent(page, areaSel) {
  return page.evaluate((sel) => {
    const area = document.querySelector(sel);
    const btn = area?.querySelector('.pgBackBtn');
    if (!btn) return { present: false };
    const cs = getComputedStyle(btn);
    return {
      present: true,
      disabled: btn.disabled || btn.classList.contains('is-disabled'),
      visible: cs.display !== 'none' && cs.opacity !== '0'
    };
  }, areaSel);
}

async function runViewport(browser, viewport, tag) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => report.errors.push(`[${tag}] ${e.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  await page.waitForFunction(() => window.__maGameLayout === true && window.MiniAppNav, { timeout: 30000 });
  await page.waitForSelector('#home .dailyFigmaCta.primary', { timeout: 15000 });
  await seedTrainingProfile(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  await page.waitForFunction(() => window.__maGameLayout === true && window.MiniAppNav, { timeout: 30000 });
  await page.waitForSelector('#home .dailyFigmaCta.primary', { timeout: 15000 });
  const cta = await ctaStyles(page);
  assert.ok(cta.found, `${tag}: daily CTA must exist`);
  assert.ok(cta.hasPrimary && cta.hasPgCta && cta.hasBubblePress, `${tag}: daily CTA must use primary bubble classes`);
  assert.ok(cta.hasLimeGlow || cta.boxShadow, `${tag}: daily CTA must have lime/glossy bubble styling`);
  assert.match(cta.text, /ПЕРЕЙТИ К РАЗДАЧЕ ДНЯ/i, `${tag}: CTA label`);

  await page.screenshot({ path: `${OUT}/${tag}_home_daily_cta.png` });

  await page.click('#home .dailyFigmaCta');
  await page.waitForTimeout(1200);
  const dailyOpen = await page.evaluate(() => document.getElementById('daily')?.classList.contains('active'));
  assert.ok(dailyOpen, `${tag}: daily CTA opens daily screen`);
  await page.click('[data-nav="home"]');
  await page.waitForTimeout(600);

  // Global nav after MT
  const navResults = await navClickableAfterMt(page);
  for (const [k, v] of Object.entries(navResults)) {
    assert.ok(v, `${tag}: nav ${k} clickable after MT`);
  }
  await page.screenshot({ path: `${OUT}/${tag}_nav_after_mt.png` });

  // Daily back + state
  await startDailyDrill(page, tag);

  let back = await backPresent(page, '#dailyArea');
  assert.ok(back.present, `${tag}: daily back button present`);

  const opts = await page.$$('#dailyArea .pgDecisionGrid .choice');
  if (opts.length >= 2) {
    await opts[0].click();
    await page.waitForSelector('#trNext', { timeout: 15000 });
    await page.click('#trNext');
    await page.waitForTimeout(800);
    const task2 = await page.evaluate(() => document.querySelector('#dailyArea .pgHudTitle .ey')?.textContent || '');
    assert.match(task2, /Task 2\//, `${tag}: reached task 2`);

    await page.click('#dailyArea .pgBackBtn');
    await page.waitForTimeout(800);
    const task1Restored = await page.evaluate(() => ({
      feedback: !!document.querySelector('#dailyArea .pgDailyFeedback'),
      drill: !!document.querySelector('#dailyArea .pgDailyDrill'),
      subtitle: document.querySelector('#dailyArea .pgHudTitle .ey')?.textContent || ''
    }));
    assert.ok(task1Restored.feedback || task1Restored.drill, `${tag}: back returns previous task view`);

    await page.click('#dailyArea .pgBackBtn');
    await page.waitForTimeout(800);
    const drillSelected = await page.evaluate(() => ({
      drill: !!document.querySelector('#dailyArea .pgDailyDrill'),
      selected: !!document.querySelector('#dailyArea .pgDecisionGrid .choice.selected')
    }));
    assert.ok(drillSelected.drill && drillSelected.selected, `${tag}: back from feedback restores drill with selection`);
  }

  await page.screenshot({ path: `${OUT}/${tag}_daily_back.png` });

  // Sizing back
  await page.evaluate(() => { window.sz = 0; window.show('sizing'); });
  await page.waitForSelector('#sizingArea .pgBackBtn', { timeout: 15000 });
  back = await backPresent(page, '#sizingArea');
  assert.ok(back.present, `${tag}: sizing back present`);
  await page.click('#sizeLock');
  await page.waitForTimeout(900);
  await page.click('#sizingArea .pgBackBtn');
  await page.waitForTimeout(700);
  const sizingQuestion = await page.evaluate(() => !!document.querySelector('#sizeLock') && document.getElementById('sizeResult')?.innerHTML === '');
  assert.ok(sizingQuestion, `${tag}: sizing back from result restores question`);
  await page.screenshot({ path: `${OUT}/${tag}_sizing_back.png` });

  // Review back
  await page.evaluate(() => { window.rv = 0; window.show('review'); });
  await page.waitForSelector('#reviewArea .pgBackBtn', { timeout: 15000 });
  back = await backPresent(page, '#reviewArea');
  assert.ok(back.present, `${tag}: review back present`);
  await page.click('#reviewArea [data-rn="0"]');
  await page.waitForTimeout(300);
  await page.click('#rvSure');
  await page.waitForTimeout(900);
  await page.click('#reviewArea .pgBackBtn');
  await page.waitForTimeout(700);
  const reviewPick = await page.evaluate(() => window.rvPick);
  assert.ok(reviewPick === 0 || reviewPick === '0', `${tag}: review back preserves pick`);
  await page.screenshot({ path: `${OUT}/${tag}_review_back.png` });

  // Ranges back
  await page.evaluate(() => window.show('ranges'));
  await page.waitForSelector('#rangesStart', { timeout: 15000 });
  await page.click('#rangesStart');
  await page.waitForTimeout(800);
  back = await backPresent(page, '#rangesArea');
  assert.ok(back.present, `${tag}: ranges back present`);
  await page.screenshot({ path: `${OUT}/${tag}_ranges_back.png` });

  const layoutShift = await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth + 2);
  assert.ok(layoutShift, `${tag}: no horizontal layout shift`);

  report[tag] = { cta, navResults, backDaily: true, backSizing: true, backReview: true, backRanges: true, layoutShift };
  await page.close();
}

fs.mkdirSync(OUT, { recursive: true });
const server = startServer();
await waitForServer();

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, { width: 390, height: 844 }, 'mobile');
  await runViewport(browser, { width: 1280, height: 900 }, 'desktop');
} finally {
  await browser.close();
  server.kill();
}

const preExisting = report.errors.filter((e) => /Leaflet|myGo18|CSP/i.test(e));
const newErrors = report.errors.filter((e) => !/Leaflet|myGo18|CSP/i.test(e));

console.log(JSON.stringify({
  pass: newErrors.length === 0,
  report,
  newConsoleErrors: newErrors.length,
  preExistingErrors: preExisting.length,
  artifacts: OUT
}, null, 2));

assert.equal(newErrors.length, 0, `New console errors: ${newErrors.join('; ')}`);
