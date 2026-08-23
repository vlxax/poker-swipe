'use strict';
const {spawnSync}=require('child_process'); const fs=require('fs'); const path=require('path');
const startTime=new Date().toISOString();
const suites=[
 ['regression','run-sprint4-5.js'],
 ['learning','exploit-sprint4-6-learning-tests.js'],
 ['navigation','exploit-sprint4-6-navigation-tests.js']
];
const out={startTime,suites:{}}; let ok=true;
for(const [name,script] of suites){console.log(`\n=== ${name.toUpperCase()} ===`);const r=spawnSync(process.execPath,[script],{cwd:__dirname,encoding:'utf8',stdio:'inherit'});out.suites[name]=r.status===0;if(r.status!==0)ok=false;}
out.endTime=new Date().toISOString(); out.sprint46Ready=ok; out.fullRunReady=ok; fs.writeFileSync(path.join(__dirname,'execution-sprint4-6-results.json'),JSON.stringify(out,null,2));
console.log('\n=== SPRINT 4.6 FINAL VERDICT ==='); console.log(`SPRINT 4.6 READY: ${ok?'✅ YES':'❌ NO'}`); console.log(`CAN START SPRINT 4.7: ${ok?'✅ YES':'❌ NO'}`); process.exitCode=ok?0:1;
