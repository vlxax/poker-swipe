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

    // Instrument show() to log calls
    await page.evaluate(() => {
      const originalShow = window.show;
      let callCount = 0;

      window.show = function(id) {
        callCount++;
        console.log(`[SHOW CALL ${callCount}] Input: id='${id}'`);

        // Log screen states before
        const screens = Array.from(document.querySelectorAll('.screen')).map(s => ({
          id: s.id,
          active: s.classList.contains('active')
        }));
        console.log(`[SHOW CALL ${callCount}] Before - active screens:`, screens.filter(s => s.active).map(s => s.id).join(', '));

        // Call original
        const result = originalShow.apply(this, arguments);

        // Log screen states after
        const screensAfter = Array.from(document.querySelectorAll('.screen')).map(s => ({
          id: s.id,
          active: s.classList.contains('active')
        }));
        console.log(`[SHOW CALL ${callCount}] After - active screens:`, screensAfter.filter(s => s.active).map(s => s.id).join(', '));

        return result;
      };

      console.log('[READY] show() instrumented');
    });

    // Now call show('daily')
    console.log('\n=== CALLING window.show("daily") ===\n');
    await page.evaluate(() => {
      window.show('daily');
    });

    await page.waitForTimeout(300);

    // Check final state
    const finalState = await page.evaluate(() => {
      return {
        dailyActive: document.getElementById('daily')?.classList.contains('active'),
        homeActive: document.getElementById('home')?.classList.contains('active'),
        allActive: Array.from(document.querySelectorAll('.screen.active')).map(s => s.id)
      };
    });

    console.log('\n=== FINAL STATE ===');
    console.log(JSON.stringify(finalState, null, 2));

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
