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

    page.on('console', msg => {
      if (msg.text().includes('[TRACE]') || msg.text().includes('renderDaily')) {
        console.log(`[LOG] ${msg.text()}`);
      }
    });

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('=== DIRECT show("daily") CALL ===\n');

    // Instrument renderDaily
    await page.evaluate(() => {
      const originalRenderDaily = window.renderDaily;
      if (originalRenderDaily && typeof originalRenderDaily === 'function') {
        window.renderDaily = function() {
          console.log('[TRACE] renderDaily() called');
          const result = originalRenderDaily.apply(this, arguments);
          console.log('[TRACE] renderDaily() done, #dailyArea length:',
                     document.getElementById('dailyArea')?.innerHTML?.length || 0);
          return result;
        };
        console.log('[TRACE] renderDaily instrumented');
      }
    });

    console.log('Calling show("daily")...');
    await page.evaluate(() => window.show('daily'));
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      dailyActive: document.getElementById('daily')?.classList.contains('active'),
      homeActive: document.getElementById('home')?.classList.contains('active'),
      dailyAreaLength: document.getElementById('dailyArea')?.innerHTML?.length || 0,
      dailyAreaContent: document.getElementById('dailyArea')?.innerHTML?.substring(0, 50) || 'EMPTY'
    }));

    console.log('\nAfter show("daily"):');
    console.log('  Daily active:', state.dailyActive);
    console.log('  Home active:', state.homeActive);
    console.log('  #dailyArea length:', state.dailyAreaLength);
    console.log('  #dailyArea content (first 50 chars):', state.dailyAreaContent);

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
