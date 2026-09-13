#!/usr/bin/env node
import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = '/home/user/poker-swipe';
const PORT = 9876;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = req.url.split('?')[0];
      let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      };

      if (fs.existsSync(filePath)) {
        res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => resolve(server));
  });
}

async function test() {
  let server;
  let browser;

  try {
    server = await startServer();

    const browserType = playwright.chromium;
    browser = await browserType.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ?
        path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Trace what happens in show('daily')
    console.log('=== TRACING show(\'daily\') ===\n');

    const result = await page.evaluate(() => {
      // Manually execute the show logic with tracing
      const id = 'daily';
      console.log(`[TRACE] Starting show('${id}')`);

      // Check if element exists
      const dailyEl = document.getElementById(id);
      console.log(`[TRACE] document.getElementById('${id}') exists: ${!!dailyEl}`);

      // Get all screens
      const screens = document.querySelectorAll('.screen');
      console.log(`[TRACE] Found ${screens.length} .screen elements`);

      // Log current state before toggle
      screens.forEach((s, i) => {
        console.log(`[TRACE] Before: screen[${i}] id='${s.id}' active=${s.classList.contains('active')}`);
      });

      // Perform the toggle operation
      console.log(`[TRACE] Executing: $$('.screen').forEach(x=>x.classList.toggle('active',x.id==='${id}'))`);

      screens.forEach((s) => {
        const shouldBeActive = s.id === id;
        const beforeActive = s.classList.contains('active');
        s.classList.toggle('active', shouldBeActive);
        const afterActive = s.classList.contains('active');
        console.log(`[TRACE] toggle on id='${s.id}': condition=${shouldBeActive}, before=${beforeActive}, after=${afterActive}`);
      });

      // Log state after toggle
      console.log(`\n[TRACE] After toggle:`);
      screens.forEach((s, i) => {
        console.log(`[TRACE] After: screen[${i}] id='${s.id}' active=${s.classList.contains('active')}`);
      });

      // Check CSS computed style
      const daily = document.getElementById('daily');
      const computed = daily ? window.getComputedStyle(daily) : null;
      console.log(`\n[TRACE] CSS computed display for daily: ${computed?.display}`);

      return {
        dailyActive: daily?.classList.contains('active'),
        dailyDisplay: computed?.display
      };
    });

    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));

    await context.close();
    await browser.close();
    server.close();

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
}

await test();
