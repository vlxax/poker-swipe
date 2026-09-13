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

    console.log('=== TRACING DAILY TILE CLICK ===\n');

    // Instrument renderDaily to trace when it's called
    await page.evaluate(() => {
      const originalRenderDaily = window.renderDaily;
      if (originalRenderDaily && typeof originalRenderDaily === 'function') {
        window.renderDaily = function() {
          console.log('[TRACE] renderDaily() called');
          const result = originalRenderDaily.apply(this, arguments);
          console.log('[TRACE] renderDaily() completed, #dailyArea content length:',
                     document.getElementById('dailyArea')?.innerHTML?.length || 0);
          return result;
        };
        console.log('[TRACE] renderDaily instrumented');
      } else {
        console.log('[TRACE] renderDaily not found or not a function');
      }
    });

    // Find and click the Daily tile
    console.log('\nLooking for Daily tile...');
    const dailyTile = await page.$('button[data-action="daily"], [data-screen="daily"], #daily-tile, .tile-daily');

    if (!dailyTile) {
      console.log('Daily tile not found with standard selectors, trying innerHTML search...');
      const allButtons = await page.$$('button');
      for (const btn of allButtons) {
        const text = await btn.textContent();
        console.log(`Found button: "${text}"`);
        if (text && text.includes('Daily')) {
          console.log('Clicking Daily button...');
          await btn.click();
          break;
        }
      }
    } else {
      console.log('Clicking Daily tile...');
      await dailyTile.click();
    }

    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => ({
      dailyActive: document.getElementById('daily')?.classList.contains('active'),
      dailyAreaContent: document.getElementById('dailyArea')?.innerHTML?.substring(0, 100) || 'EMPTY',
      dailyAreaLength: document.getElementById('dailyArea')?.innerHTML?.length || 0
    }));

    console.log('\nAfter Daily tile click:');
    console.log('  Daily active:', state.dailyActive);
    console.log('  #dailyArea length:', state.dailyAreaLength);
    console.log('  #dailyArea content (first 100 chars):', state.dailyAreaContent);

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
