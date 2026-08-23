'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');
const tests=['run-sprint4-8.js','exploit-sprint4-9-plan-tests.js'];let ok=true;const results={};
for(const f of tests){const r=spawnSync(process.execPath,[f],{stdio:'inherit',cwd:__dirname});results[f]=r.status===0;if(r.status!==0)ok=false;}
const out={sprint:'4.9.0',regression48:results['run-sprint4-8.js'],personalPlan:results['exploit-sprint4-9-plan-tests.js'],sprint49Ready:ok,fullRunReady:ok,canStartSprint410:ok};fs.writeFileSync('execution-sprint4-9-results.json',JSON.stringify(out,null,2));console.log('\nSPRINT 4.9 READY:',ok?'YES':'NO');process.exitCode=ok?0:1;
