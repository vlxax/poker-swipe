#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readIndexHtml } from './pokerTruthUtils.mjs';

const OUT = path.join(ROOT, 'solver/tests/xrayAuthority.report.json');

export function runXrayAuthorityGuards({ write = true } = {}) {
  const html = readIndexHtml();
  const xrStart = html.indexOf('const XR=[');
  const xrEnd = html.indexOf('];let xrI=0', xrStart);
  const xrBlock = xrStart >= 0 ? html.slice(xrStart, xrEnd + 2) : '';

  const checks = {
    usesLocalXrArray: xrBlock.startsWith('const XR=['),
    noReferenceRangesPackInXray: !/referenceRangesPack|referenceRanges\.js/.test(xrBlock),
    noAbandonedCommitMarkers: !/d998174|52a2a50|hands-import-port-main/.test(html),
    gradingIsFeatureLocal:
      /function weightedScore|function xrBegin|function renderXray/.test(html) &&
      !/gradeAnswer|gradingGateway|referenceRangesPack/.test(xrBlock)
  };

  const pass = Object.values(checks).every(Boolean);
  const report = {
    generatedAt: new Date().toISOString(),
    authority: 'POSTFLOP_TEACHING (index.html XR[] teaching logic)',
    pass,
    checks,
    xraySpotCount: (xrBlock.match(/\{title:/g) || []).length
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

export function assertXrayAuthorityOrExit() {
  const r = runXrayAuthorityGuards();
  if (!r.pass) {
    console.error('XRAY AUTHORITY GUARD FAILED', r.checks);
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, authority: r.authority, report: OUT }, null, 2));
}

if (process.argv[1]?.endsWith('xrayAuthorityGuards.mjs')) {
  assertXrayAuthorityOrExit();
}
