'use strict';
const fs = require('fs');
const path = require('path');

function read(name) {
  const p = path.join(__dirname, name);
  if (!fs.existsSync(p)) throw new Error(`Missing ${name}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const exec = read('execution-sprint4-1-results.json');
const strategy = read('sprint4-strategy-results.json');
const training = read('sprint4-training-results.json');
const explanation = read('sprint4-explanation-results.json');
const adaptive = read('sprint4-adaptive-results.json');
const integration = read('sprint4-integration-results.json');
const massA = read('sprint4-mass-runA.json');
const massB = read('sprint4-mass-runB.json');
const targeted = read('sprint4-targeted-runT.json');

const md = `# SPRINT 4.1.2 REPORT

## FINAL VERDICT

| Gate | Status |
|---|---|
| Syntax | ${exec.syntaxPass ? '✅' : '❌'} |
| Sprint 3 regression | ${exec.sprint3Pass ? '✅' : '❌'} |
| Strategy | ${strategy.fail === 0 ? '✅' : '❌'} |
| Training | ${training.fail === 0 ? '✅' : '❌'} |
| Explanation | ${explanation.fail === 0 ? '✅' : '❌'} |
| Adaptive | ${adaptive.fail === 0 ? '✅' : '❌'} |
| Integration | ${integration.fail === 0 ? '✅' : '❌'} |
| Random mass A | ${exec.massAPass ? '✅' : '❌'} |
| Random mass B | ${exec.massBPass ? '✅' : '❌'} |
| Targeted 32-rule mass | ${exec.targetedPass ? '✅' : '❌'} |
| Determinism | ${exec.determinismPass ? '✅' : '❌'} |
| RNG | ${exec.rngPass ? '✅' : '❌'} |
| SPRINT 4.1 READY | ${exec.sprint41Ready ? '✅ YES' : '❌ NO'} |
| FULL RUN READY | ${exec.fullRunReady ? '✅ YES' : '❌ NO'} |
| CAN START SPRINT 4.2 | ${exec.fullRunReady ? '✅ YES' : '❌ NO'} |

## MASS TESTS

Random A: ${massA.validated}/${massA.requested}, leaks=${massA.totalLeaks}, coverage=${(massA.globalCoverage*100).toFixed(2)}%, hash=${massA.canonicalHash}

Random B: ${massB.validated}/${massB.requested}, leaks=${massB.totalLeaks}, coverage=${(massB.globalCoverage*100).toFixed(2)}%, hash=${massB.canonicalHash}

Targeted: ${targeted.validated}/${targeted.requested}, leaks=${targeted.totalLeaks}, per-rule-ready=${targeted.perRuleCoverageReady}
`;

fs.writeFileSync(path.join(__dirname, 'EXPLOIT_SPRINT_4_1_2_REPORT.md'), md);
console.log('✅ EXPLOIT_SPRINT_4_1_2_REPORT.md generated');
