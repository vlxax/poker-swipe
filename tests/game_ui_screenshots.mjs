import { chromium } from 'playwright';
import { spawn } from 'child_process';

const PORT = 8788;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: '/workspace' });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__maGameLayout);

const shots = [
  { app: 'review', sel: '#reviewArea', name: 'game_review_loss_map' },
  { app: 'sizing', sel: '#sizingArea', name: 'game_sizing_table' },
  { app: 'swipe', sel: '#swipeCard', name: 'game_swipe_table', prep: () => { window.newSwipeSession(); window.show('swipe'); } },
  { app: 'xray', sel: '#xrayArea', name: 'game_xray_intro' },
];

for (const s of shots) {
  if (s.prep) await page.evaluate(s.prep);
  else await page.evaluate((a) => window.show(a), s.app);
  await page.waitForTimeout(500);
  const el = await page.$(s.sel);
  if (el) await el.screenshot({ path: `/opt/cursor/artifacts/${s.name}.png` });
}

await page.evaluate(() => window.show('ranges'));
await page.waitForTimeout(600);
const rng = await page.$('#rangesArea');
if (rng) await rng.screenshot({ path: '/opt/cursor/artifacts/game_ranges_matrix.png' });

server.kill();
await browser.close();
console.log('screenshots done');
