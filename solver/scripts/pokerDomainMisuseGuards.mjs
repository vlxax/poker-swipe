#!/usr/bin/env node
/**
 * Static CI guards for poker truth domain misuse (regex / path rules).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './pokerTruthUtils.mjs';

const OUT = path.join(ROOT, 'solver/tests/pokerDomainMisuseViolations.report.json');

function read(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function grepFiles(dir, pattern, globExt = '.js') {
  const hits = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(full);
      } else if (ent.name.endsWith(globExt) || ent.name.endsWith('.mjs')) {
        const txt = fs.readFileSync(full, 'utf8');
        if (pattern.test(txt)) hits.push(path.relative(ROOT, full));
      }
    }
  }
  walk(path.join(ROOT, dir));
  return hits;
}

export function runDomainMisuseGuards({ write = true } = {}) {
  const violations = [];

  const gradingGateway = read('training-ui/gradingGateway.js');
  const modeAdapters = read('solver/src/api/modeAdapters.js');
  const answerEval = read('solver/src/training/answerEvaluator.js');
  if (/referenceRangesPack|referenceRanges\.js/.test(gradingGateway + modeAdapters + answerEval)) {
    violations.push({
      rule: 'referenceRangesPack_must_not_grade_stack_specific',
      detail: 'referenceRangesPack imported into production grading path'
    });
  }

  const libraryDrill = read('solver/src/training/libraryDrill.js');
  const taskBridge = read('solver/src/training/taskLibraryBridge.js');
  if (/task\.correct\s*=|alsoOk\s*=\s*\[/.test(libraryDrill + taskBridge)) {
    violations.push({
      rule: 'library_correct_must_not_be_overwritten_by_brain',
      detail: 'library task fields mutated in training bridge'
    });
  }

  const handEval = read('solver/src/cards/handEvaluator.js');
  if (/gradeDecision|POKER_BRAIN|recommendedAction|preflop\[/.test(handEval)) {
    violations.push({
      rule: 'equity_not_strategy_recommendation',
      detail: 'hand evaluator imports strategy recommendation paths'
    });
  }

  const index = read('index.html');
  const xrayBlock = index.slice(index.indexOf('/* XRAY'), index.indexOf('function renderXray') + 500);
  if (/referenceRangesPack|referenceRanges\.js/.test(xrayBlock)) {
    violations.push({
      rule: 'xray_must_not_use_reference_ranges_grading',
      detail: 'XRAY block references referenceRangesPack'
    });
  }

  if (/d998174|52a2a50|hands-import-port-main/.test(index)) {
    violations.push({
      rule: 'xray_abandoned_branch_activation',
      detail: 'index.html contains markers from abandoned hands-import XRAY commits'
    });
  }

  const pushFold = read('ranges-ui/pushFold.js');
  const pushFoldUi = read('ranges-ui/rangeSources.js');
  if (/solverVerified|CFR|Nash equilibrium|GTO Wizard dump/i.test(pushFold + pushFoldUi)) {
    violations.push({
      rule: 'pushfold_provenance_honesty',
      detail: 'push/fold represented as solver-backed without provenance'
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    violationCount: violations.length,
    pass: violations.length === 0,
    violations
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

export function assertDomainMisuseGuardsOrExit() {
  const r = runDomainMisuseGuards();
  if (!r.pass) {
    console.error('DOMAIN MISUSE GUARDS FAILED');
    console.error(JSON.stringify(r.violations, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, report: OUT }, null, 2));
}

if (process.argv[1]?.endsWith('pokerDomainMisuseGuards.mjs')) {
  assertDomainMisuseGuardsOrExit();
}
