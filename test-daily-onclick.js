#!/usr/bin/env node
import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    console.log('Server started\n');

    const browserType = playwright.chromium;
    browser = await browserType.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ?
        path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Check the #homeDaily button before and after clicking
    console.log('=== BEFORE CLICK ===');
    const beforeClick = await page.evaluate(() => {
      const btn = document.getElementById('homeDaily');
      return {
        exists: !!btn,
        hasOnclick: !!btn?.onclick,
        onclickType: typeof btn?.onclick,
        innerHTML: btn?.innerHTML?.substring(0, 100) || 'N/A',
        parentId: btn?.parentElement?.id || 'N/A'
      };
    });
    console.log(JSON.stringify(beforeClick, null, 2));

    // Now click using page.click (Playwright API)
    console.log('\n=== CLICKING WITH page.click ===');
    try {
      await page.click('#homeDaily');
      console.log('Click successful');
    } catch (e) {
      console.log('Click failed:', e.message);
    }

    await page.waitForTimeout(800);

    // Check screen state after click
    console.log('\n=== AFTER CLICK ===');
    const afterClick = await page.evaluate(() => {
      const daily = document.getElementById('daily');
      const home = document.getElementById('home');
      const dailyArea = document.getElementById('dailyArea');
      return {
        homeActive: home?.classList.contains('active'),
        dailyActive: daily?.classList.contains('active'),
        dailyAreaHtml: dailyArea?.innerHTML?.substring(0, 150) || 'EMPTY',
        dailyAreaHtmlLength: dailyArea?.innerHTML?.length || 0
      };
    });
    console.log(JSON.stringify(afterClick, null, 2));

    // Try calling show('daily') directly
    console.log('\n=== CALLING show(\'daily\') DIRECTLY ===');
    await page.evaluate(() => {
      window.show('daily');
    });
    await page.waitForTimeout(800);

    const afterDirect = await page.evaluate(() => {
      const daily = document.getElementById('daily');
      const dailyArea = document.getElementById('dailyArea');
      return {
        dailyActive: daily?.classList.contains('active'),
        dailyAreaHtml: dailyArea?.innerHTML?.substring(0, 150) || 'EMPTY',
        dailyAreaHtmlLength: dailyArea?.innerHTML?.length || 0
      };
    });
    console.log(JSON.stringify(afterDirect, null, 2));

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
