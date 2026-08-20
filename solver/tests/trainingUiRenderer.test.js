// jsdom browser-QA for the new personalised-training UI surfaces. Verifies the
// DOM renderers (assessment intro, per-question, summary, personalised home)
// produce the expected markup and wire their handlers, without touching the
// heavy classic index.html flow. These are the entry points a real user reaches
// via show('daily') → paint().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><div id="dailyArea"></div>', {
  url: 'http://app.local/', pretendToBeVisual: true
});

// Renderer relies on window.$ / window.esc / window.card helpers being present.
const src = 'http://app.local/';
globalThis.window = window;
globalThis.document = window.document;
window.$ = (sel) => window.document.querySelector(sel);
window.$$ = (sel) => Array.from(window.document.querySelectorAll(sel));
window.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
window.card = (c) => `<span class="pc">${c}</span>`;

const R = await import('../../training-ui/renderer.js');
const VM = await import('../../training-ui/viewModel.js');

function freshRoot() {
  window.document.querySelector('#dailyArea').innerHTML = '';
  return window.document.querySelector('#dailyArea');
}

test('renderAssessmentIntro offers diagnostic + legacy and wires handlers', () => {
  const root = freshRoot();
  let begin = 0, legacy = 0;
  R.renderAssessmentIntro(root, { copy: 'Тест' }, { begin: () => begin++, legacy: () => legacy++ });
  assert.ok(root.innerHTML.includes('ТВОЙ УРОВЕНЬ'));
  const b = root.querySelector('#trAssess');
  const l = root.querySelector('#trLegacy');
  assert.ok(b && l, 'both CTA buttons rendered');
  b.onclick();
  l.onclick();
  assert.equal(begin, 1);
  assert.equal(legacy, 1);
});

test('renderAssessment renders a question and wires its choices', () => {
  const root = freshRoot();
  const vm = {
    q: 'Что сделаешь?',
    streetRu: 'FLOP',
    progress: { index: 2, total: 12 },
    choices: [
      { id: 'fold', labelRu: 'ФОЛД' },
      { id: 'call', labelRu: 'КОЛЛ' }
    ]
  };
  let answered = null;
  R.renderAssessment(root, vm, { answer: (c) => { answered = c; } });
  assert.ok(root.innerHTML.includes('2 / 12'));
  assert.ok(root.innerHTML.includes('ФОЛД'));
  root.querySelector('[data-achoice="call"]').onclick();
  assert.equal(answered, 'call');
});

test('renderAssessmentSummary reports level + weakest/strongest and wires back', () => {
  const root = freshRoot();
  const vm = {
    overall: 3,
    overallLabel: 'СРЕДНИЙ',
    correct: 8,
    answered: 12,
    weakest: 'Префлоп',
    strongest: 'Ривер'
  };
  let went = null;
  R.renderAssessmentSummary(root, vm, { back: () => { went = true; } });
  assert.ok(root.innerHTML.includes('СРЕДНИЙ'));
  assert.ok(root.innerHTML.includes('8 / 12'));
  assert.ok(root.innerHTML.includes('Префлоп'));
  root.querySelector('#asBack').onclick();
  assert.equal(went, true);
});

test('renderHome renders personal training CTA with start handler', () => {
  const root = freshRoot();
  const vm = {
    type: 'training',
    title: 'ТВОЯ ТРЕНИРОВКА',
    subtitle: '7 раздач · около 5 минут',
    levelLabel: 'КЛУБНЫЙ РЕГ',
    levelScore: 61,
    focusHeading: 'Сегодня тренируем:',
    focusItems: ['решения на баббле', 'блеф-кетчи на ривере'],
    whyHeading: 'Почему:',
    whyText: 'Именно здесь ты сейчас чаще всего теряешь фишки.',
    cta: 'НАЧАТЬ ТРЕНИРОВКУ',
    total: 7
  };
  let started = 0;
  R.renderHome(root, vm, { start: () => started++ });
  assert.ok(root.innerHTML.includes('ТВОЯ ТРЕНИРОВКА'));
  assert.ok(root.innerHTML.includes('7 раздач'));
  assert.ok(root.innerHTML.includes('Сегодня тренируем'));
  assert.ok(root.innerHTML.includes('баббле'));
  root.querySelector('#trStart').onclick();
  assert.equal(started, 1);
});

test('viewModel builds a full per-question assessment view', () => {
  const a = VM.assessmentViewModel({
    item: {
      q: 'На 4-bet?',
      street: 'ПРЕФЛОП',
      choices: ['ФОЛД', 'КОЛЛ']
    },
    index: 1,
    total: 12
  });
  assert.equal(a.q, 'На 4-bet?');
  assert.equal(a.streetRu, 'ПРЕФЛОП');
  assert.equal(a.progress.index, 1);
  assert.equal(a.choices.length, 2);
});