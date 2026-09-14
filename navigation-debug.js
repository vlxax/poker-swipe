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

async function testNavigation() {
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

    console.log('Loading page...');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Check if show() function exists
    const showExists = await page.evaluate(() => {
      return typeof window.show === 'function';
    });
    console.log(`show() function exists: ${showExists}\n`);

    // Check screen states before navigation
    console.log('=== INITIAL STATE ===');
    let screens = await page.evaluate(() => {
      const allScreens = document.querySelectorAll('.screen');
      return Array.from(allScreens).map(s => ({
        id: s.id,
        hasActive: s.classList.contains('active'),
        htmlLength: s.innerHTML.trim().length
      }));
    });
    screens.forEach(s => {
      console.log(`  ${s.id}: active=${s.hasActive}, content=${s.htmlLength} chars`);
    });

    // Test navigation by directly calling show()
    console.log('\n=== TEST 1: Direct show("swipe") call ===');
    const callShowResult = await page.evaluate(() => {
      try {
        window.show('swipe');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.toString() };
      }
    });
    console.log(`Call result: ${JSON.stringify(callShowResult)}`);

    // Check screen states after show('swipe')
    await page.waitForTimeout(500);
    screens = await page.evaluate(() => {
      const allScreens = document.querySelectorAll('.screen');
      return Array.from(allScreens).map(s => ({
        id: s.id,
        hasActive: s.classList.contains('active'),
        htmlLength: s.innerHTML.trim().length
      }));
    });
    console.log('After show("swipe"):');
    screens.forEach(s => {
      if (s.id === 'swipe' || s.id === 'home') {
        console.log(`  ${s.id}: active=${s.hasActive}, content=${s.htmlLength} chars`);
      }
    });

    // Check if swipeCard got content
    const swipeContent = await page.evaluate(() => {
      const card = document.getElementById('swipeCard');
      return {
        exists: !!card,
        parentId: card?.parentElement?.id,
        htmlLength: card?.innerHTML.trim().length || 0,
        preview: card?.innerHTML.substring(0, 100) || 'EMPTY'
      };
    });
    console.log(`swipeCard content: ${JSON.stringify(swipeContent)}`);

    // Test navigation via button click
    console.log('\n=== TEST 2: Click [data-nav="daily"] button ===');
    const dailyButton = await page.evaluate(() => {
      const btn = document.querySelector('[data-nav="daily"]');
      return {
        exists: !!btn,
        onclick: btn?.onclick ? 'HAS_ONCLICK' : 'NO_ONCLICK',
        textContent: btn?.textContent || 'N/A'
      };
    });
    console.log(`Button state: ${JSON.stringify(dailyButton)}`);

    if (dailyButton.exists) {
      await page.click('[data-nav="daily"]');
      await page.waitForTimeout(500);

      const dailyScreen = await page.evaluate(() => {
        const daily = document.getElementById('daily');
        const dailyArea = document.getElementById('dailyArea');
        return {
          dailyActive: daily?.classList.contains('active'),
          dailyAreaHtml: dailyArea?.innerHTML.trim().length || 0,
          dailyAreaPreview: dailyArea?.innerHTML.substring(0, 100) || 'EMPTY'
        };
      });
      console.log(`Daily screen state: ${JSON.stringify(dailyScreen)}`);
    }

    // List all data-nav buttons
    console.log('\n=== NAVIGATION BUTTONS ===');
    const navButtons = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-nav]');
      return Array.from(btns).map(b => ({
        dataNav: b.dataset.nav,
        text: b.textContent.substring(0, 20),
        hasOnclick: !!b.onclick
      }));
    });
    navButtons.forEach(b => {
      console.log(`  [data-nav="${b.dataNav}"]: "${b.text}" onclick=${b.hasOnclick}`);
    });

    // Check if show is wired to buttons
    console.log('\n=== CHECKING SHOW() WIRING ===');
    const showWired = await page.evaluate(() => {
      const btn = document.querySelector('[data-nav="swipe"]');
      if (!btn) return 'NO_BUTTON';

      // Try to check if onclick is a function
      return typeof btn.onclick === 'function' ? 'WIRED' : 'NOT_WIRED';
    });
    console.log(`show() wired to buttons: ${showWired}`);

    // Try to trigger show manually for each screen
    console.log('\n=== MANUAL SHOW() TEST ===');
    const screenIds = ['swipe', 'daily', 'myhands', 'polyana', 'profile'];
    for (const screenId of screenIds) {
      const result = await page.evaluate((id) => {
        window.show(id);
        const screen = document.getElementById(id);
        return {
          screenExists: !!screen,
          isNowActive: screen?.classList.contains('active'),
          hasContent: (screen?.innerHTML.trim().length || 0) > 50
        };
      }, screenId);
      console.log(`show('${screenId}'): ${JSON.stringify(result)}`);
    }

    await context.close();
    await browser.close();
    server.close();

    console.log('\n' + '='.repeat(80));
    console.log('NAVIGATION DEBUG COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
}

await testNavigation();
