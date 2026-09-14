// Lazy chart asset loader for GitHub web-upload build.
const CHUNK_SIZE = 25;
const CHUNK_COUNT = 64;
const cache = new Map();
function chartIndex(path){
  const m = String(path||'').match(/(\d{4})\.webp$/);
  return m ? Number(m[1]) : NaN;
}
export async function loadChartAsset(path){
  const n = chartIndex(path);
  if(!Number.isFinite(n)) return null;
  const chunk = Math.min(CHUNK_COUNT, Math.max(1, Math.ceil(n / CHUNK_SIZE)));
  if(!cache.has(chunk)){
    cache.set(chunk, import(`./chart-assets-${String(chunk).padStart(2,'0')}.js`));
  }
  const mod = await cache.get(chunk);
  return mod.CHART_ASSETS?.[path] || null;
}
