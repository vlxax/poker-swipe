#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import playwright from 'playwright';
const port = 9877;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const html = fs.readFileSync('/home/user/poker-swipe/index.html', 'utf-8');
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);
  } else {
    const file = path.join('/home/user/poker-swipe', req.url);
    if (fs.existsSync(file)) {
      const ext = path.extname(file);
      const mime = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'};
      res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
      res.end(fs.readFileSync(file));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(port, async () => {
  console.log(`Server started on http://localhost:${port}`);
  
  const browser = await playwright.chromium.launch({executablePath: '/opt/pw-browsers/chromium', headless: true});
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`[ERROR] ${err.message}`);
  });
  
  console.log('Loading page...');
  try {
    await page.goto(`http://localhost:${port}/`, {waitUntil: 'networkidle', timeout: 10000});
  } catch (e) {
    console.log('Load error:', e.message);
  }
  
  console.log('Page loaded. Checking state...');
  const state = await page.evaluate(() => ({
    S: typeof window.S !== 'undefined',
    PokerSwipeCore: typeof window.PokerSwipeCore !== 'undefined',
    show: typeof window.show !== 'undefined'
  }));
  
  console.log('State:', state);
  console.log('Errors caught:', errors.length);
  errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
});
