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

    page.on('console', msg => console.log(`[PAGE LOG] ${msg.text()}`));

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('\n=== TESTING IF WRAPPER IS CALLED ===\n');

    const wrappedStatus = await page.evaluate(() => {
      // Check if wrapper is active by checking if show function has our code
      const showCode = window.show.toString();
      const hasWrapper = showCode.includes('lastShowId') || showCode.includes('MutationObserver');

      console.log(`[CHECK] show.toString() length: ${showCode.length}`);
      console.log(`[CHECK] Has wrapper code: ${hasWrapper}`);
      console.log(`[CHECK] First 100 chars: ${showCode.substring(0, 100)}`);

      return {
        hasWrapper,
        codeLength: showCode.length
      };
    });

    console.log('\nWrapper status:', wrappedStatus);

    console.log('\nCalling show("daily")...');
    await page.evaluate(() => window.show('daily'));

    await page.waitForTimeout(100);

    const state = await page.evaluate(() => ({
      dailyActive: document.getElementById('daily')?.classList.contains('active'),
      homeActive: document.getElementById('home')?.classList.contains('active')
    }));

    console.log('After show("daily"):', state);

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
