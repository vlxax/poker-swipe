'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');
const checks=[['Sprint 4.10 regression','run-sprint4-10.js'],['Sprint 4.11 curriculum','exploit-sprint4-11-curriculum-tests.js']];const out={};let ok=true;
for(const [name,file] of checks){console.log(`\n=== ${name} ===`);const r=spawnSync(process.execPath,[file],{cwd:__dirname,stdio:'inherit'});out[name]=r.status===0;if(r.status!==0)ok=false;}
out.sprint411Ready=ok;out.fullRunReady=ok;fs.writeFileSync('execution-sprint4-11-results.json',JSON.stringify(out,null,2));console.log(`\nSPRINT 4.11 READY: ${ok?'YES':'NO'}`);process.exitCode=ok?0:1;
