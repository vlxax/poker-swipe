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
      resolve(server);
    });
  });
}

async function captureConsoleErrors() {
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

    const errors = [];
    const warnings = [];
    const logs = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(text);
      } else if (msg.type() === 'warning') {
        warnings.push(text);
      } else if (msg.type() === 'log') {
        logs.push(text);
      }
    });

    console.log('Loading page and capturing console output...');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await context.close();
    await browser.close();
    server.close();

    // Analyze errors
    console.log('\n========== CONSOLE OUTPUT REPORT ==========\n');

    console.log(`TOTAL ERRORS: ${errors.length}`);
    console.log(`TOTAL WARNINGS: ${warnings.length}`);
    console.log(`TOTAL LOGS: ${logs.length}`);

    if (errors.length > 0) {
      console.log('\n--- ERRORS (grouped by message) ---');
      const errorGroups = {};
      errors.forEach(err => {
        const key = err.substring(0, 80); // First 80 chars as key
        errorGroups[key] = (errorGroups[key] || 0) + 1;
      });

      Object.entries(errorGroups)
        .sort((a, b) => b[1] - a[1])
        .forEach(([msg, count]) => {
          console.log(`  [${count}x] ${msg}`);
        });
    }

    if (warnings.length > 0) {
      console.log('\n--- WARNINGS (first 10) ---');
      warnings.slice(0, 10).forEach(warn => {
        console.log(`  ${warn}`);
      });
    }

    // Save detailed report
    const report = {
      summary: {
        total_errors: errors.length,
        total_warnings: warnings.length,
        total_logs: logs.length
      },
      errors: errors,
      warnings: warnings.slice(0, 20),
      logs: logs.slice(0, 20)
    };

    fs.writeFileSync('console-errors-report.json', JSON.stringify(report, null, 2));
    console.log('\n✓ Detailed report saved to console-errors-report.json');

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
}

await captureConsoleErrors();
