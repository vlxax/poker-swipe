#!/usr/bin/env node
import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = '/home/user/poker-swipe';
const PORT = 9877;

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
        '.json': 'application/json',
      };

      if (fs.existsSync(filePath)) {
        res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, 'localhost', () => {
      console.log(`✓ Server started on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

(async () => {
  const server = await startServer();
  
  const browser = await playwright.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
  });

  const page = await browser.newPage();

  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    const msg = err.message || String(err);
    errors.push({message: msg});
    console.log(`[PAGE ERROR] ${msg}`);
  });

  try {
    console.log('\n=== DETAILED BOOT DIAGNOSIS ===\n');
    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(2000);

    const state = await page.evaluate(() => {
      return {
        S: typeof window.S,
        show: typeof window.show,
        renderSizing: typeof window.renderSizing,
        rankIndex28: typeof window.rankIndex28,
        PokerSwipeCore: !!window.PokerSwipeCore,
        __pokerBooted: !!window.__pokerBooted,
      };
    });

    console.log('\n=== WINDOW STATE ===');
    Object.entries(state).forEach(([k, v]) => {
      console.log(`${k}: ${v}`);
    });

  } catch (error) {
    console.error(`\n✗ DIAGNOSIS FAILED: ${error.message}`);
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
})();
