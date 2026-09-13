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
    await page.waitForTimeout(2000);

    // Check for all button IDs
    console.log('=== CHECKING BUTTON IDS ===');
    const buttons = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button[id]');
      return Array.from(allButtons).map(b => ({
        id: b.id,
        text: b.textContent.substring(0, 50)
      })).filter(b => b.id.includes('Daily') || b.id.includes('daily'));
    });
    console.log('Daily-related buttons:', JSON.stringify(buttons, null, 2));

    // Check for screen states
    console.log('\n=== SCREEN STATES ===');
    const screens = await page.evaluate(() => {
      return {
        homeExists: !!document.getElementById('home'),
        homeActive: document.getElementById('home')?.classList.contains('active'),
        dailyExists: !!document.getElementById('daily'),
        dailyActive: document.getElementById('daily')?.classList.contains('active'),
        mainAppHidden: document.getElementById('mainApp')?.classList.contains('hidden')
      };
    });
    console.log(JSON.stringify(screens, null, 2));

    // Check if v31Daily exists and click it
    console.log('\n=== CLICKING v31Daily ===');
    const dailyExists = await page.evaluate(() => !!document.getElementById('v31Daily'));
    console.log('v31Daily exists:', dailyExists);

    if (dailyExists) {
      await page.click('#v31Daily');
      await page.waitForTimeout(1000);

      const afterClick = await page.evaluate(() => {
        return {
          dailyActive: document.getElementById('daily')?.classList.contains('active'),
          dailyAreaHtml: document.getElementById('dailyArea')?.innerHTML?.substring(0, 200) || 'EMPTY',
          dailyAreaLength: document.getElementById('dailyArea')?.innerHTML?.length || 0
        };
      });
      console.log('\nAfter clicking v31Daily:');
      console.log(JSON.stringify(afterClick, null, 2));
    }

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
