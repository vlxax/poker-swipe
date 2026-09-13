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

    // Add MutationObserver to watch for class changes on daily
    await page.evaluate(() => {
      const daily = document.getElementById('daily');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            console.log(`[MUTATION] daily.class changed to: ${daily.className}`);
          }
        });
      });

      observer.observe(daily, { attributes: true, attributeFilter: ['class'] });
      window.dailyMutationObserver = observer;
      console.log('[READY] MutationObserver attached to daily');
    });

    // Call show('daily')
    console.log('\n=== CALLING window.show("daily") ===\n');
    await page.evaluate(() => {
      window.show('daily');
    });

    await page.waitForTimeout(500);

    // Check the daily element's classList
    const classList = await page.evaluate(() => {
      return {
        classList: Array.from(document.getElementById('daily').classList),
        classListString: document.getElementById('daily').className,
        hasActive: document.getElementById('daily').classList.contains('active')
      };
    });

    console.log('\n=== DAILY ELEMENT CLASS ===');
    console.log(JSON.stringify(classList, null, 2));

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
