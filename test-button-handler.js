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

    page.on('console', msg => console.log(`[LOG] ${msg.text()}`));

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('=== INSTRUMENTING BUTTON CLICK ===\n');

    // Instrument show() to track calls
    await page.evaluate(() => {
      const originalShow = window.show;
      let showCallCount = 0;

      window.show = function(id) {
        showCallCount++;
        console.log(`[TRACE] show('${id}') called [call #${showCallCount}]`);
        return originalShow.apply(this, arguments);
      };

      console.log('[TRACE] window.show instrumented');
    });

    // Find the Daily button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dailyTile = buttons.find(el =>
        el.textContent.includes('РАЗБОР') ||
        el.textContent.includes('ОДНА РУКА')
      );

      if (dailyTile) {
        console.log(`[TRACE] Found Daily button at`, dailyTile);
        console.log(`[TRACE] onclick handler:`, dailyTile.onclick);
        console.log(`[TRACE] Button attributes:`, {
          id: dailyTile.id,
          class: dailyTile.className,
          'data-*': Array.from(dailyTile.attributes)
            .filter(a => a.name.startsWith('data-'))
            .map(a => `${a.name}="${a.value}"`)
        });
      }
    });

    // Click the button
    console.log('\nClicking Daily button...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dailyTile = buttons.find(el =>
        el.textContent.includes('РАЗБОР') ||
        el.textContent.includes('ОДНА РУКА')
      );
      if (dailyTile) dailyTile.click();
    });

    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      dailyActive: document.getElementById('daily')?.classList.contains('active'),
      dailyAreaLength: document.getElementById('dailyArea')?.innerHTML?.length || 0
    }));

    console.log('\nAfter click:');
    console.log('  Daily active:', state.dailyActive);
    console.log('  #dailyArea length:', state.dailyAreaLength);

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
