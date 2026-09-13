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
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      };

      if (fs.existsSync(filePath)) {
        res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`✓ Server started on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runTest() {
  const browser = await playwright.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: {width: 390, height: 844},
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  page.on('pageerror', err => {
    errors.push(`Uncaught: ${err.message}`);
  });

  try {
    console.log('\nLoading index.html...');
    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      return {
        hasS: typeof window.S === 'object',
        SValue: window.S ? {
          version: window.S.version,
          skill: window.S.skill,
          nick: window.S.nick,
          events: window.S.events ? window.S.events.length : 'undefined',
          hands: window.S.hands ? window.S.hands.length : 'undefined'
        } : null,
        hasShow: typeof show === 'function',
        hasLoad: typeof load === 'function',
        hasSave: typeof save === 'function'
      };
    });

    console.log('\nState check:');
    console.log(JSON.stringify(state, null, 2));

    console.log('\nErrors during load:');
    if (errors.length === 0) {
      console.log('  (none)');
    } else {
      errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
      if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
    }

    process.exitCode = state.hasS ? 0 : 1;

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

(async () => {
  try {
    const server = await startServer();
    await runTest();
    process.exit(process.exitCode || 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
