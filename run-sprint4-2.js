'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');const path=require('path');
const startTime=new Date().toISOString();
function run(script,env={}){const r=spawnSync(process.execPath,[script],{cwd:__dirname,encoding:'utf8',env:{...process.env,...env}});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);return r.status===0;}
const required=['exploit-session-controller.js','exploit-ui-adapter.js','exploit-sprint4-2-session-tests.js','exploit-sprint4-2-public-contract-tests.js','exploit-sprint4-2-determinism-tests.js','exploit-sprint4-2-mass-tests.js','generate-sprint4-2-report.js','run-sprint4-2.js'];
let fileContract=required.every(f=>fs.existsSync(path.join(__dirname,f)));
let syntaxPass=fileContract;for(const f of required){const r=spawnSync(process.execPath,['--check',f],{cwd:__dirname,encoding:'utf8'});if(r.status!==0){syntaxPass=false;console.error(r.stderr||('Syntax fail '+f));}}
console.log('=== Sprint 4.1.2 regression ===');const baselinePass=run('run-sprint4-1.js');
console.log('=== Sprint 4.2 session ===');const sessionPass=run('exploit-sprint4-2-session-tests.js');
console.log('=== Sprint 4.2 public contract ===');const publicPass=run('exploit-sprint4-2-public-contract-tests.js');
console.log('=== Sprint 4.2 determinism ===');const determinismPass=run('exploit-sprint4-2-determinism-tests.js');
console.log('=== Sprint 4.2 mass ===');const massPass=run('exploit-sprint4-2-mass-tests.js');
const sprint42Ready=fileContract&&syntaxPass&&baselinePass&&sessionPass&&publicPass&&determinismPass&&massPass;const fullRunReady=sprint42Ready;
const exec={startTime,endTime:new Date().toISOString(),fileContract,syntaxPass,baselinePass,sessionPass,publicPass,determinismPass,massPass,sprint42Ready,fullRunReady};fs.writeFileSync('execution-sprint4-2-results.json',JSON.stringify(exec,null,2));
run('generate-sprint4-2-report.js');
console.log(`\nSPRINT 4.2 READY: ${sprint42Ready?'✅ YES':'❌ NO'}`);console.log(`FULL RUN READY: ${fullRunReady?'✅ YES':'❌ NO'}`);console.log(`CAN START SPRINT 4.3: ${fullRunReady?'✅ YES':'❌ NO'}`);process.exitCode=fullRunReady?0:1;
