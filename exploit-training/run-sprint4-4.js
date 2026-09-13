'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');const path=require('path');
const startTime=new Date().toISOString();
function run(script,env={}){const r=spawnSync(process.execPath,[script],{cwd:__dirname,encoding:'utf8',env:{...process.env,...env},stdio:'inherit'});return r.status===0}
function read(f){try{return JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'))}catch(_){return null}}
console.log('=== Sprint 4.3 regression ===');const regression=run('run-sprint4-3.js');
const syntaxFiles=['exploit-session-persistence.js','exploit-app-integration.js','exploit-session-controller.js','exploit-sprint4-4-persistence-tests.js','exploit-sprint4-4-navigation-tests.js','exploit-sprint4-4-contract-tests.js','exploit-sprint4-4-mass-tests.js','run-sprint4-4.js','generate-sprint4-4-report.js'];
let syntax=true;for(const f of syntaxFiles){const r=spawnSync(process.execPath,['--check',f],{cwd:__dirname,encoding:'utf8'});if(r.status!==0){syntax=false;console.error(r.stderr)}}
const persistence=syntax&&run('exploit-sprint4-4-persistence-tests.js');
const navigation=syntax&&run('exploit-sprint4-4-navigation-tests.js');
const contract=syntax&&run('exploit-sprint4-4-contract-tests.js');
const massA=syntax&&run('exploit-sprint4-4-mass-tests.js',{RUN_ID:'A'});
const massB=syntax&&run('exploit-sprint4-4-mass-tests.js',{RUN_ID:'B'});
const a=read('sprint4-4-mass-runA.json'),b=read('sprint4-4-mass-runB.json');const determinism=Boolean(a&&b&&a.hash&&a.hash===b.hash);
const sprint44Ready=regression&&syntax&&persistence&&navigation&&contract&&massA&&massB&&determinism;
const exec={startTime,endTime:new Date().toISOString(),regression,syntax,persistence,navigation,contract,massA,massB,determinism,hashA:a?.hash||null,hashB:b?.hash||null,sprint44Ready,fullRunReady:sprint44Ready};
fs.writeFileSync('execution-sprint4-4-results.json',JSON.stringify(exec,null,2));
const report=run('generate-sprint4-4-report.js');const finalReady=sprint44Ready&&report;exec.reportReady=report;exec.fullRunReady=finalReady;fs.writeFileSync('execution-sprint4-4-results.json',JSON.stringify(exec,null,2));
console.log('\n=== SPRINT 4.4 FINAL VERDICT ===');console.log(`SPRINT 4.4 READY: ${sprint44Ready?'✅ YES':'❌ NO'}`);console.log(`FULL RUN READY: ${finalReady?'✅ YES':'❌ NO'}`);console.log(`CAN START SPRINT 4.5: ${finalReady?'✅ YES':'❌ NO'}`);process.exitCode=finalReady?0:1;
