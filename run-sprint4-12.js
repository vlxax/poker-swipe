'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');
const checks=[['Sprint 4.11 regression','run-sprint4-11.js'],['Sprint 4.12 skill graph','exploit-sprint4-12-skill-graph-tests.js']];const out={};let ok=true;
for(const [name,file] of checks){console.log(`\n=== ${name} ===`);const r=spawnSync(process.execPath,[file],{cwd:__dirname,stdio:'inherit'});out[name]=r.status===0;if(r.status!==0)ok=false;}
out.sprint412Ready=ok;out.fullRunReady=ok;fs.writeFileSync('execution-sprint4-12-results.json',JSON.stringify(out,null,2));console.log(`\nSPRINT 4.12 READY: ${ok?'YES':'NO'}`);process.exitCode=ok?0:1;
