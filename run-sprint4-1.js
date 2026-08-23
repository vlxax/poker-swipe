'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const startTime = new Date().toISOString();
const runtimeFiles = [
  'exploit-training-constants.js','exploit-training-engine.js','exploit-explanation-engine.js','exploit-training-storage.js',
  'exploit-sprint4-strategy-action-tests.js','exploit-sprint4-training-engine-tests.js','exploit-sprint4-explanation-tests.js',
  'exploit-sprint4-adaptive-selection-tests.js','exploit-sprint4-integration-tests.js','exploit-sprint4-mass-tests.js',
  'run-sprint4-1.js','generate-sprint4-1-report.js'
];
const requiredInherited = ['exploit-card-generator.js','exploit-card-evaluator.js','exploit-strategy.json','run-sprint3-baseline.js'];

function run(script, env = {}) {
  return spawnSync(process.execPath, [script], { cwd: __dirname, env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'inherit' });
}
function read(name) { try { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); } catch (_) { return null; } }

for (const f of [...runtimeFiles, ...requiredInherited]) {
  if (!fs.existsSync(path.join(__dirname, f))) {
    console.error(`❌ Missing required file: ${f}`);
    fs.writeFileSync('execution-sprint4-1-results.json', JSON.stringify({ startTime, endTime: new Date().toISOString(), fileContractReady: false, sprint41Ready: false, fullRunReady: false }, null, 2));
    process.exit(1);
  }
}

let syntaxPass = true;
for (const f of runtimeFiles) {
  const r = spawnSync(process.execPath, ['--check', f], { cwd: __dirname, encoding: 'utf8' });
  if (r.status !== 0) { syntaxPass = false; console.error(`❌ Syntax: ${f}\n${r.stderr}`); }
}
if (!syntaxPass) process.exitCode = 1;

let rngPass = true;
for (const f of ['exploit-training-engine.js','exploit-explanation-engine.js','exploit-training-storage.js']) {
  const lines = fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*')) continue;
    if (line.includes('Math.random') && !line.includes('options.randomFn') && !line.includes(': Math.random')) rngPass = false;
  }
}

const sprint3 = syntaxPass ? run('run-sprint3-baseline.js') : { status: 1 };
const sprint3Pass = sprint3.status === 0;

const suites = [
  ['strategy','exploit-sprint4-strategy-action-tests.js'],
  ['training','exploit-sprint4-training-engine-tests.js'],
  ['explanation','exploit-sprint4-explanation-tests.js'],
  ['adaptive','exploit-sprint4-adaptive-selection-tests.js'],
  ['integration','exploit-sprint4-integration-tests.js']
];
const suitePass = {};
for (const [name, script] of suites) suitePass[name] = run(script).status === 0;
const allSprint4Pass = Object.values(suitePass).every(Boolean);

const massA = run('exploit-sprint4-mass-tests.js', { RUN_ID: 'A', MODE: 'random' });
const massB = run('exploit-sprint4-mass-tests.js', { RUN_ID: 'B', MODE: 'random' });
const targeted = run('exploit-sprint4-mass-tests.js', { RUN_ID: 'T', MODE: 'targeted' });
const massAPass = massA.status === 0;
const massBPass = massB.status === 0;
const targetedPass = targeted.status === 0;

const a = read('sprint4-mass-runA.json');
const b = read('sprint4-mass-runB.json');
const t = read('sprint4-targeted-runT.json');
const determinismPass = Boolean(a && b && a.canonicalHash && a.canonicalHash === b.canonicalHash);
const generationReady = Boolean(a?.coverageReady && a?.perRuleCoverageReady && b?.coverageReady && b?.perRuleCoverageReady && t?.coverageReady && t?.perRuleCoverageReady);

const preReportReady = syntaxPass && sprint3Pass && allSprint4Pass && massAPass && massBPass && targetedPass && determinismPass && rngPass && generationReady;
let exec = {
  startTime, endTime: new Date().toISOString(), fileContractReady: true, syntaxPass, rngPass, sprint3Pass,
  sprint4Tests: suitePass, allSprint4Pass, massAPass, massBPass, targetedPass,
  hashA: a?.canonicalHash || null, hashB: b?.canonicalHash || null, determinismPass, generationReady,
  reportPass: false, sprint41Ready: false, fullRunReady: false
};
fs.writeFileSync('execution-sprint4-1-results.json', JSON.stringify(exec, null, 2));

const reportRun = run('generate-sprint4-1-report.js');
const reportPath = path.join(__dirname, 'EXPLOIT_SPRINT_4_1_2_REPORT.md');
const reportPass = reportRun.status === 0 && fs.existsSync(reportPath) && fs.statSync(reportPath).size > 0 && fs.readFileSync(reportPath, 'utf8').includes('FINAL VERDICT');
const sprint41Ready = preReportReady && reportPass;
const fullRunReady = sprint41Ready;
exec = { ...exec, endTime: new Date().toISOString(), reportPass, sprint41Ready, fullRunReady };
fs.writeFileSync('execution-sprint4-1-results.json', JSON.stringify(exec, null, 2));

if (reportPass) run('generate-sprint4-1-report.js');
console.log(`\nSPRINT 4.1 READY: ${sprint41Ready ? '✅ YES' : '❌ NO'}`);
console.log(`FULL RUN READY: ${fullRunReady ? '✅ YES' : '❌ NO'}`);
console.log(`CAN START SPRINT 4.2: ${fullRunReady ? '✅ YES' : '❌ NO'}`);
process.exitCode = fullRunReady ? 0 : 1;
