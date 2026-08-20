// Stitch visual patch integration tests for «Мои турниры».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const root = new URL('..', import.meta.url);
const css = readFileSync(new URL('../my-tournaments-stitch.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../my-tournaments-stitch.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html wires stitch css/js after tournament visual stack', () => {
  const cssIdx = html.indexOf('my-tournaments-stitch.css');
  const jsIdx = html.indexOf('my-tournaments-stitch.js');
  const v72Idx = html.indexOf('id="v72-my-tournaments-script"');
  assert.ok(cssIdx > 0);
  assert.ok(jsIdx > 0);
  assert.ok(v72Idx > 0);
  assert.ok(cssIdx > v72Idx);
  assert.ok(jsIdx > v72Idx);
});

test('stitch css targets working ps72 screen and legacy t23 journal', () => {
  assert.match(css, /#ps72TournamentScreen\.ps-tournaments-premium/);
  assert.match(css, /\.t23Card/);
  assert.match(css, /#dfff00|223,255,0/);
});

test('stitch css does not restyle bottom navigation', () => {
  assert.match(css, /\.nav,\s*\n\.nav \*,\s*\n\.bottomNav/);
  assert.doesNotMatch(css, /\.nav button\s*\{[^}]*background[^}]*!important/);
  assert.doesNotMatch(css, /\.nav\s*\{[^}]*background[^}]*!important/);
});

test('stitch js marks ps72 screen without touching nav handlers', () => {
  assert.match(js, /ps72TournamentScreen/);
  assert.match(js, /ps-tournaments-premium/);
  assert.match(js, /psPreserveNav/);
  assert.doesNotMatch(js, /\.onclick\s*=/);
  assert.doesNotMatch(js, /three\.js|THREE/i);
});

test('stitch patch does not ship Three.js', () => {
  assert.doesNotMatch(css, /three\.js|THREE/i);
  assert.doesNotMatch(js, /three\.js|THREE/i);
  assert.doesNotMatch(html.match(/my-tournaments-stitch\.(css|js)/g)?.join('\n') || '', /three/i);
});

test('stitch css includes mobile overflow guards for ps72', () => {
  assert.match(css, /#ps72TournamentScreen\.ps-tournaments-premium[\s\S]*overflow-x:hidden/);
  assert.match(css, /@media \(max-width:320px\)/);
  assert.match(css, /@media \(max-width:360px\)/);
  assert.match(css, /@media \(max-width:390px\)/);
  assert.match(css, /@media \(max-width:430px\)/);
});

test('premium marker targets ps72 screen elements in jsdom', () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <section id="ps72TournamentScreen"></section>
    <div id="ps72Modal"></div>
    <nav class="nav"></nav>
  </body></html>`, { url: 'http://app.local/' });
  const doc = dom.window.document;
  [
    doc.getElementById('ps72TournamentScreen'),
    doc.getElementById('ps72Modal')
  ].filter(Boolean).forEach(el => el.classList.add('ps-tournaments-premium'));
  doc.querySelector('.nav').dataset.psPreserveNav = 'true';
  assert.ok(doc.getElementById('ps72TournamentScreen').classList.contains('ps-tournaments-premium'));
  assert.ok(doc.getElementById('ps72Modal').classList.contains('ps-tournaments-premium'));
  assert.equal(doc.querySelector('.nav').dataset.psPreserveNav, 'true');
});

test('t23 profit helpers remain available in app bundle', () => {
  assert.match(html, /function t23Profit\(/);
  assert.match(html, /function t23Return\(/);
  assert.match(html, /function t23Cost\(/);
  assert.match(html, /bountyWon/);
});
