'use strict';
const fs=require('fs');const path=require('path');
function read(f){return JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'))}
const exec=read('execution-sprint4-5-results.json'),a=read('sprint4-5-mass-runA.json'),b=read('sprint4-5-mass-runB.json');
const md=`# EXPLOIT SPRINT 4.5 REPORT

## Цель
Персонализация Exploit Training: настройка соперника/улицы/сложности, режим «Слабые места», прогресс по категориям и расширенный экран итогов.

## GATES

| Gate | Status |
|---|---|
| Sprint 4.4 regression | ${exec.regression?'✅':'❌'} |
| Syntax | ${exec.syntax?'✅':'❌'} |
| Profile | ${exec.profile?'✅':'❌'} |
| Progress | ${exec.progress?'✅':'❌'} |
| Navigation | ${exec.navigation?'✅':'❌'} |
| Public contract | ${exec.contract?'✅':'❌'} |
| Mass A | ${exec.massA?'✅':'❌'} |
| Mass B | ${exec.massB?'✅':'❌'} |
| Determinism | ${exec.determinism?'✅':'❌'} |

## MASS

| Run | Sessions | Tasks | Errors | Leaks | Restores | Hash |
|---|---:|---:|---:|---:|---:|---|
| A | ${a.sessions} | ${a.tasks} | ${a.errors} | ${a.leaks} | ${a.restores} | ${a.hash} |
| B | ${b.sessions} | ${b.tasks} | ${b.errors} | ${b.leaks} | ${b.restores} | ${b.hash} |

## FINAL VERDICT

| Parameter | Status |
|---|---|
| SPRINT 4.5 READY | ${exec.sprint45Ready?'✅ YES':'❌ NO'} |
| FULL RUN READY | ${exec.sprint45Ready?'✅ YES':'❌ NO'} |
| CAN START SPRINT 4.6 | ${exec.sprint45Ready?'✅ YES':'❌ NO'} |
`;
fs.writeFileSync('EXPLOIT_SPRINT_4_5_REPORT.md',md);console.log('✅ EXPLOIT_SPRINT_4_5_REPORT.md');
