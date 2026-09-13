#!/usr/bin/env node
import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

    console.log('=== TRACING PATCH EXECUTION ===\n');

    // Instrument before show to see what function we're calling
    const result = await page.evaluate(() => {
      // Check what window.show is before we call it
      console.log(`[BEFORE CALL] typeof window.show: ${typeof window.show}`);
      console.log(`[BEFORE CALL] window.show.name: ${window.show?.name || 'unnamed'}`);
      console.log(`[BEFORE CALL] window.show.toString() length: ${window.show?.toString()?.length || 'N/A'}`);

      // Wrap to see if it's called
      let showCallCount = 0;
      const wrappedShow = window.show;
      window.show = function(...args) {
        showCallCount++;
        console.log(`[INTERCEPTED] show() call #${showCallCount} with args:`, args);
        return wrappedShow.apply(this, args);
      };

      console.log('\n[CALLING] window.show("daily")');
      window.show('daily');

      setTimeout(() => {
        console.log(`\n[AFTER CALL] showCallCount: ${showCallCount}`);
        console.log(`[AFTER CALL] daily.active: ${document.getElementById('daily')?.classList.contains('active')}`);
        console.log(`[AFTER CALL] home.active: ${document.getElementById('home')?.classList.contains('active')}`);
      }, 50);

      return { showCallCount };
    });

    await page.waitForTimeout(200);

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
