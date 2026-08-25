/**
 * CORE TRAINING ENGINE V1 — runtime QA for trainer-backed swipe (390×844).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:8080/index.html';
const OUT = '/opt/cursor/artifacts/core_training_runtime_qa';
const DEVICE_ID = 'core-trainer-' + Date.now();

fs.mkdirSync(OUT, { recursive: true });

function seedUser() {
  return {
    version: '32.0',
    nick: 'COREQA',
    onboarded: true,
    diagDone: true,
    skill: 55,
    streak: 1,
    events: [],
    hands: [],
    seenSwipe: [],
    diagnostic: [],
    diagnosticProfile25: { overall: 55 },
    xray: { onboarded: true, runs: 0, history: [], counts: {} },
    healCourses: {}
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ deviceId, user }) => {
    localStorage.setItem('pokerSwipeDeviceId', deviceId);
    localStorage.setItem(`pokerSwipeV32_user_${deviceId}`, JSON.stringify(user));
  }, { deviceId: DEVICE_ID, user: seedUser() });

  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.show && window.PokerBrain, { timeout: 90000 });

  const report = { tasks: [], pass: true };

  await page.waitForFunction(() => window.__trainerCandidateIndex?.candidates?.length > 0, { timeout: 30000 });

  await page.evaluate(() => {
    const ui = window.PersonalizedTrainingUi;
    if (ui?.store) {
      ui.store.saveSkillProfile({ overall: 55, skills: { preflop: { score: 55, sampleSize: 5 } } });
    }
  });

  await page.evaluate(() => window.show('home'));
  await page.waitForSelector('#v36Swipe', { timeout: 15000 });
  await page.click('#v36Swipe');
  await page.waitForSelector('#swipe.active', { timeout: 15000 });
  await page.waitForTimeout(800);

  for (let i = 0; i < 10; i++) {
    const spot = await page.evaluate(() => {
      const s = window.swSession?.[window.swIndex];
      const canon = s?._canonical || (window.TaskContextCanonical?.buildCanonicalSpot?.(s));
      return {
        taskId: s?.id,
        chartId: s?.trainerMeta?.chartId || null,
        sourceMode: s?.trainerMeta?.sourceMode || null,
        hand: s?.trainerMeta?.hand || null,
        position: s?.heroPosition || s?.pos,
        villain: s?.villainPosition || s?.villain,
        stack: s?.stack || s?.effStack,
        history: (canon?.history || []).map((h) => h.text),
        question: s?.question || document.getElementById('swipeCard')?.innerText?.slice(0, 120),
        options: s?.actions || s?.options,
        trainerMeta: s?.trainerMeta || null,
        uiText: document.getElementById('swipeCard')?.innerText?.slice(0, 500) || ''
      };
    });

    report.tasks.push(spot);
    await page.screenshot({ path: path.join(OUT, `trainer_swipe_${i + 1}.png`) });

    const actionBtn = page.locator('#swipeCard .choice, #swipeCard [data-swipe-action], #swipeCard button.primary').first();
    if (await actionBtn.count()) {
      await actionBtn.click();
      await page.waitForTimeout(600);
    }
    const next = page.locator('#swNext, button:has-text("ДАЛЬШЕ"), button:has-text("СЛЕДУЮЩ")');
    if (await next.count()) await next.first().click();
    await page.waitForTimeout(500);
  }

  const trainerBacked = report.tasks.filter((t) => t.chartId);
  report.trainerBackedCount = trainerBacked.length;
  report.pass = trainerBacked.length >= 5;

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, trainerBacked: trainerBacked.length, total: report.tasks.length }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
