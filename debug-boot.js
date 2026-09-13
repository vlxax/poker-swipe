import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = '/home/user/poker-swipe';
const PORT = 9877;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {'Content-Type': {'html': 'text/html', 'js': 'application/javascript', 'css': 'text/css'}[filePath.split('.').pop()] || 'text/html'});
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(PORT, 'localhost', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const browser = await playwright.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[ERROR] ${err.message}`);
  });

  try {
    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(1000);
    
    const hasRenderSizing = await page.evaluate(() => typeof window.renderSizing);
    console.log(`\n>>> window.renderSizing is: ${hasRenderSizing}`);
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
})();
