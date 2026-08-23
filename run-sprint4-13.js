'use strict';
const {spawnSync}=require('child_process');const fs=require('fs');
const checks=[['Sprint 4.12 regression','run-sprint4-12.js'],['Sprint 4.13 transfer learning','exploit-sprint4-13-transfer-tests.js']];const out={generatedAt:new Date().toISOString()};let ok=true;
for(const [name,file] of checks){console.log(`\n=== ${name} ===`);const r=spawnSync(process.execPath,[file],{cwd:__dirname,stdio:'inherit'});out[name]=r.status===0;if(r.status!==0)ok=false;}
out.sprint413Ready=ok;out.fullRunReady=ok;fs.writeFileSync('execution-sprint4-13-results.json',JSON.stringify(out,null,2));
const report=`# EXPLOIT SPRINT 4.13 REPORT\n\n## Transfer Learning / Generalization Engine\n\n- Sprint 4.12 regression: ${out['Sprint 4.12 regression']?'PASS':'FAIL'}\n- Transfer-learning tests: ${out['Sprint 4.13 transfer learning']?'PASS':'FAIL'}\n- Snapshot contract: v5 (v1-v4 backward compatible)\n- Generalization tracking: ${ok?'READY':'NOT READY'}\n\n## FINAL VERDICT\n\nSPRINT 4.13 READY: ${ok?'YES':'NO'}\nFULL RUN READY: ${ok?'YES':'NO'}\nCAN START SPRINT 4.14: ${ok?'YES':'NO'}\n`;
fs.writeFileSync('EXPLOIT_SPRINT_4_13_REPORT.md',report);console.log(`\nSPRINT 4.13 READY: ${ok?'YES':'NO'}`);process.exitCode=ok?0:1;
