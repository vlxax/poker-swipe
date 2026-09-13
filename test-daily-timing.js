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

    console.log('=== TIMING ANALYSIS OF show("daily") ===\n');

    // Instrument to track state changes at multiple time intervals
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const timeline = [];

        const trackState = (label, delay) => {
          setTimeout(() => {
            const daily = document.getElementById('daily');
            const home = document.getElementById('home');
            const dailyArea = document.getElementById('dailyArea');

            timeline.push({
              at: `${delay}ms`,
              dailyActive: daily ? daily.classList.contains('active') : null,
              homeActive: home ? home.classList.contains('active') : null,
              dailyAreaHtml: dailyArea?.innerHTML?.substring(0, 50) || 'EMPTY'
            });

            if (delay === 1000) {
              resolve(timeline);
            }
          }, delay);
        };

        // Track at multiple intervals
        console.log('[TIMING] Starting show("daily")...');
        window.show('daily');

        trackState('0ms (immediate)', 0);
        trackState('5ms', 5);
        trackState('10ms', 10);
        trackState('15ms', 15);
        trackState('20ms', 20);
        trackState('50ms', 50);
        trackState('100ms', 100);
        trackState('200ms', 200);
        trackState('500ms', 500);
        trackState('1000ms', 1000);
      });
    });

    console.log('\nTiming Analysis:');
    result.forEach(entry => {
      console.log(`\n${entry.at}:`);
      console.log(`  daily.active = ${entry.dailyActive}`);
      console.log(`  home.active = ${entry.homeActive}`);
      console.log(`  #dailyArea content = ${entry.dailyAreaHtml}`);
    });

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
