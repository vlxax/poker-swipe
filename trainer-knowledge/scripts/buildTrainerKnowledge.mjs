#!/usr/bin/env node
/**
 * Build trainer knowledge layer from source manifests + UO normalized JSON.
 * Run: node trainer-knowledge/scripts/buildTrainerKnowledge.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import { actionGradingStatus, TRAINER_STATUS } from '../status.js';
import { parseTrainerPosition } from '../positionParser.js';
import { mapTrainerSpot } from '../spotMapper.js';
import { trainerProvenance } from '../provenance.js';
import { parseTrainerStack } from '../stackParser.js';
import {
  detectTrainerBrainConflicts,
  loadPokerBrainPackFromStrategyFile
} from '../conflictDetector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const SOURCE = join(ROOT, 'data/trainer/source');
const BUILT = join(ROOT, 'data/trainer/built');
const INDEX_DIR = join(BUILT, 'indexes');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const vals = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) {
        vals.push(cur);
        cur = '';
      } else cur += ch;
    }
    vals.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (vals[i] || '').trim();
    });
    return row;
  });
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function buildUoRecords(uoNormalized, uoFlat) {
  const charts = [];
  const handRecords = [];

  for (const chart of uoNormalized.charts || []) {
    const heroPosition = parseTrainerPosition(chart.position);
    const spot = mapTrainerSpot({ sourceMode: 'uo', rawSpot: 'UO', sourceGroup: 'UO' });

    const chartRec = {
      id: chart.id,
      dataset: 'UO_batch_1',
      sourceGroup: 'UO',
      sourceMode: 'uo',
      spot,
      heroPosition,
      opponentPosition: { type: 'UNKNOWN', values: [], raw: null },
      stack: { type: 'BAND', raw: chart.stack_bb, values: [chart.stack_bb] },
      betSize: { raw: null },
      openSize: { raw: null },
      handRecordCount: 169,
      dataStatus: TRAINER_STATUS.EXACT_TRAINER_DATA,
      provenance: trainerProvenance({
        dataset: 'UO_batch_1',
        sourceFile: chart.source_file,
        sourceHash: chart.source_sha256?.slice(0, 12),
        chartId: chart.id,
        originalSha256: chart.source_sha256,
        parserStatus: 'VERIFIED_BY_COLOR_GRID'
      }),
      legendMapping: chart.legend_mapping || null
    };
    charts.push(chartRec);

    for (const [actionRaw, block] of Object.entries(chart.actions || {})) {
      for (const hand of block.hands || []) {
        const dataStatus = actionGradingStatus(actionRaw);
        handRecords.push({
          chartId: chart.id,
          hand,
          actionRaw,
          dataStatus,
          gradingAllowed: dataStatus === TRAINER_STATUS.EXACT_TRAINER_DATA,
          stackBand: chart.stack_bb,
          position: chart.position,
          sourceGroup: 'UO',
          provenance: chartRec.provenance
        });
      }
    }
  }

  // Also ingest flat CSV for parser_status traceability
  for (const row of uoFlat) {
    const existing = handRecords.find(
      (r) => r.chartId === `UO_${row.stack_bb}_${row.position}` && r.hand === row.hand
    );
    if (existing) {
      existing.sourceColor = row.source_color;
      existing.parserStatus = row.parser_status;
    }
  }

  return { charts, handRecords };
}

function buildBatch2Charts(manifestRows, batch2Parsed) {
  const parsedCharts = batch2Parsed?.charts || {};
  const charts = [];

  for (const row of manifestRows) {
    const heroPosition = parseTrainerPosition(row.position);
    const opponentPosition = parseTrainerPosition(row.opponent);
    const spot = mapTrainerSpot({ sourceMode: row.source_mode, rawSpot: row.spot });

    const parsed = parsedCharts[row.chart_id];
    const hasParsedHands = parsed && Object.keys(parsed.hands || {}).length === 169;
    const parseStats = parsed?.parseStats;
    const parseStatus = parsed?.parseStatus || null;

    let dataStatus = TRAINER_STATUS.PARTIAL_TRAINER_DATA;
    if (parseStatus === 'SUCCESS' && hasParsedHands) {
      dataStatus = TRAINER_STATUS.PARTIAL_TRAINER_DATA;
    } else if (parseStatus === 'FAILED') {
      dataStatus = TRAINER_STATUS.MISSING_TRAINER_DATA;
    }

    charts.push({
      id: row.chart_id,
      dataset: 'batch_2',
      sourceGroup: row.source_mode,
      sourceMode: row.source_mode,
      indexRaw: row.index_raw,
      spot,
      heroPosition,
      opponentPosition: opponentPosition.raw
        ? opponentPosition
        : { type: 'UNKNOWN', values: [], raw: row.opponent || null },
      stack: (() => {
        const semantics = parseTrainerStack(row.stack || '');
        return { type: semantics.type, raw: row.stack || null, semantics };
      })(),
      betSize: { raw: row.bet || null },
      openSize: { raw: row.open || null },
      image: {
        path: row.compressed_file,
        width: Number(row.image_width) || null,
        height: Number(row.image_height) || null,
        compressedSha256: row.compressed_sha256,
        originalSha256: row.original_sha256
      },
      handRecordCount: hasParsedHands ? 169 : 0,
      dataStatus,
      parseStats: parseStats || null,
      parseStatus,
      hasParsedHands: Boolean(hasParsedHands),
      provenance: trainerProvenance({
        dataset: 'batch_2',
        sourceFile: row.source_file,
        sourceHash: row.source_hash,
        chartId: row.chart_id,
        originalSha256: row.original_sha256,
        parserStatus: hasParsedHands ? 'WEBP_MATRIX_PARSED' : (parseStatus === 'FAILED' ? 'WEBP_PARSE_FAILED' : 'MANIFEST_ONLY')
      })
    });
  }

  return charts;
}

function buildIndexes(charts) {
  const byId = {};
  const bySpotRaw = {};
  const bySourceMode = {};
  const byStack = {};
  const byHeroPosition = {};

  for (const c of charts) {
    byId[c.id] = c.id;
    const spotKey = c.spot?.rawSpot || `(mode:${c.sourceMode})`;
    if (!bySpotRaw[spotKey]) bySpotRaw[spotKey] = [];
    bySpotRaw[spotKey].push(c.id);

    if (!bySourceMode[c.sourceMode]) bySourceMode[c.sourceMode] = [];
    bySourceMode[c.sourceMode].push(c.id);

    const stackKey = c.stack?.raw || 'unknown';
    if (!byStack[stackKey]) byStack[stackKey] = [];
    byStack[stackKey].push(c.id);

    const posKey = c.heroPosition?.raw || 'unknown';
    if (!byHeroPosition[posKey]) byHeroPosition[posKey] = [];
    byHeroPosition[posKey].push(c.id);
  }

  return { byId, bySpotRaw, bySourceMode, byStack, byHeroPosition };
}

function collectUnmappedSpots(charts) {
  const map = new Map();
  for (const c of charts) {
    if (c.spot?.mapStatus === 'UNMAPPED_TRAINER_SPOT') {
      const key = c.spot.trainerCanonicalId;
      if (!map.has(key)) {
        map.set(key, {
          trainerCanonicalId: key,
          rawSpot: c.spot.rawSpot,
          sourceMode: c.sourceMode,
          chartCount: 0,
          exampleChartId: c.id
        });
      }
      map.get(key).chartCount += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.chartCount - a.chartCount);
}

function collectTermsToClarify(uoHands, charts) {
  const terms = [
    {
      term: 'UO',
      rawValue: 'UO',
      status: 'NEEDS_CLARIFICATION',
      note: 'Trainer dataset/spot label — meaning not expanded per SOURCE_NOTES.md'
    },
    {
      term: 'nAI',
      rawValue: 'nAI',
      status: 'NEEDS_CLARIFICATION',
      note: 'Legend label only — do not map to raise/non-all-in without trainer confirmation'
    },
    {
      term: 'UNSELECTED',
      rawValue: 'UNSELECTED',
      status: 'NEEDS_CLARIFICATION',
      note: 'Gray cell — NOT automatically fold'
    },
    {
      term: 'LOW_PLAYABILITY',
      rawValue: 'LOW_PLAYABILITY',
      status: 'NEEDS_CLARIFICATION',
      note: 'Truncated cyan legend "низкая плюсовость …"'
    },
    {
      term: 'AI',
      rawValue: 'AI',
      status: 'EXACT_TRAINER_DATA',
      note: 'Preserved all-in shorthand from trainer legend'
    },
    {
      term: 'RAISE',
      rawValue: 'RAISE',
      status: 'EXACT_TRAINER_DATA',
      note: 'Source legend "Рейз" in deeper UO stack bands'
    }
  ];

  const naiCount = uoHands.filter((h) => h.actionRaw === 'nAI').length;
  const unselCount = uoHands.filter((h) => h.actionRaw === 'UNSELECTED').length;
  const lowCount = uoHands.filter((h) => h.actionRaw === 'LOW_PLAYABILITY').length;

  terms.forEach((t) => {
    if (t.term === 'nAI') t.occurrences = naiCount;
    if (t.term === 'UNSELECTED') t.occurrences = unselCount;
    if (t.term === 'LOW_PLAYABILITY') t.occurrences = lowCount;
  });

  const batch2UnmappedColors = charts
    .filter((c) => c.dataset === 'batch_2' && c.parseStats)
    .reduce((sum, c) => sum + (c.parseStats.needsClarification || 0), 0);

  terms.push({
    term: 'WEBP_UNMAPPED_COLORS',
    rawValue: null,
    status: 'NEEDS_CLARIFICATION',
    occurrences: batch2UnmappedColors,
    note: 'Batch 2 cells where color could not be mapped to trainer action with confidence'
  });

  return terms;
}

function collectPositionGroups(charts) {
  const groups = new Map();
  for (const c of charts) {
    const hp = c.heroPosition;
    if (!hp || hp.type === 'SINGLE' || hp.type === 'UNKNOWN') continue;
    const key = `${hp.type}:${hp.raw}`;
    if (!groups.has(key)) {
      groups.set(key, { type: hp.type, raw: hp.raw, values: hp.values, chartCount: 0 });
    }
    groups.get(key).chartCount += 1;
  }
  return [...groups.values()].sort((a, b) => b.chartCount - a.chartCount);
}

function generateMarkdownReports({ terms, unmapped, conflicts, meta, positionGroups }) {
  const docsDir = join(ROOT, 'trainer-knowledge');

  const termsMd = [
    '# Trainer Terms To Clarify',
    '',
    'Labels preserved as-is. Do not infer semantics until confirmed by trainer.',
    '',
    '| Term | rawValue | Status | Occurrences | Note |',
    '|------|----------|--------|-------------|------|',
    ...terms.map(
      (t) =>
        `| ${t.term} | ${t.rawValue ?? '—'} | ${t.status} | ${t.occurrences ?? '—'} | ${t.note} |`
    )
  ].join('\n');

  const unmappedMd = [
    '# Trainer Unmapped Spots',
    '',
    `Total unmapped canonical spots: **${unmapped.length}**`,
    '',
    '| trainerCanonicalId | rawSpot | sourceMode | chartCount | example |',
    '|---------------------|---------|------------|------------|---------|',
    ...unmapped.map(
      (u) =>
        `| ${u.trainerCanonicalId} | ${u.rawSpot || '—'} | ${u.sourceMode} | ${u.chartCount} | ${u.exampleChartId} |`
    )
  ].join('\n');

  const conflictsMd = [
    '# Trainer Data Conflicts',
    '',
    'Trainer vs POKER_BRAIN_PACK — both versions preserved. Trainer wins only on EXACT semantic match.',
    '',
    `Total conflicts detected (UO RFI comparison sample): **${conflicts.length}**`,
    '',
    'Policy:',
    '- EXACT trainer match → source = TRAINER',
    '- No exact trainer data → existing Poker Brain / reference / heuristic with own provenance',
    '- Never present Poker Brain heuristic as trainer recommendation',
    '- PARTIAL trainer match → do not auto-replace existing strategy',
    '',
    conflicts.length
      ? [
          '| hand | position | stackBand | trainer | pokerBrain | atlasKey |',
          '|------|----------|-----------|---------|------------|----------|',
          ...conflicts.slice(0, 100).map(
            (c) =>
              `| ${c.hand} | ${c.position} | ${c.stackBand} | ${c.trainer.action} | ${c.pokerBrain.action} (${(c.pokerBrain.freq * 100).toFixed(0)}%) | ${c.pokerBrain.atlasKey} |`
          ),
          conflicts.length > 100 ? `\n_…and ${conflicts.length - 100} more in built/conflicts.json_` : ''
        ].join('\n')
      : '_No gradable conflicts in UO sample (or packs aligned on compared spots)._'
  ].join('\n');

  writeFileSync(join(docsDir, 'TRAINER_TERMS_TO_CLARIFY.md'), termsMd);
  writeFileSync(join(docsDir, 'TRAINER_UNMAPPED_SPOTS.md'), unmappedMd);
  writeFileSync(join(docsDir, 'TRAINER_DATA_CONFLICTS.md'), conflictsMd);
}

function main() {
  console.log('Building trainer knowledge layer...');
  mkdirSync(BUILT, { recursive: true });
  mkdirSync(INDEX_DIR, { recursive: true });

  const batch2Path = join(BUILT, 'batch2-parsed-hands.json');
  const forceReparse =
    process.env.FORCE_BATCH2_REPARSE === '1' || process.argv.includes('--reparse-batch2');

  // Parse batch2 WEBP (full 13×13 matrix) — skip unless forced; semantic updates use reapply only
  const parseScript = join(__dirname, 'parseBatch2Webp.py');
  if (forceReparse && existsSync(parseScript)) {
    console.log('Parsing Batch 2 WEBP charts (13×13 hand matrices)...');
    try {
      execSync(`python3 "${parseScript}"`, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
      console.warn('WEBP parse warning:', e.message);
    }
  } else if (existsSync(batch2Path)) {
    console.log('Skipping Batch 2 WEBP reparse — using existing batch2-parsed-hands.json');
  }

  const reapplyScript = join(__dirname, 'reapplyTrainerSemantics.mjs');
  if (existsSync(reapplyScript) && existsSync(batch2Path)) {
    console.log('Reapplying trainer semantic legend...');
    try {
      execSync(`node "${reapplyScript}"`, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
      console.warn('Semantic reapply warning:', e.message);
    }
  }

  const compactScript = join(__dirname, 'compactBatch2Shards.mjs');
  if (existsSync(compactScript)) {
    console.log('Building compact Batch 2 shards...');
    try {
      execSync(`node "${compactScript}"`, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
      console.warn('Shard compact warning:', e.message);
    }
  }

  const uoNormalized = readJson(join(SOURCE, 'UO_RANGES_NORMALIZED.json'));
  const uoFlat = readCsv(join(SOURCE, 'UO_RANGES_FLAT.csv'));
  const manifestRows = readCsv(join(SOURCE, 'RANGE_CHART_MANIFEST.csv'));
  const datasetSummary = readJson(join(SOURCE, 'DATASET_SUMMARY.json'));

  let batch2Parsed = { charts: {} };
  if (existsSync(batch2Path)) {
    batch2Parsed = readJson(batch2Path);
  }

  const { charts: uoCharts, handRecords: uoHands } = buildUoRecords(uoNormalized, uoFlat);
  const batch2Charts = buildBatch2Charts(manifestRows, batch2Parsed);
  const allCharts = [...uoCharts, ...batch2Charts];
  const indexes = buildIndexes(allCharts);

  const unmappedSpots = collectUnmappedSpots(allCharts);
  const termsToClarify = collectTermsToClarify(uoHands, allCharts);
  const positionGroups = collectPositionGroups(allCharts);

  let conflicts = [];
  try {
    const pack = loadPokerBrainPackFromStrategyFile();
    conflicts = detectTrainerBrainConflicts({ uoHands, pokerBrainPack: pack });
  } catch (e) {
    console.warn('Conflict detection skipped:', e.message);
  }

  let batch2ParseReport = null;
  const batch2ReportPath = join(BUILT, 'batch2-parse-report.json');
  if (existsSync(batch2ReportPath)) {
    batch2ParseReport = readJson(batch2ReportPath);
  }
  const semanticReportPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_REAPPLY_REPORT.json');
  const semanticReport = existsSync(semanticReportPath) ? readJson(semanticReportPath) : null;
  const batch2GradingAllowed =
    semanticReport?.after?.grading ?? batch2ParseReport?.gradingAllowedCells ?? 0;
  const batch2NeedsClarification =
    semanticReport?.after?.needsClarification ?? batch2ParseReport?.needsClarificationCells ?? 0;

  const stats = {
    totalCharts: allCharts.length,
    uoCharts: uoCharts.length,
    batch2Charts: batch2Charts.length,
    uoHandRecords: uoHands.length,
    batch2HandRecords: batch2ParseReport?.handCellsTotal || batch2Charts.filter((c) => c.hasParsedHands).length * 169,
    batch2ChartsParsed: batch2ParseReport?.chartsSuccessfullyParsed || batch2Charts.filter((c) => c.hasParsedHands).length,
    batch2ChartsFailed: batch2ParseReport?.chartsFailed || 0,
    batch2MixedCells: batch2ParseReport?.mixedCells || 0,
    batch2GradingAllowedCells: batch2GradingAllowed,
    batch2NeedsClarificationCells: batch2NeedsClarification,
    exactlyParsed: uoHands.filter((h) => h.dataStatus === TRAINER_STATUS.EXACT_TRAINER_DATA).length,
    needsClarification: uoHands.filter((h) => h.dataStatus === TRAINER_STATUS.NEEDS_CLARIFICATION).length,
    partialCharts: allCharts.filter((c) => c.dataStatus === TRAINER_STATUS.PARTIAL_TRAINER_DATA).length,
    unmappedSpotCount: unmappedSpots.length,
    positionGroupCount: positionGroups.length,
    conflictCount: conflicts.length,
    batch2DatasetSizeMB: batch2ParseReport?.datasetSizeMB || null
  };

  const meta = {
    builtAt: new Date().toISOString(),
    datasetSummary,
    stats,
    batch2ParseReport,
    unmappedSpots,
    termsToClarify,
    positionGroups,
    sourceTraceability: {
      uoArchiveSha256: readFileSync(join(SOURCE, 'ORIGINAL_SOURCE_SHA256.txt'), 'utf8').trim(),
      batch2ArchiveSha256: datasetSummary.original_archive_sha256
    }
  };

  writeJson(join(BUILT, 'charts-index.json'), allCharts);
  writeJson(join(BUILT, 'uo-hand-records.json'), uoHands);
  writeJson(join(BUILT, 'meta.json'), meta);
  writeJson(join(BUILT, 'conflicts.json'), conflicts);
  writeJson(join(INDEX_DIR, 'by-id.json'), indexes.byId);
  writeJson(join(INDEX_DIR, 'by-spot-raw.json'), indexes.bySpotRaw);
  writeJson(join(INDEX_DIR, 'by-source-mode.json'), indexes.bySourceMode);
  writeJson(join(INDEX_DIR, 'by-stack.json'), indexes.byStack);
  writeJson(join(INDEX_DIR, 'by-hero-position.json'), indexes.byHeroPosition);

  generateMarkdownReports({ terms: termsToClarify, unmapped: unmappedSpots, conflicts, meta, positionGroups });

  console.log('\nBuild complete:', JSON.stringify(stats, null, 2));
}

main();
