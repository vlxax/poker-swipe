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

    // Check all screen elements
    const screens = await page.evaluate(() => {
      const allScreens = document.querySelectorAll('[id$=""], section, div[id]');
      const screenElements = document.querySelectorAll('.screen');
      return {
        screenCount: screenElements.length,
        screens: Array.from(screenElements).map(s => ({
          id: s.id,
          className: s.className,
          display: window.getComputedStyle(s).display,
          visibility: window.getComputedStyle(s).visibility,
          parentId: s.parentElement?.id,
          hasChildren: s.children.length > 0
        }))
      };
    });

    console.log('Screen elements found:', screens.screenCount);
    screens.screens.forEach(s => {
      console.log(`  ${s.id}: display=${s.display}, hasChildren=${s.hasChildren}, parent=${s.parentId}`);
    });

    // Check if daily specifically exists
    const dailyStatus = await page.evaluate(() => {
      const daily = document.getElementById('daily');
      const selector = document.querySelector('.screen[id="daily"]');
      return {
        byId: !!daily,
        bySelector: !!selector,
        hasScreenClass: daily?.classList.contains('screen'),
        isVisible: daily ? window.getComputedStyle(daily).display !== 'none' : false,
        innerHTML: daily?.innerHTML?.substring(0, 100) || 'N/A',
        parentId: daily?.parentElement?.id,
        parentClasses: daily?.parentElement?.className
      };
    });

    console.log('\nDaily screen status:');
    console.log(JSON.stringify(dailyStatus, null, 2));

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
