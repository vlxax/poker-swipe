import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compactConditions, fullConditions, fullContextModal, esc, bb, formatLabel, streetLabel, registerTask, getTask } from '../task-context/contextUI.js';
import { emptyTask } from '../task-context/schema.js';

function sample() {
  const t = Object.assign(emptyTask(), {
    id: 'T1', format: 'MTT', street: 'ТЁРН', blinds: [500, 1000], ante: 125,
    stage: 'БАББЛ', table: '6-MAX', left: '9 LEFT', position: 'BB',
    hero: ['A♥', 'J♣'], heroStack: 22, villain: 'SB', villainStack: 21,
    effStack: 21, opp: { name: 'РЕГ', vpip: 21, pfr: 16, sample: 3400, style: 'ТАЙТ-АГРЕССИВНЫЙ', note: 'Дисциплинирован.' },
    board: ['A♦', '9♣', '5♠', '2♥'], pot: 12, difficulty: 2,
    history: [{ street: 'ПРЕФЛОП', text: 'SB открыл, BB заколлил.', pot: 5.2 }, { street: 'ФЛОП', text: 'BB чек, SB 70%, BB колл.', pot: 12 }],
    question: 'Что делаешь с AJ?', options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', concept: 'value', explain: 'x'
  });
  return t;
}

test('contextUI: bb formatting', () => {
  assert.equal(bb(20), '20 ББ');
  assert.equal(bb(20.5), '20,5 ББ');
  assert.equal(bb(0), '—');
  assert.equal(bb(null), '—');
});

test('contextUI: labels', () => {
  assert.equal(formatLabel('MTT'), 'МТТ');
  assert.equal(formatLabel('PKO'), 'ПКО');
  assert.equal(formatLabel('CASH'), 'КЭШ');
  assert.equal(streetLabel('ПРЕФЛОП'), 'ПРЕФЛОП');
  assert.equal(streetLabel('ТЁРН'), 'ТЁРН');
});

test('contextUI: esc escapes html', () => {
  assert.equal(esc('<x>&"'), '&lt;x&gt;&amp;&quot;');
});

test('contextUI: compact conditions include key fields + button', () => {
  const html = compactConditions(sample());
  assert.match(html, /ТЁРН · УСЛОВИЯ/);
  assert.match(html, /БЛАЙНДЫ/);
  assert.match(html, /500\/1000 \+ анте 125/);
  assert.match(html, /БАНК/);
  assert.match(html, /12 ББ/);
  assert.match(html, /ЭФФ\. СТЕК/);
  assert.match(html, /BB · большой блайнд · 22 ББ/);
  assert.match(html, /SB · малый блайнд · РЕГ/);
  assert.match(html, /Доска:/);
  assert.match(html, /A♦ 9♣ 5♠ 2♥/);
  assert.match(html, /ВСЕ УСЛОВИЯ/);
  assert.match(html, /data-ctx-full="T1"/);
});

test('contextUI: full conditions include opponent stats, history, question, concept', () => {
  const html = fullConditions(sample());
  assert.match(html, /ВСЕ УСЛОВИЯ/);
  assert.match(html, /Соперник:/);
  assert.match(html, /РЕГ · VPIP 21% · PFR 16%/);
  assert.match(html, /История раздачи:/);
  assert.match(html, /SB открыл, BB заколлил/);
  assert.match(html, /Вопрос:/);
  assert.match(html, /Что делаешь с AJ/);
  assert.match(html, /Концепция:/);
  assert.match(html, /СЛОЖНОСТЬ/);
  assert.match(html, /●●○/);
});

test('contextUI: fullContextModal adds close button', () => {
  const html = fullContextModal(sample());
  assert.match(html, /ctxCloseBtn/);
  assert.match(html, /ПОНЯТНО/);
});

test('contextUI: register/get lookup', () => {
  const t = sample();
  registerTask(t);
  assert.equal(getTask('T1'), t);
  assert.equal(getTask('nope'), undefined);
});