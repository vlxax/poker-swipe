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

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('=== SEARCHING FOR DAILY BUTTON ===\n');

    // Find all buttons with onclick handlers
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button'))
        .map(btn => ({
          text: btn.textContent.substring(0, 40),
          onclick: btn.onclick ? btn.onclick.toString().substring(0, 50) : null,
          id: btn.id,
          class: btn.className.substring(0, 30)
        }))
        .filter(b => b.onclick && b.onclick.includes('show'));
    });

    console.log('Buttons with show() handlers:');
    buttons.forEach((btn, i) => {
      console.log(`\n[${i}] ${btn.text}`);
      console.log(`    onclick: ${btn.onclick}`);
      console.log(`    id: ${btn.id}`);
      console.log(`    class: ${btn.class}`);
    });

    // Find the one that calls show('daily')
    const dailyButton = buttons.find(b => b.onclick.includes("'daily'") || b.onclick.includes('"daily"'));

    if (dailyButton) {
      console.log(`\n✓ Found Daily button: "${dailyButton.text}"`);
    } else {
      console.log('\n✗ No button found with show("daily")');
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
