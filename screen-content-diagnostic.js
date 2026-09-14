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

async function inspectScreen(page, screenName, navAction) {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`SCREEN: ${screenName}`);
  console.log('='.repeat(80));

  try {
    await navAction(page);
    await page.waitForTimeout(1000);

    const screenContent = await page.evaluate(() => {
      const mainContainers = [
        document.querySelector('#main'),
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.querySelector('.main-container'),
        document.querySelector('.screen'),
        document.querySelector('.page')
      ];

      const main = mainContainers.find(el => el);

      return {
        main_element_found: !!main,
        main_element_type: main?.tagName || 'NONE',
        main_element_id: main?.id || 'NONE',
        main_element_class: main?.className || 'NONE',
        html_length: main?.innerHTML.trim().length || 0,
        html_preview: main?.innerHTML.trim().substring(0, 200) || 'EMPTY',
        text_content_length: main?.textContent.trim().length || 0,
        text_preview: main?.textContent.trim().substring(0, 100) || 'EMPTY',
        child_elements: main?.children.length || 0,
        visible_buttons: Array.from(document.querySelectorAll('button'))
          .map(b => b.textContent.trim())
          .slice(0, 10),
        inputs: Array.from(document.querySelectorAll('input, textarea, select'))
          .map(el => ({
            type: el.type || el.tagName,
            placeholder: el.placeholder || 'none'
          }))
          .slice(0, 5),
        data_attributes: main ? Object.keys(main.dataset).slice(0, 5) : []
      };
    });

    console.log(`Main element found: ${screenContent.main_element_found}`);
    console.log(`Type: ${screenContent.main_element_type}`);
    console.log(`ID: ${screenContent.main_element_id}`);
    console.log(`Class: ${screenContent.main_element_class}`);
    console.log(`\nContent Analysis:`);
    console.log(`  HTML length: ${screenContent.html_length} chars`);
    console.log(`  Text length: ${screenContent.text_content_length} chars`);
    console.log(`  Child elements: ${screenContent.child_elements}`);
    console.log(`\nHTML Preview:`);
    console.log(`  ${screenContent.html_preview}`);
    console.log(`\nText Preview:`);
    console.log(`  ${screenContent.text_preview}`);
    console.log(`\nVisible Buttons:`);
    screenContent.visible_buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. "${btn}"`);
    });
    console.log(`\nForm Inputs:`);
    screenContent.inputs.forEach((inp, i) => {
      console.log(`  ${i + 1}. ${inp.type} (${inp.placeholder})`);
    });
    console.log(`\nData Attributes:`);
    screenContent.data_attributes.forEach(attr => {
      console.log(`  - ${attr}`);
    });

  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}

async function runDiagnostic() {
  let server;
  let browser;

  try {
    server = await startServer();
    console.log('✓ Server started on port ' + PORT);

    const browserType = playwright.chromium;
    browser = await browserType.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ?
        path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Boot
    console.log('\nLoading application...');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Check each screen
    const screens = [
      {
        name: 'HOME',
        nav: async (p) => {
          await p.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
        }
      },
      {
        name: 'SWIPE',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('Swipe')
            )?.click();
          });
        }
      },
      {
        name: 'SIZING',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('Sizing')
            )?.click();
          });
        }
      },
      {
        name: 'DAILY',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('Daily')
            )?.click();
          });
        }
      },
      {
        name: 'MY HANDS',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('My Hands')
            )?.click();
          });
        }
      },
      {
        name: 'POLYANA',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('Polyana')
            )?.click();
          });
        }
      },
      {
        name: 'MY TOURNAMENTS',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('My Tournaments')
            )?.click();
          });
        }
      },
      {
        name: 'PROFILE',
        nav: async (p) => {
          await p.evaluate(() => {
            Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent.includes('Profile')
            )?.click();
          });
        }
      }
    ];

    for (const screen of screens) {
      await inspectScreen(page, screen.name, screen.nav);
    }

    await context.close();
    await browser.close();
    server.close();

    console.log('\n\n' + '='.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
}

await runDiagnostic();
