/**
 * Battleship picker QA — position/stack buttons, HJ/CO/UTG, 390×844.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://localhost:${PORT}/index.html`;
const OUT = process.env.PS_QA_OUT || path.join(process.cwd(), 'test-results/battleship_picker_qa');

fs.mkdirSync(OUT, { recursive: true });

function seedUser() {
  return {
    version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 50, streak: 1,
    lastDay: '2026-08-25', events: [], hands: [], myHands18: [], tournaments: [],
    dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
    xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
    healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
  };
}

const POSITIONS_TO_TEST = ['UTG', 'HJ', 'CO', 'BTN'];
const report = { positions: {}, stacks: {}, starts: {} };

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ user }) => {
    localStorage.setItem('pokerSwipeDeviceId', 'picker-qa');
    localStorage.setItem('pokerSwipeV32_user_picker-qa', JSON.stringify(user));
    localStorage.removeItem('pokerSwipe_rangeBattle_tutorial_v1');
  }, { user: seedUser() });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console:' + m.text());
  });
  function relevantErrors(list) {
    return list.filter((e) =>
      /ranges-ui|trainer-knowledge|range-learning|strategy-map|battleship|PokerSwipeRanges|trainer-shards|charts-index|b2-id-alias|Failed to resolve module specifier/i.test(e)
    );
  }

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.PokerSwipeRanges && document.getElementById('ranges'), undefined, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
      el.classList.add('hidden');
      el.style.pointerEvents = 'none';
    });
    document.getElementById('mainApp')?.classList.remove('hidden');
    window.show('ranges');
  });
  await page.waitForSelector('#rbOpenBattle', { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
      el.classList.add('hidden');
      el.style.pointerEvents = 'none';
    });
  });
  await page.locator('#rbOpenBattle').click({ force: true });
  await page.waitForTimeout(1200);

  for (const pos of POSITIONS_TO_TEST) {
    const chip = page.locator(`.rbPickChip[data-pos]`).filter({ hasText: new RegExp(`^${pos}$`) });
    await chip.first().click();
    await page.waitForTimeout(400);

    const preview = await page.evaluate(() => {
      const strong = document.querySelector('.rbPickerPreview strong')?.textContent || '';
      const activePos = document.querySelector('.rbPickChip[data-pos].active')?.textContent || '';
      const stacks = [...document.querySelectorAll('.rbPickChip[data-stack]')].map((b) => b.textContent?.trim());
      const startDisabled = document.querySelector('#rbStartCourse')?.disabled;
      const courseId = document.querySelector('#rbStartCourse')?.dataset?.course;
      return { strong, activePos, stacks, startDisabled, courseId };
    });

    report.positions[pos] = {
      preview: preview.strong,
      active: preview.activePos === pos,
      stackCount: preview.stacks.length,
      hasCourse: !!preview.courseId && !preview.startDisabled
    };

    if (preview.stacks.length === 0) {
      report.positions[pos].FAIL = 'no stacks';
      continue;
    }

    // Test 3 stacks
    const stacksToTry = preview.stacks.slice(0, 3);
    for (const stackLabel of stacksToTry) {
      const stackBtn = page.locator('.rbPickChip[data-stack]').filter({ hasText: stackLabel });
      await stackBtn.first().click();
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({
        preview: document.querySelector('.rbPickerPreview strong')?.textContent,
        courseId: document.querySelector('#rbStartCourse')?.dataset?.course,
        disabled: document.querySelector('#rbStartCourse')?.disabled
      }));
      const key = `${pos}:${stackLabel}`;
      report.stacks[key] = {
        preview: after.preview,
        hasCourse: !!after.courseId && !after.disabled
      };
    }
  }

  // Start HJ course and verify matrix loads
  await page.locator('.rbPickChip[data-pos]').filter({ hasText: /^HJ$/ }).first().click();
  await page.waitForTimeout(300);
  await page.locator('.rbPickChip[data-stack]').first().click();
  await page.waitForTimeout(300);
  const courseId = await page.evaluate(() => document.querySelector('#rbStartCourse')?.dataset?.course);
  await page.evaluate((id) => window.PokerSwipeRanges.selectBattleshipCourse(id), courseId);
  await page.waitForTimeout(2000);
  await page.click('#rbBeginMission');
  await page.waitForTimeout(600);

  const gameState = await page.evaluate(() => ({
    header: document.querySelector('.rbGameHud h2')?.textContent,
    cells: document.querySelectorAll('.rbCell').length,
    grenades: document.querySelector('.rbHudStat span')?.textContent
  }));
  report.starts.HJ = gameState;

  // Grenades test: 5 wrong taps should not end mission if grenades >= 5
  for (let i = 0; i < 5; i++) {
    const hand = await page.evaluate(() => {
      const c = document.querySelector('.rbCell.neutral:not([disabled])');
      return c?.dataset?.hand || null;
    });
    if (!hand) break;
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), hand);
    await page.waitForTimeout(150);
  }
  const after5 = await page.evaluate(() => ({
    failOverlay: !!document.querySelector('.rbStamp--fail'),
    successOverlay: !!document.querySelector('.rbStamp:not(.rbStamp--fail)'),
    grenades: document.querySelector('.rbHudStat span')?.textContent,
    playing: document.querySelectorAll('.rbCell.neutral:not([disabled])').length > 0
  }));
  report.after5Mistakes = after5;

  await page.screenshot({ path: path.join(OUT, 'picker_hj_game.png') });

  const summary = {
    POSITION_FAILURES: Object.entries(report.positions).filter(([, v]) => !v.active || !v.hasCourse || v.stackCount === 0).length,
    STACK_FAILURES: Object.values(report.stacks).filter((v) => !v.hasCourse).length,
    HEADER_HAS_BB: /ББ/.test(gameState.header || ''),
    GRENADES_7: /💣\s*7|7/.test(gameState.grenades || ''),
    CONTINUE_AFTER_5: !after5.failOverlay && (after5.playing || after5.grenades),
    MATRIX_LOADED: gameState.cells === 169,
    NEW_ERRORS: relevantErrors(errors).length,
    RAW_CONSOLE: errors.length,
    PASS: true
  };
  summary.PASS = summary.POSITION_FAILURES === 0
    && summary.STACK_FAILURES === 0
    && summary.MATRIX_LOADED
    && summary.CONTINUE_AFTER_5
    && summary.HEADER_HAS_BB
    && summary.NEW_ERRORS === 0;

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ report, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.PASS ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser.close();
}
