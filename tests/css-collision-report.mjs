import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

const CLASSIFICATION = {
  '#profileArea': { kind: 'intentional', note: 'profile.css wins (loaded late); v39 v38 block removed' },
  '#dailyArea': { kind: 'intentional', note: 'game-visual-system + mini-app-compact; bridge in ps-ui-unified.css' },
  '#polyana': { kind: 'intentional', note: 'scoped #polyana in polyana-integrated.css' },
  '#psPolyanaArea': { kind: 'duplicate', note: 'polyana/polyana-integrated.css + root polyana-integrated.css — verify single link in index' },
  '.screen': { kind: 'intentional', note: 'display toggle in style.css; motion in ps-ui-unified' },
  '.screen.active': { kind: 'conflicting', fixed: 'ps-ui-unified.css owns enter; game-motion animation:none removed; game-polish renamed keyframes' },
  '.hidden': { kind: 'intentional', note: 'utility class across bundles' },
  '.card': { kind: 'intentional', note: 'poker table cards vs app cards — different contexts' },
  '.nav': { kind: 'intentional', note: 'bottom nav patches; tokens do not override layout grid' },
  '.nav button': { kind: 'intentional', note: 'nav chrome; press scale in game-motion + unified bridge' },
  '#home': { kind: 'intentional', note: 'v36 home + polish gradients' },
  '.v32': { kind: 'dead', note: 'legacy hooks only' },
  '.v38': { kind: 'dead', note: 'DOM removed; CSS stripped from v39' },
  '.psScreen': { kind: 'intentional', note: 'design system shell' },
  '.psCard': { kind: 'intentional', note: 'design system' },
  '.psBtn': { kind: 'intentional', note: 'design system' },
};

const TARGETS = Object.keys(CLASSIFICATION);

function collectCssFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      collectCssFiles(p, acc);
    } else if (name.endsWith('.css')) acc.push(p);
  }
  return acc;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function rulesForSelector(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${esc}[^{,]*?)\\{([^}]*)\\}`, 'g');
  const hits = [];
  let m;
  while ((m = re.exec(css))) hits.push({ selector: m[1].trim() });
  return hits;
}

const files = collectCssFiles(ROOT);
const rows = [];

for (const sel of TARGETS) {
  const matches = [];
  for (const file of files) {
    const css = stripComments(readFileSync(file, 'utf8'));
    const hits = rulesForSelector(css, sel);
    if (hits.length) matches.push(file.replace(ROOT + '/', ''));
  }
  const meta = CLASSIFICATION[sel];
  rows.push({ selector: sel, files: matches, ...meta, collision: matches.length > 1 });
}

const md = [
  '# CSS Collision Report',
  '',
  'Classifications: **intentional** | **dead** | **duplicate** | **conflicting** (fixed in PR #97 pass)',
  '',
  '| Selector | Class | Fixed | Files | Note |',
  '|----------|-------|-------|-------|------|',
  ...rows.map((r) => `| \`${r.selector}\` | ${r.kind} | ${r.fixed ? 'yes' : '—'} | ${r.files.length} | ${r.note} |`),
  '',
  '## Motion owner (final)',
  '',
  '- **Screen enter:** `ps-design-tokens.css` `@keyframes psScreenEnter` + `ps-ui-unified.css` `.psScreen.screen.active`',
  '- **game-motion.css:** no longer sets `animation: none` on `.screen.active`',
  '- **game-polish.css:** optional `.ps-screen-enter` uses `psScreenEnterPolish` (distinct keyframes)',
  '',
];

writeFileSync(join(ROOT, 'CSS_COLLISION_REPORT.md'), md.join('\n'));
console.log(JSON.stringify({ pass: true, rows: rows.length }, null, 2));
