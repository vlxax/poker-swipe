'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');const path=require('path');
const startTime=new Date().toISOString();
function run(script,env={}){const r=spawnSync(process.execPath,[script],{cwd:__dirname,encoding:'utf8',env:{...process.env,...env},stdio:'inherit'});return r.status===0}
function read(f){try{return JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'))}catch(_){return null}}
console.log('=== Sprint 4.4 regression ===');const regression=run('run-sprint4-4.js');
const syntaxFiles=['exploit-training-profile.js','exploit-progress-analytics.js','exploit-training-engine.js','exploit-training-storage.js','exploit-session-controller.js','exploit-screen-presenter.js','exploit-app-integration.js','exploit-sprint4-5-profile-tests.js','exploit-sprint4-5-progress-tests.js','exploit-sprint4-5-navigation-tests.js','exploit-sprint4-5-contract-tests.js','exploit-sprint4-5-mass-tests.js','run-sprint4-5.js','generate-sprint4-5-report.js'];
let syntax=true;for(const f of syntaxFiles){const r=spawnSync(process.execPath,['--check',f],{cwd:__dirname,encoding:'utf8'});if(r.status!==0){syntax=false;console.error(r.stderr)}}
const profile=syntax&&run('exploit-sprint4-5-profile-tests.js');
const progress=syntax&&run('exploit-sprint4-5-progress-tests.js');
const navigation=syntax&&run('exploit-sprint4-5-navigation-tests.js');
const contract=syntax&&run('exploit-sprint4-5-contract-tests.js');
const massA=syntax&&run('exploit-sprint4-5-mass-tests.js',{RUN_ID:'A'});
const massB=syntax&&run('exploit-sprint4-5-mass-tests.js',{RUN_ID:'B'});
const a=read('sprint4-5-mass-runA.json'),b=read('sprint4-5-mass-runB.json');const determinism=Boolean(a&&b&&a.hash&&a.hash===b.hash);
const sprint45Ready=regression&&syntax&&profile&&progress&&navigation&&contract&&massA&&massB&&determinism;
const exec={startTime,endTime:new Date().toISOString(),regression,syntax,profile,progress,navigation,contract,massA,massB,determinism,hashA:a?.hash||null,hashB:b?.hash||null,sprint45Ready,fullRunReady:false,reportReady:false};
fs.writeFileSync('execution-sprint4-5-results.json',JSON.stringify(exec,null,2));
const report=run('generate-sprint4-5-report.js');exec.reportReady=report;exec.fullRunReady=sprint45Ready&&report;fs.writeFileSync('execution-sprint4-5-results.json',JSON.stringify(exec,null,2));
console.log('\n=== SPRINT 4.5 FINAL VERDICT ===');console.log(`SPRINT 4.5 READY: ${sprint45Ready?'✅ YES':'❌ NO'}`);console.log(`FULL RUN READY: ${exec.fullRunReady?'✅ YES':'❌ NO'}`);console.log(`CAN START SPRINT 4.6: ${exec.fullRunReady?'✅ YES':'❌ NO'}`);process.exitCode=exec.fullRunReady?0:1;
