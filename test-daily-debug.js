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

async function testDaily() {
  let server;
  let browser;

  try {
    server = await startServer();
    console.log('✓ Server started\n');

    const browserType = playwright.chromium;
    browser = await browserType.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ?
        path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture all console messages
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    console.log('Loading page...');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Check initial state
    console.log('\n=== INITIAL STATE ===');
    const initialState = await page.evaluate(() => {
      return {
        showExists: typeof window.show === 'function',
        renderDailyExists: typeof window.renderDaily === 'function',
        dailyScreenExists: !!document.getElementById('daily'),
        dailyAreaExists: !!document.getElementById('dailyArea'),
        dailyAreaInitialHtml: document.getElementById('dailyArea')?.innerHTML || 'N/A'
      };
    });
    console.log(JSON.stringify(initialState, null, 2));

    // Try clicking Daily tile
    console.log('\n=== CLICKING DAILY TILE ===');
    await page.waitForTimeout(300);
    const tileClickResult = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const dailyButton = Array.from(buttons).find(b => b.textContent.includes('Daily') || b.textContent.includes('РАЗБОР'));
      if (!dailyButton) {
        return { tileFound: false, reason: 'No Daily tile found' };
      }
      console.log('[DEBUG] Found Daily tile:', dailyButton.textContent.substring(0, 50));
      dailyButton.click();
      return { tileFound: true, tileText: dailyButton.textContent.substring(0, 50) };
    });
    console.log('Tile click result:', JSON.stringify(tileClickResult));

    // Wait and check what happened
    await page.waitForTimeout(1000);

    console.log('\n=== AFTER CLICKING DAILY ===');
    const afterClick = await page.evaluate(() => {
      const dailyScreen = document.getElementById('daily');
      const dailyArea = document.getElementById('dailyArea');
      return {
        dailyScreenActive: dailyScreen?.classList.contains('active'),
        dailyAreaVisible: !!dailyArea && dailyArea.offsetParent !== null,
        dailyAreaHtml: dailyArea?.innerHTML || 'EMPTY',
        dailyAreaHtmlLength: dailyArea?.innerHTML?.length || 0,
        dailyAreaTextContent: dailyArea?.textContent?.substring(0, 200) || 'NO_TEXT',
        childElements: dailyArea?.children.length || 0,
        dailyAreaClasses: dailyArea?.className || 'N/A'
      };
    });
    console.log('\n' + JSON.stringify(afterClick, null, 2));

    // Try calling renderDaily directly
    console.log('\n=== CALLING renderDaily DIRECTLY ===');
    const directCall = await page.evaluate(() => {
      try {
        if (typeof window.renderDaily !== 'function') {
          return { error: 'renderDaily is not a function' };
        }
        window.renderDaily();
        return {
          success: true,
          dailyAreaHtml: document.getElementById('dailyArea')?.innerHTML?.substring(0, 200) || 'EMPTY'
        };
      } catch (e) {
        return { error: e.toString() };
      }
    });
    await page.waitForTimeout(300);
    console.log('Direct call result:', JSON.stringify(directCall));

    // Check for JavaScript errors
    console.log('\n=== CONSOLE OUTPUT ===');
    consoleLogs.forEach(log => {
      if (log.type === 'error') {
        console.log(`[ERROR] ${log.text}`);
      } else if (log.type === 'warning') {
        console.log(`[WARN] ${log.text}`);
      }
    });

    await context.close();
    await browser.close();
    server.close();

    console.log('\n✓ Test complete');

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
}

await testDaily();
