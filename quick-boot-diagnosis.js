#!/usr/bin/env node
// Quick boot diagnosis - find exact ReferenceErrors during startup

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

async function runDiagnosis() {
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
  const warnings = [];
  const logs = [];
  let windowS = false;
  let show_defined = false;
  let pokerCore = false;

  const page = await context.newPage();

  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
      console.log(`[ERROR] ${text}`);
    } else if (msg.type() === 'warn') {
      warnings.push(text);
      console.log(`[WARN] ${text}`);
    } else {
      logs.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', err => {
    const msg = err.message || String(err);
    errors.push(`UNCAUGHT: ${msg}`);
    console.log(`[UNCAUGHT ERROR] ${msg}`);
  });

  try {
    console.log('\n=== BOOT DIAGNOSIS ===\n');
    console.log('Loading page...');

    await page.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'domcontentloaded'});

    // Wait a bit for boot to complete/fail
    await page.waitForTimeout(2000);

    // Check final state
    const state = await page.evaluate(() => {
      return {
        hasS: typeof window.S !== 'undefined',
        S_value: window.S ? {
          version: window.S.version,
          nick: window.S.nick,
          skill: window.S.skill,
          hands_count: window.S.hands?.length
        } : null,
        show_defined: typeof show !== 'undefined',
        pokerCore: !!window.PokerSwipeCore,
        booted: !!window.__pokerBooted,
        document_ready: document.readyState,
        onboarding_hidden: document.getElementById('onboarding')?.classList.contains('hidden'),
        mainApp_visible: !document.getElementById('mainApp')?.classList.contains('hidden'),
        home_active: document.getElementById('home')?.classList.contains('active')
      };
    });

    console.log('\n=== FINAL STATE ===');
    console.log('window.S defined:', state.hasS);
    if (state.S_value) {
      console.log('  version:', state.S_value.version);
      console.log('  nick:', state.S_value.nick);
      console.log('  skill:', state.S_value.skill);
      console.log('  hands:', state.S_value.hands_count);
    }
    console.log('show() defined:', state.show_defined);
    console.log('PokerSwipeCore:', state.pokerCore);
    console.log('Boot completed:', state.booted);
    console.log('Onboarding hidden:', state.onboarding_hidden);
    console.log('Main app visible:', state.mainApp_visible);
    console.log('Home active:', state.home_active);

    console.log('\n=== ERROR SUMMARY ===');
    console.log('Total errors:', errors.length);
    const referenceErrors = errors.filter(e => /ReferenceError|is not defined|undefined/i.test(e));
    if (referenceErrors.length) {
      console.log('\nReference Errors:');
      referenceErrors.slice(0, 10).forEach((e, i) => {
        console.log(`  ${i+1}. ${e}`);
      });
    }

    const bootErrors = errors.filter(e => /BOOT|POKER SWIPE|core bridge/i.test(e));
    if (bootErrors.length) {
      console.log('\nBoot-related Errors:');
      bootErrors.forEach((e, i) => {
        console.log(`  ${i+1}. ${e}`);
      });
    }

    if (errors.length === 0) {
      console.log('✓ No errors detected');
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
    await runDiagnosis();
    process.exit(process.exitCode || 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
