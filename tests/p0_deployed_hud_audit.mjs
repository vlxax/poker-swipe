#!/usr/bin/env node
/** P0 deployed HUD audit — 30 trainer-backed swipe tasks */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPLOYED = 'https://vlxax.github.io/poker-swipe/index.html';
const OUT = '/opt/cursor/artifacts';
const COUNT = Number(process.env.HUD_AUDIT_COUNT || 30);

function startServer(port = 8098) {
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

async function capture(page) {
  return page.evaluate(() => {
    const s = window.swSession?.[window.swIndex];
    if (!s) return null;
    const sessionCanon = s._canonical || null;
    const built = window.TaskContextCanonical?.buildCanonicalSpot?.({ ...s, _legacy: !s._library });
    const enriched = window.MaCompact?.getCtx30
      ? (() => {
          const spot = { ...s };
          if (!spot._canonical && built) spot._canonical = built;
          return spot;
        })()
      : s;
    const ctx = window.MaCompact?.getCtx30?.('swipe', enriched) || {};
    const stats = {};
    document.querySelectorAll('#swipeCard .pgStat').forEach((el) => {
      const label = el.querySelector('span')?.textContent?.trim();
      const val = el.querySelector('b')?.textContent?.trim();
      if (label && val) stats[label] = val;
    });
    const topLine = document.querySelector('#swipeCard .swipeTop')?.textContent || '';
    return {
      taskId: s.id,
      trainerBacked: Boolean(s.trainerMeta?.chartId || String(s.id || '').startsWith('TRAINER_')),
      session: {
        position: s.position,
        villain: s.villain,
        heroPosition: s.heroPosition,
        villainPosition: s.villainPosition,
        pos: s.pos,
        stack: s.stack,
        hasCanonical: Boolean(s._canonical)
      },
      canonical: {
        hero: sessionCanon?.position || built?.position,
        vill: sessionCanon?.villain || built?.villain,
        stack: sessionCanon?.heroStack ?? built?.heroStack
      },
      getCtx30: {
        hero: ctx.heroPos,
        vill: ctx.villainPos,
        stack: ctx.eff ? parseFloat(String(ctx.eff).replace(/[^\d.]/g, '')) : null
      },
      hud: {
        hero: stats.ТЫ || ctx.heroPos,
        vill: (stats.VILL || ctx.villainPos || '').split('·')[0].trim(),
        stack: stats['ЭФФ.'] ? parseFloat(String(stats['ЭФФ.']).replace(/[^\d.]/g, '')) : (ctx.eff ? parseFloat(String(ctx.eff).replace(/[^\d.]/g, '')) : null)
      },
      topLine,
      pgStatCount: Object.keys(stats).length
    };
  });
}

function issues(row) {
  const out = { position: [], stack: [], history: [] };
  if (!row || !row.trainerBacked) return out;
  if (row.canonical.hero && row.hud.hero && row.canonical.hero !== row.hud.hero) {
    out.position.push(`hero ${row.canonical.hero}!=${row.hud.hero}`);
  }
  if (row.canonical.vill && row.hud.vill && row.canonical.vill !== row.hud.vill) {
    out.position.push(`villain ${row.canonical.villain}!=${row.hud.vill}`);
  }
  if (row.canonical.stack != null && row.hud.stack != null && Math.abs(row.canonical.stack - row.hud.stack) > 0.5) {
    out.stack.push(`stack ${row.canonical.stack}!=${row.hud.stack}`);
  }
  return out;
}

async function audit(baseUrl, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    localStorage.setItem('pokerswipe_v32', JSON.stringify({
      version: '32.0', nick: 'HUDAUDIT', onboarded: true, diagDone: true, skill: 55, streak: 1,
      events: [], hands: [], seenSwipe: [], diagnostic: [],
      diagnosticProfile25: { overall: 55 },
      xray: { onboarded: true, runs: 0, history: [], counts: {} }, healCourses: {}
    }));
    location.reload();
  });
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    if (typeof window.show === 'function') window.show('swipe');
    if (typeof window.newSwipeSession === 'function') window.newSwipeSession();
    if (typeof window.renderSwipe === 'function') window.renderSwipe();
  });
  await page.waitForTimeout(2000);

  const rows = [];
  let pos = 0, stack = 0, hist = 0;
  let trainerCount = 0;

  for (let i = 0; i < COUNT; i++) {
    await page.waitForSelector('#swipeActions [data-sa]', { timeout: 10000 }).catch(() => {});
    const row = await capture(page);
    if (row?.trainerBacked) trainerCount++;
    const iss = issues(row);
    if (iss.position.length) pos++;
    if (iss.stack.length) stack++;
    rows.push({ i, ...row, issues: iss });

    await page.evaluate(() => {
      window.swIndex = Math.min((window.swIndex || 0) + 1, (window.swSession?.length || 1));
      if (window.swIndex < (window.swSession?.length || 0)) {
        window.renderSwipe?.();
      } else {
        window.newSwipeSession?.();
        window.renderSwipe?.();
      }
    });
    await page.waitForTimeout(450);
  }

  const meta = await page.evaluate(() => ({
    commit: document.querySelector('meta[name="poker-swipe-build"]')?.content || null,
    hasMaCompact: Boolean(window.MaCompact?.getCtx30),
    hasTaskContext: Boolean(window.TaskContextCanonical?.buildCanonicalSpot),
    miniAppSrc: document.querySelector('script[data-mini-app-compact]')?.src || null
  }));

  await browser.close();

  const mismatches = rows.filter((r) => r.issues?.position?.length || r.issues?.stack?.length);
  return {
    label,
    meta,
    trainerCount,
    HUD_POSITION_MISMATCH: pos,
    HUD_STACK_MISMATCH: stack,
    HUD_HISTORY_MISMATCH: hist,
    mismatches,
    rows,
    consoleErrors: [...new Set(consoleErrors)].filter((e) => !/favicon|404|Failed to load resource/i.test(e))
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer(8098);
  const local = await audit('http://localhost:8098/index.html', 'local');
  server.close();
  const deployed = await audit(DEPLOYED, 'deployed');

  const report = { local, deployed };
  const outPath = path.join(OUT, 'p0_deployed_hud_audit.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    LOCAL: {
      pos: local.HUD_POSITION_MISMATCH,
      stack: local.HUD_STACK_MISMATCH,
      trainer: local.trainerCount,
      mismatches: local.mismatches.map((m) => ({ id: m.taskId, issues: m.issues, hud: m.hud, canon: m.canonical, getCtx30: m.getCtx30, session: m.session }))
    },
    DEPLOYED: {
      pos: deployed.HUD_POSITION_MISMATCH,
      stack: deployed.HUD_STACK_MISMATCH,
      trainer: deployed.trainerCount,
      meta: deployed.meta,
      mismatches: deployed.mismatches.map((m) => ({ id: m.taskId, issues: m.issues, hud: m.hud, canon: m.canonical, getCtx30: m.getCtx30, session: m.session }))
    }
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
