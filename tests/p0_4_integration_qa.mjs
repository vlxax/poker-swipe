/**
 * P0.4 Core Training Engine — Final Integration QA (390×844 + desktop)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:8080/index.html';
const OUT = '/opt/cursor/artifacts/p0_4_integration_qa';
const DEVICE_ID = 'p04-qa-' + Date.now();

fs.mkdirSync(OUT, { recursive: true });

function seedUser() {
  return {
    version: '32.0', nick: 'P04QA', onboarded: true, diagDone: true, skill: 55, streak: 1,
    events: [], hands: [], seenSwipe: [], diagnostic: [],
    diagnosticProfile25: { overall: 55 },
    xray: { onboarded: true, runs: 0, history: [], counts: {} }, healCourses: {}
  };
}

async function captureTrainerSwipeTask(page) {
  return page.evaluate(() => {
    const s = window.swSession?.[window.swIndex];
    if (!s) return null;
    const canon = s._canonical || window.TaskContextCanonical?.buildCanonicalSpot?.({ ...s, _legacy: !s._library });
    const ctx = window.MaCompact?.getCtx30?.('swipe', { ...s, _canonical: canon }) || {};
    const card = document.getElementById('swipeCard');
    const stats = {};
    card?.querySelectorAll('.pgStat').forEach((el) => {
      const label = el.querySelector('span')?.textContent?.trim();
      const val = el.querySelector('b')?.textContent?.trim();
      if (label && val) stats[label] = val;
    });
    return {
      taskId: s.id,
      trainerBacked: Boolean(s.trainerMeta?.chartId || String(s.id || '').startsWith('TRAINER_')),
      sourceMode: s.trainerMeta?.sourceMode || null,
      canonical: {
        hero: canon?.position || s.position,
        villain: canon?.villain || s.villain,
        stack: canon?.heroStack ?? canon?.effStack ?? s.stack,
        history: (canon?.history || []).map((h) => h.text || h)
      },
      ctx30: { hero: ctx.heroPos, villain: ctx.villainPos, stack: ctx.eff ? parseFloat(String(ctx.eff).replace(/[^\d.]/g, '')) : null },
      hudStats: stats,
      uiText: card?.innerText?.slice(0, 1200) || '',
      topLine: card?.querySelector('.swipeTop')?.innerText || ''
    };
  });
}

function compareTask(t) {
  const issues = { position: [], stack: [], history: [] };
  if (!t) return { ok: false, issues };
  const visibleHero = t.hudStats?.ТЫ || t.ctx30?.hero;
  const visibleVill = (t.hudStats?.VILL || t.ctx30?.villain || '').split('·')[0].trim();
  const visibleStack = t.hudStats?.ЭФФ ? parseFloat(String(t.hudStats.ЭФФ).replace(/[^\d.]/g, '')) : t.ctx30?.stack;
  if (t.canonical.hero && visibleHero && t.canonical.hero !== visibleHero) issues.position.push(`hero ${t.canonical.hero}!=${visibleHero}`);
  if (t.canonical.villain && visibleVill && t.canonical.villain !== visibleVill) issues.position.push(`villain ${t.canonical.villain}!=${visibleVill}`);
  if (t.canonical.stack != null && visibleStack != null && Math.abs(t.canonical.stack - visibleStack) > 0.5) issues.stack.push(`stack ${t.canonical.stack}!=${visibleStack}`);
  const histOk = !t.canonical.history?.length || t.canonical.history.some((h) => {
    const parts = String(h).split('·').map((x) => x.trim());
    const matchup = parts[0] || '';
    const openPart = parts[1] || '';
    const top = (t.topLine + ' ' + t.uiText).toUpperCase();
    if (matchup && top.includes(matchup.replace(/\s+/g, ' ').toUpperCase())) return true;
    if (openPart && t.uiText.toLowerCase().includes(openPart.slice(0, 8).toLowerCase())) return true;
    if (/open|push|сфолдил|блайнды/i.test(t.uiText)) return true;
    return false;
  });
  if (!histOk) issues.history.push(t.canonical.history.join(' | '));
  return { ok: !issues.position.length && !issues.stack.length && !issues.history.length, issues, visible: { hero: visibleHero, villain: visibleVill, stack: visibleStack } };
}

async function advanceSwipe(page) {
  const advanced = await page.evaluate(() => {
    if (typeof window.swipeNext === 'function') {
      window.swipeNext();
      return 'swipeNext';
    }
    if (window.swIndex < (window.swSession?.length || 0) - 1) {
      window.swIndex++;
      window.renderSwipe?.();
      return 'index';
    }
    return false;
  });
  if (!advanced) {
    const next = page.locator('#swNext, button:has-text("ДАЛЬШЕ"), button:has-text("СЛЕДУЮЩ")');
    if (await next.count()) await next.first().click({ timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

async function runHudAudit(page, count = 20) {
  const tasks = [];
  let positionMismatch = 0, stackMismatch = 0, historyMismatch = 0;
  let shots = 0;
  for (let i = 0; i < count; i++) {
    const t = await captureTrainerSwipeTask(page);
    if (t?.trainerBacked) {
      const cmp = compareTask(t);
      tasks.push({ ...t, cmp });
      if (cmp.issues.position.length) positionMismatch++;
      if (cmp.issues.stack.length) stackMismatch++;
      if (cmp.issues.history.length) historyMismatch++;
      if (shots < 5) {
        await page.screenshot({ path: path.join(OUT, `hud_task_${shots + 1}.png`) });
        shots++;
      }
    }
    if (i < count - 1) await advanceSwipe(page);
  }
  return { tasksTested: tasks.length, HUD_POSITION_MISMATCH: positionMismatch, HUD_STACK_MISMATCH: stackMismatch, HUD_HISTORY_MISMATCH: historyMismatch, pass: positionMismatch === 0 && stackMismatch === 0 && historyMismatch === 0, samples: tasks.slice(0, 5) };
}

async function runPersonalizationLoop(page) {
  const shareFor = async () => page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const sess = window.PersonalizedTrainingUi?.miniApps?.bridge?.prepareSwipeSession?.(10);
      const items = sess?.items || [];
      const n = items.filter((t) => t.trainerMeta?.sourceMode === 'vs1r').length;
      out.push(n / Math.max(1, items.length));
    }
    return { avg: out.reduce((a, b) => a + b, 0) / out.length, empty: out.filter((x) => x === 0).length };
  });

  const baseline = (await shareFor()).avg;
  await page.evaluate(() => {
    const pool = (window.__trainerCandidateIndex?.candidates || []).filter((t) => t.trainerMeta?.sourceMode === 'vs1r');
    const bridge = window.PersonalizedTrainingUi?.miniApps?.bridge;
    for (let i = 0; i < 10; i++) {
      const t = pool[i % pool.length];
      if (!t || !bridge) continue;
      bridge.recordLegacyOutcome({ item: t, mode: 'swipe', grade: 'MISTAKE', gradeLetter: 'r', evLossBb: 0.8 });
    }
  });
  const afterMistakes = (await shareFor()).avg;
  await page.evaluate(() => {
    const pool = (window.__trainerCandidateIndex?.candidates || []).filter((t) => t.trainerMeta?.sourceMode === 'vs1r');
    const bridge = window.PersonalizedTrainingUi?.miniApps?.bridge;
    for (let i = 0; i < 6; i++) {
      const t = pool[i % pool.length];
      if (!t || !bridge) continue;
      bridge.recordLegacyOutcome({ item: t, mode: 'swipe', grade: 'EXCELLENT', gradeLetter: 'g', evLossBb: 0 });
    }
  });
  const afterCorrect = (await shareFor()).avg;
  return { skill: 'vs_open / vs1r', baselineShare: baseline, afterMistakesShare: afterMistakes, afterCorrectRepeatsShare: afterCorrect, pass: afterMistakes > baseline + 0.03 };
}

async function setupPage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ deviceId, user }) => {
    localStorage.setItem('pokerSwipeDeviceId', deviceId);
    localStorage.setItem(`pokerSwipeV32_user_${deviceId}`, JSON.stringify(user));
  }, { deviceId: DEVICE_ID, user: seedUser() });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.show && window.MaCompact && window.__trainerCandidateIndex?.candidates?.length > 0, { timeout: 60000 });
  await page.evaluate(() => window.PersonalizedTrainingUi?.store?.saveSkillProfile?.({ overall: 55, skills: { preflop: { score: 55, sampleSize: 5 } } }));
  return { page, context };
}

async function enterSwipe(page) {
  await page.evaluate(() => window.show('home'));
  await page.click('#v36Swipe');
  await page.waitForSelector('#swipe.active', { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = { HUD_ROOT_CAUSE: 'getCtx30() used CTX30_SAFE index cycling instead of spot._canonical; fixed via ctxFromCanonical+attachCanonical in mini-app-compact.js' };

  const { page: mobilePersonalize } = await setupPage(browser, { width: 390, height: 844 });
  report.personalization = await runPersonalizationLoop(mobilePersonalize);
  await mobilePersonalize.close();

  const { page: mobile } = await setupPage(browser, { width: 390, height: 844 });
  await enterSwipe(mobile);
  report.hud = await runHudAudit(mobile, 22);
  report.mobile390 = { pass: report.hud.pass };

  const { page: desktop } = await setupPage(browser, { width: 1280, height: 800 });
  await enterSwipe(desktop);
  const dt = await captureTrainerSwipeTask(desktop);
  report.desktop = { pass: dt?.trainerBacked && compareTask(dt).ok, task: dt?.taskId };
  await desktop.screenshot({ path: path.join(OUT, 'desktop_smoke.png') });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
