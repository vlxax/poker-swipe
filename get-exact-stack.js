#!/usr/bin/env node
// Get exact stack traces for ALL ReferenceErrors during page boot

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

async function getExactStacks() {
  const browser = await playwright.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: {width: 390, height: 844},
    ignoreHTTPSErrors: true
  });

  const errors = [];
  const page = await context.newPage();

  // Capture page errors with full stack
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    errors.push(errorInfo);

    console.log('\n' + '='.repeat(80));
    console.log(`[PAGE ERROR #${errors.length}] ${error.name}: ${error.message}`);
    console.log('='.repeat(80));
    console.log(error.stack);
    console.log('='.repeat(80));
  });

  try {
    console.log('\n=== GETTING EXACT ERROR STACKS ===\n');
    console.log('Loading page...');

    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'domcontentloaded'});

    // Wait for all boot-related errors to occur
    await page.waitForTimeout(3000);

    // Check final state
    const state = await page.evaluate(() => {
      return {
        hasS: typeof window.S !== 'undefined',
        pokerCore: !!window.PokerSwipeCore,
        booted: !!window.__pokerBooted,
      };
    });

    console.log('\n\n=== SUMMARY ===');
    console.log(`Total errors captured: ${errors.length}`);
    console.log(`window.S defined: ${state.hasS}`);
    console.log(`PokerSwipeCore defined: ${state.pokerCore}`);
    console.log(`Boot completed: ${state.booted}`);

    if (errors.length === 0) {
      console.log('\n✓ NO ERRORS - Application booted successfully!');
    } else {
      console.log('\n✗ ERRORS DETECTED:');
      errors.forEach((err, idx) => {
        console.log(`\n${idx + 1}. ${err.name}: ${err.message}`);
        const lines = err.stack.split('\n');
        if (lines.length > 1) {
          console.log('   Location: ' + lines[1].trim());
        }
      });
    }

    process.exitCode = errors.length > 0 ? 1 : 0;

  } catch (error) {
    console.error(`\n✗ DIAGNOSIS FAILED: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Main
(async () => {
  try {
    const server = await startServer();
    await getExactStacks();
    process.exit(process.exitCode || 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
