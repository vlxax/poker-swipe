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

    // Hook MutationObserver for both daily and swipe
    await page.evaluate(() => {
      ['daily', 'swipe'].forEach(screenId => {
        const el = document.getElementById(screenId);
        const observer = new MutationObserver(() => {
          console.log(`[MUT] ${screenId}.class = ${el.className}`);
        });
        observer.observe(el, { attributes: true, attributeFilter: ['class'] });
        window[`${screenId}Observer`] = observer;
      });
      console.log('[SETUP] Observers ready');
    });

    // Test show('swipe')
    console.log('\n=== CALLING window.show("swipe") ===');
    await page.evaluate(() => { window.show('swipe'); });
    await page.waitForTimeout(500);

    let state = await page.evaluate(() => ({
      swipeClass: document.getElementById('swipe').className,
      homeClass: document.getElementById('home').className
    }));
    console.log('After show("swipe"):', state);

    // Reset to home
    console.log('\n=== CALLING window.show("home") ===');
    await page.evaluate(() => { window.show('home'); });
    await page.waitForTimeout(500);

    // Test show('daily')
    console.log('\n=== CALLING window.show("daily") ===');
    await page.evaluate(() => { window.show('daily'); });
    await page.waitForTimeout(500);

    state = await page.evaluate(() => ({
      dailyClass: document.getElementById('daily').className,
      homeClass: document.getElementById('home').className
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
