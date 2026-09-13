#!/usr/bin/env node
/**
 * Compact Batch 2 hand records into sharded JSON for lazy lookup.
 * Input:  data/trainer/built/batch2-parsed-hands.json
 * Output: data/trainer/built/batch2-shards/shard-NNN.json
 *         data/trainer/built/batch2-shard-index.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const BUILT = join(ROOT, 'data/trainer/built');
const PARSED = join(BUILT, 'batch2-parsed-hands.json');
const SHARD_DIR = join(BUILT, 'batch2-shards');
const SHARD_SIZE = 50;

function compactHand(cell) {
  const out = {
    a: cell.actionRaw ?? null,
    d: cell.dataStatus || 'NEEDS_CLARIFICATION',
    g: cell.gradingAllowed ? 1 : 0,
    p: cell.parsingStatus || 'PARSED',
    m: cell.isMixed ? 1 : 0
  };
  if (cell.isMixed && Array.isArray(cell.strategies) && cell.strategies.length > 1) {
    out.s = cell.strategies.map((st) => ({
      a: st.rawAction,
      f: st.frequency,
      t: st.frequencyType === 'EXACT' ? 'E' : 'V',
      g: st.gradingAllowed ? 1 : 0
    }));
  }
  return out;
}

function main() {
  if (!existsSync(PARSED)) {
    console.warn('batch2-parsed-hands.json missing — skip shard build');
    return;
  }
  const data = JSON.parse(readFileSync(PARSED, 'utf8'));
  const chartEntries = Object.entries(data.charts || {}).sort((a, b) => a[0].localeCompare(b[0]));
  mkdirSync(SHARD_DIR, { recursive: true });

  const shardIndex = {};
  let shardNum = 0;
  let totalBytes = 0;

  for (let i = 0; i < chartEntries.length; i += SHARD_SIZE) {
    const slice = chartEntries.slice(i, i + SHARD_SIZE);
    const shardId = `shard-${String(shardNum).padStart(3, '0')}`;
    const charts = {};
    for (const [chartId, chart] of slice) {
      shardIndex[chartId] = shardId;
      const hands = {};
      for (const [hand, cell] of Object.entries(chart.hands || {})) {
        hands[hand] = compactHand(cell);
      }
      charts[chartId] = {
        id: chartId,
        ps: chart.parseStatus,
        st: chart.parseStats || null,
        sh: chart.sourceHash,
        sf: chart.sourceFilename,
        sm: chart.sourceMode,
        h: hands
      };
    }
    const payload = JSON.stringify({ charts });
    const outPath = join(SHARD_DIR, `${shardId}.json`);
    writeFileSync(outPath, payload);
    totalBytes += payload.length;
    shardNum += 1;
  }

  const indexPayload = {
    shardCount: shardNum,
    chartsPerShard: SHARD_SIZE,
    chartToShard: shardIndex,
    totalCharts: chartEntries.length,
    totalShardBytes: totalBytes,
    totalShardMB: Math.round((totalBytes / 1_048_576) * 100) / 100
  };
  writeFileSync(join(BUILT, 'batch2-shard-index.json'), JSON.stringify(indexPayload, null, 2));
  console.log(JSON.stringify(indexPayload, null, 2));
}

main();
