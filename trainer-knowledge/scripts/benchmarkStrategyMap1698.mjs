/**
 * Benchmark Strategy Map on the real 1698 trainer dataset.
 * Prints JSON. Does not write junk artifacts into the repo.
 */
import { performance } from 'node:perf_hooks';
import { resetTrainerCache, listCharts } from '../../trainer-knowledge/lookup.js';
import { adaptTrainerLibrary, adaptTrainerChartById } from '../../range-learning/trainerLibrary.js';
import { StrategyMapEngine, buildRangeFingerprint } from '../../strategy-map/index.js';
import {
  serializeStructuralIndex,
  writeStructuralCache,
  readStructuralCache
} from '../../range-learning/strategyMapCache.js';
import { resetProductionStrategyMap, getTrainerStrategyMap, neighborsForRange } from '../../range-learning/strategyMapRuntime.js';

function ms(t0) { return performance.now() - t0; }

resetTrainerCache();
const charts = listCharts();
const mem0 = process.memoryUsage().heapUsed;

const tAdapt1 = performance.now();
adaptTrainerChartById(charts[0].id);
const adaptOneMs = ms(tAdapt1);

const tAdapt = performance.now();
const { adapted, failed } = adaptTrainerLibrary(charts);
const adaptAllMs = ms(tAdapt);

const tFp = performance.now();
const fps = new Map();
for (const r of adapted) fps.set(r.id, buildRangeFingerprint(r));
const fingerprintAllMs = ms(tFp);

const tIndex = performance.now();
const engine = new StrategyMapEngine();
engine.loadLibrary(adapted);
const indexCreateMs = ms(tIndex);

let fullGraphMs = null;
if (adapted.length <= 80) {
  const tG = performance.now();
  engine.curriculum({ allowFullGraph: true });
  fullGraphMs = ms(tG);
} else {
  fullGraphMs = 'skipped_offline_only_for_1698';
}

const payload = serializeStructuralIndex({
  version: 'bench',
  fingerprints: fps,
  metadata: new Map(adapted.map((r) => [r.id, r.metadata])),
  stats: { adapted: adapted.length }
});
const tSer = performance.now();
const json = JSON.stringify(payload);
const serializeMs = ms(tSer);
const cacheBytes = Buffer.byteLength(json);

writeStructuralCache(payload);
const tHydra = performance.now();
readStructuralCache();
const hydrateReadMs = ms(tHydra);

resetProductionStrategyMap();
const tColdBuild = performance.now();
getTrainerStrategyMap({ force: true, persist: true });
const coldBuildMs = ms(tColdBuild);

resetProductionStrategyMap();
const tHydraEngine = performance.now();
const hydrated = getTrainerStrategyMap({ persist: true });
const hydrateEngineMs = ms(tHydraEngine);

const sampleId = charts.find((c) => c.id.startsWith('UO_'))?.id || charts[0].id;
const tCold = performance.now();
neighborsForRange(sampleId, { maxResults: 5, minSimilarity: 0.1 });
const neighborColdMs = ms(tCold);
const tWarm = performance.now();
neighborsForRange(sampleId, { maxResults: 5, minSimilarity: 0.1 });
const neighborWarmMs = ms(tWarm);

const mem1 = process.memoryUsage().heapUsed;

const report = {
  charts: charts.length,
  adapted: adapted.length,
  failed: failed.length,
  adaptOneMs,
  adaptAllMs,
  fingerprintAllMs,
  indexCreateMs,
  fullGraphMs,
  serializeMs,
  cacheBytes,
  hydrateReadMs,
  coldBuildMs,
  hydrateEngineMs,
  hydratedFromCache: hydrated.hydrated === true,
  hydrateSourceCount: hydrated.sourceCount,
  neighborColdMs,
  neighborWarmMs,
  heapDeltaMB: (mem1 - mem0) / 1048576,
  interactionSafe: neighborColdMs < 1000 && neighborWarmMs < 500
};
console.log(JSON.stringify(report, null, 2));
