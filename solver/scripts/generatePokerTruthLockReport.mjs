#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './pokerTruthUtils.mjs';
import { runPokerPackDrift } from './pokerPackDrift.mjs';
import { runDailyTruthPaths } from './dailyTruthPaths.mjs';
import { runSwipeTruthPaths } from './swipeTruthPaths.mjs';
import { runPushFoldEquivalence } from './pushFoldEquivalence.mjs';
import { runProvenanceLabelAudit } from './pokerProvenanceLabelAudit.mjs';
import { runDomainMisuseGuards } from './pokerDomainMisuseGuards.mjs';
import { runXrayAuthorityGuards } from './xrayAuthorityGuards.mjs';

const OUT = path.join(ROOT, 'POKER_TRUTH_ARCHITECTURE_LOCK.md');

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

export function generateLockReport({ write = true } = {}) {
  const pack = runPokerPackDrift({ write: true });
  const daily = runDailyTruthPaths({ write: true });
  const swipe = runSwipeTruthPaths({ write: true });
  const push = runPushFoldEquivalence({ write: true });
  const prov = runProvenanceLabelAudit({ write: true });
  const misuse = runDomainMisuseGuards({ write: true });
  const xray = runXrayAuthorityGuards({ write: true });

  const metrics = {
    PACK_DRIFT: pack.diffCount,
    DAILY_TRUE_CONFLICTS: daily.trueConflicts,
    SWIPE_TRUE_CONFLICTS: swipe.trueConflicts,
    PUSHFOLD_DIVERGENCES: push.midStage?.divergences ?? push.totalDivergenceRecords,
    PROVENANCE_MISLEADING: prov.misleadingCount,
    DOMAIN_MISUSE_VIOLATIONS: misuse.violationCount,
    XRAY_AUTHORITY: xray.pass ? 'LOCAL_XR_TEACHING' : 'VIOLATION'
  };

  const issues = [];
  if (metrics.PACK_DRIFT > 0) issues.push({ priority: 'P0', item: 'Inline POKER_BRAIN_PACK drift vs strategy_pack_v17.js' });
  if (metrics.DAILY_TRUE_CONFLICTS > 0) {
    issues.push({
      priority: 'P0',
      item: `Daily calendar dual-truth conflicts (${daily.conflictIds.join(', ')})`
    });
  }
  if (metrics.SWIPE_TRUE_CONFLICTS > 0) {
    issues.push({
      priority: 'P0',
      item: `Swipe preferred vs runtime brain conflicts (${swipe.conflictIds.join(', ')})`
    });
  }
  if (push.stageAdjustedDivergences > 0) {
    issues.push({
      priority: 'P1',
      item: 'pushFold.js omits push18 tournament stage bands (BUBBLE/FT)'
    });
  }
  if (metrics.PROVENANCE_MISLEADING > 0) issues.push({ priority: 'P1', item: 'User-facing GTO/solver labels without provenance' });
  if (metrics.DOMAIN_MISUSE_VIOLATIONS > 0) issues.push({ priority: 'P0', item: 'Domain misuse guard violations' });
  if (!xray.pass) issues.push({ priority: 'P0', item: 'XRAY authority guard failure' });

  const p0 = issues.filter((i) => i.priority === 'P0');
  const verdict =
    p0.length === 0
      ? metrics.DAILY_TRUE_CONFLICTS + metrics.SWIPE_TRUE_CONFLICTS > 0
        ? 'ARCHITECTURE LOCKED WITH KNOWN CONFLICTS'
        : 'ARCHITECTURE LOCKED'
      : metrics.PACK_DRIFT > 0 || !xray.pass || misuse.violationCount > 0
        ? 'NOT LOCKED'
        : 'ARCHITECTURE LOCKED WITH KNOWN CONFLICTS';

  const md = `# Poker truth architecture lock

Generated: ${new Date().toISOString()}

## Metrics

| Metric | Value |
|--------|------:|
| PACK_DRIFT | ${metrics.PACK_DRIFT} |
| DAILY_TRUE_CONFLICTS | ${metrics.DAILY_TRUE_CONFLICTS} |
| SWIPE_TRUE_CONFLICTS | ${metrics.SWIPE_TRUE_CONFLICTS} |
| PUSHFOLD_DIVERGENCES (MID stage) | ${push.midStage?.divergences ?? 'n/a'} |
| PUSHFOLD stage-adjusted divergence records | ${push.stageAdjustedDivergences ?? 'n/a'} |
| PROVENANCE_MISLEADING | ${metrics.PROVENANCE_MISLEADING} |
| DOMAIN_MISUSE_VIOLATIONS | ${metrics.DOMAIN_MISUSE_VIOLATIONS} |
| XRAY_AUTHORITY | ${metrics.XRAY_AUTHORITY} |

## Daily conflict IDs

${daily.conflictIds.length ? daily.conflictIds.map((id) => `- \`${id}\``).join('\n') : '_none_'}

## Swipe conflict IDs

${swipe.conflictIds.length ? swipe.conflictIds.map((id) => `- \`${id}\``).join('\n') : '_none_'}

## Remaining issues

${issues.length ? issues.map((i) => `- **${i.priority}**: ${i.item}`).join('\n') : '_No tracked issues._'}

## Verdict

**${verdict}**

## Next implementation task

Wire \`solver/config/pokerTruthDomains.json\` into grading gateway routing (read-only registry today), and add a single runtime pack loader so \`strategy_pack_v17.js\` is the only authoritative pack source (remove inline duplicate after drift CI stays green for one release).
`;

  if (write) fs.writeFileSync(OUT, md);
  return { metrics, verdict, dailyConflictIds: daily.conflictIds, swipeConflictIds: swipe.conflictIds };
}

if (process.argv[1]?.endsWith('generatePokerTruthLockReport.mjs')) {
  const r = generateLockReport();
  console.log(JSON.stringify({ path: OUT, metrics: r.metrics, verdict: r.verdict }, null, 2));
}
