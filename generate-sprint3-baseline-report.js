const fs=require('fs');function j(f){return JSON.parse(fs.readFileSync(f,'utf8'));}const e=j('execution-results.json'),p=j('placeholder-results.json'),s=j('syntax-results.json'),f=j('fixture-semantics-results.json'),i=j('invalid-input-results.json'),b=j('bestfive-results.json'),d=j('draw-results.json'),bc=j('boardchange-results.json'),a=j('adversarial-results.json'),ga=j('generation-results-runA.json'),gb=j('generation-results-runB.json');let ar=null;try{ar=j('artifact-results.json');}catch{}
const md=`# EXPLOIT SPRINT 3.2.5b REPORT

## EXECUTION

| Parameter | Value |
|---|---|
| Start | ${e.startTime} |
| End | ${e.endTime} |
| Seed | ${e.seed} |
| SPRINT 3.2 READY | ${e.sprint32Ready?'✅ YES':'❌ NO'} |
| FULL RUN READY | ${e.fullRunReady?'✅ YES':'❌ NO'} |

## TEST SUITES

| Suite | PASS | FAIL | Ready |
|---|---:|---:|---|
| Placeholder | ${p.pass} | ${p.fail} | ${e.placeholderReady?'✅':'❌'} |
| Syntax | ${s.pass} | ${s.fail} | ${e.syntaxReady?'✅':'❌'} |
| Fixture semantics | ${f.pokerFixtures.correct} | ${f.pokerFixtures.wrongExpectation+f.pokerFixtures.invalidFixture+f.boardChange.fail} | ${e.fixtureReady?'✅':'❌'} |
| Invalid input | ${i.pass} | ${i.fail} | ${e.invalidReady?'✅':'❌'} |
| Best-five | ${b.pass} | ${b.fail} | ${e.bestfiveReady?'✅':'❌'} |
| Draw | ${d.pass} | ${d.fail} | ${e.drawReady?'✅':'❌'} |
| Board change | ${bc.pass} | ${bc.fail} | ${e.boardReady?'✅':'❌'} |
| Adversarial | ${a.pass} | ${a.fail} | ${e.advReady?'✅':'❌'} |

## GENERATION

| Parameter | Run A | Run B |
|---|---:|---:|
| Requested | ${ga.requested} | ${gb.requested} |
| Returned | ${ga.returned} | ${gb.returned} |
| Validated | ${ga.validated} | ${gb.validated} |
| Coverage | ${(ga.globalCoverage*100).toFixed(1)}% | ${(gb.globalCoverage*100).toFixed(1)}% |
| Per-rule coverage | ${ga.perRuleCoverageReady?'✅':'❌'} | ${gb.perRuleCoverageReady?'✅':'❌'} |
| Hash | ${ga.canonicalHash} | ${gb.canonicalHash} |

## GATES

| Gate | Status |
|---|---|
| Poker correctness | ${e.pokerCorrectnessReady?'✅':'❌'} |
| Determinism | ${e.determinismReady?'✅':'❌'} |
| RNG | ${e.rngReady?'✅':'❌'} |
| Freshness | ${e.freshnessReady?'✅':'❌'} |
| Report Artifact | ${e.reportReady?'✅':'❌'} |

## FINAL VERDICT

| Parameter | Status |
|---|---|
| SPRINT 3.2 READY | ${e.sprint32Ready?'✅ YES':'❌ NO'} |
| FULL RUN READY | ${e.fullRunReady?'✅ YES':'❌ NO'} |
| CAN START SPRINT 4 | ${e.fullRunReady?'✅ YES':'❌ NO'} |

Artifact state at generation time: ${ar?JSON.stringify(ar):'not yet written'}.
`;fs.writeFileSync('EXPLOIT_SPRINT_3_2_5_REPORT.md',md);console.log('Report generated');
