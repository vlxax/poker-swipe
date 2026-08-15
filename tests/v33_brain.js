const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const previous = {
  version: '17',
  gradeDecision: (spot, action) => ({
    grade: 'r', actionGrade: 'r', sizeGrade: null, action: String(action).toUpperCase(),
    actionFrequency: .27, topActions: [{action: 'CHECK', freq: .73}, {action: 'BET', freq: .27}],
    score: 27, concept: spot.concept || 'test', explanation: spot.why || 'base',
    source: 'EXACT_REFERENCE_NODE', confidence: 94
  }),
  analyzeHand: () => ({result: {}}),
  handBucket: () => 'DRAW'
};
const context = {window: {PokerBrain: previous}, console};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'poker_brain_v33.js'), 'utf8'), context);

const Brain = context.window.PokerBrainV33;
const PokerBrain = context.window.PokerBrain;
assert.equal(Brain.version, '33.0');
assert.equal(Brain.matrixClasses().length, 169);
assert.equal(new Set(Brain.matrixClasses()).size, 169);
assert.equal(Brain.comboCount(['AA'], []), 6);
assert.equal(Brain.comboCount(['AA'], ['As']), 3);

const contextual = Brain.contextForSpot({
  id: 'F_A72_QJ', street: 'ФЛОП', pos: 'BTN vs BB', hero: ['Q♣', 'J♣'],
  board: ['A♦', '7♠', '2♥'], stack: 38, pot: 5.2, ctx: 'BB чек.', format: 'MTT'
});
assert.match(contextual.preflop, /BTN.*2,2.*BB/i);
assert.ok(contextual.assumptions.length);
assert.ok(contextual.score >= 70 && contextual.score < 100);

const spot = {
  id: 'T_JT85_KQ_V1', street: 'ТЁРН', pos: 'BTN vs BB', hero: ['K♣', 'Q♦'],
  board: ['J♠', 'T♣', '8♦', '5♥'], ctx: 'Флоп check-check. BB чек.',
  stack: 40, pot: 5.4, format: 'MTT'
};
const bet = PokerBrain.gradeDecision(spot, 'СТАВКА', 75);
const check = PokerBrain.gradeDecision(spot, 'ЧЕК');
assert.equal(bet.grade, 'g');
assert.equal(check.grade, 'y');
assert.equal(bet.source, 'PRO_REVIEWED_SCENARIO');
assert.match(bet.explanation, /две оверкарты.*стрит-дро/i);

const turn = Brain.streetStory({street: 'TURN', hero: ['Ah', 'Qh'], board: ['Js', 'Tc', '8h', '5h'], pos: {hero: 'BTN', villain: 'BB'}});
const river = Brain.streetStory({street: 'RIVER', hero: ['Ah', 'Qh'], board: ['Js', 'Tc', '8h', '5h', '2c'], pos: {hero: 'BTN', villain: 'BB'}});
assert.match(turn, /флеш-дро/i);
assert.match(river, /не закрыл флеш-дро/i);
assert.ok(Brain.rangePreset('BTN').size > Brain.rangePreset('UTG').size);

console.log('PokerBrain V33 unit: OK');
