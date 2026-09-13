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
      if (msg.text().includes('[TRACE]')) console.log(`[LOG] ${msg.text()}`);
    });

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('=== EXACT E2E TEST FLOW ===\n');

    // Instrument renderDaily
    await page.evaluate(() => {
      const originalRenderDaily = window.renderDaily;
      if (originalRenderDaily) {
        window.renderDaily = function() {
          console.log('[TRACE] renderDaily called');
          return originalRenderDaily.apply(this, arguments);
        };
      }
    });

    // Find and click the Daily tile exactly as E2E test does
    const clickedDaily = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dailyTile = buttons.find(el =>
        el.textContent.includes('РАЗБОР') ||
        el.textContent.includes('ОДНА РУКА') ||
        el.textContent.includes('РАЗМЕР') ||
        el.textContent.includes('10 РУК')
      );

      if (dailyTile) {
        console.log(`[TRACE] Found Daily tile with text: "${dailyTile.textContent.substring(0, 50)}"`);
        dailyTile.click();
        return true;
      }
      return false;
    });

    console.log('Clicked Daily tile:', clickedDaily);

    // Wait exactly 800ms as E2E test does
    await page.waitForTimeout(800);

    // Check content exactly as E2E test does
    const dailyLoaded = await page.evaluate(() => {
      const dailyArea = document.getElementById('dailyArea');
      const hasContent = dailyArea && dailyArea.innerHTML.trim().length > 100;
      console.log(`[TRACE] #dailyArea length: ${dailyArea?.innerHTML?.length || 0}, hasContent: ${hasContent}`);
      return hasContent;
    });

    console.log('\nResult: Daily loaded =', dailyLoaded);

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
