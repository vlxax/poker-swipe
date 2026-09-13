#!/usr/bin/env node
/** P1 Decision Quality Gate — 390×844 runtime swipe QA (15 tasks) */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/p1_runtime_swipe_qa';
fs.mkdirSync(OUT, { recursive: true });

function startServer(port = 8080) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url === '/' ? '/index.html' : req.url;
      const fp = path.join(ROOT, decodeURIComponent(url.split('?')[0]));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const ext = path.extname(fp);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(port, () => resolve(server));
  });
}

async function main() {
  const server = await startServer(8088);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = [];

  await page.goto('http://localhost:8088/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    localStorage.setItem('pokerswipe_v32', JSON.stringify({
      version: '32.0', nick: 'P1QA', onboarded: true, diagDone: true, skill: 55, streak: 1,
      events: [], hands: [], seenSwipe: [], diagnostic: [],
      diagnosticProfile25: { overall: 55 },
      xray: { onboarded: true, runs: 0, history: [], counts: {} }, healCourses: {}
    }));
    location.reload();
  });
  await page.waitForTimeout(3000);

  await page.evaluate(async () => {
    if (window.TrainingUIMain?.installMiniAppHooks) {
      const store = window.createTrainingStore?.() || { loadHistory: () => [], saveHistory: () => {} };
      window.TrainingUIMain.installMiniAppHooks(store);
    }
    if (typeof window.newSwipeSession === 'function') window.newSwipeSession();
  });
  await page.waitForTimeout(1500);

  for (let i = 0; i < 15; i++) {
    await page.waitForSelector('#swipeActions [data-sa]', { timeout: 8000 }).catch(() => {});
    const row = await page.evaluate(() => {
      const s = window.swSession?.[window.swIndex];
      if (!s) return null;
      const canon = s._canonical;
      const actions = [...document.querySelectorAll('#swipeActions [data-sa]')].map((b) => b.dataset.sa);
      const condition = document.querySelector('#swipeCard p')?.textContent?.trim() || s.ctx || '';
      const grading = s.trainerMeta?.gradingSource || (s._trainerGradePath === 'trainer_exact' ? 'TRAINER_EXACT' : s._library ? 'STATIC_CURATED' : 'HEURISTIC');
      return {
        taskId: s.id,
        visibleCondition: condition,
        legalOptions: actions,
        correctTrainerAction: canon?.correct || s.correct,
        gradingSource: grading,
        canonicalSpot: canon ? `hero=${canon.position}; vill=${canon.villain}; opts=[${(canon.options || actions).join(', ')}]` : null,
        optionCount: actions.length,
        heuristic: grading === 'HEURISTIC'
      };
    });

    if (row) {
      results.push(row);
      await page.screenshot({ path: path.join(OUT, `swipe_${String(i + 1).padStart(2, '0')}_${row.taskId}.png`) });
    }

    await page.evaluate(() => {
      if (typeof window.swipeNext === 'function') {
        window.swIndex = Math.min((window.swIndex || 0) + 1, (window.swSession?.length || 1));
        if (window.swIndex < (window.swSession?.length || 0)) window.renderSwipe?.();
        else window.newSwipeSession?.();
      }
    });
    await page.waitForTimeout(400);
  }

  const summary = {
    viewport: '390x844',
    tasksCaptured: results.length,
    heuristicCount: results.filter((r) => r.heuristic).length,
    oneOptionCount: results.filter((r) => r.optionCount < 2).length,
    allPass: results.length >= 15 && results.every((r) => r.optionCount >= 2 && !r.heuristic),
    results
  };

  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ out: OUT, ...summary, pass: summary.allPass ? 'PASS' : 'FAIL' }, null, 2));

  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
