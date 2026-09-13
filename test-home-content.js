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

    // Check home content
    const homeContent = await page.evaluate(() => {
      const home = document.getElementById('home');
      return {
        exists: !!home,
        innerHTML: home?.innerHTML || 'N/A',
        htmlLength: home?.innerHTML?.length || 0,
        childCount: home?.children.length || 0,
        innerText: home?.textContent?.substring(0, 300) || 'N/A'
      };
    });

    console.log('Home screen content:');
    console.log('HTML length:', homeContent.htmlLength);
    console.log('Child count:', homeContent.childCount);
    console.log('\nFirst 500 chars of innerHTML:');
    console.log(homeContent.innerHTML.substring(0, 500));
    console.log('\nFirst 300 chars of innerText:');
    console.log(homeContent.innerText);

    // Check what classes the home element has
    const homeClasses = await page.evaluate(() => {
      const home = document.getElementById('home');
      return {
        className: home?.className || 'N/A',
        classes: home?.classList.toString() || 'N/A'
      };
    });
    console.log('\nHome classes:', homeClasses);

    // Check if renderHome is defined
    const renderStatus = await page.evaluate(() => {
      return {
        renderHomeExists: typeof window.renderHome === 'function',
        renderHomeLength: typeof window.renderHome === 'function' ? window.renderHome.toString().length : 0
      };
    });
    console.log('\nRenderHome status:', renderStatus);

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
