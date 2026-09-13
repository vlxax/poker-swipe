/**
 * Legacy B2_* chart ids → canonical BL_* reconstructed ids.
 * Browser-safe: no Node fs. Alias table is the committed JSON module.
 */

import aliasTable from '../data/trainer/built/b2-id-alias.json' with { type: 'json' };

let _alias = aliasTable;

export function loadB2AliasTable() {
  return _alias || { version: 1, b2ToCanonical: {}, canonicalToB2: {}, unresolved: [] };
}

export function resetB2AliasCache() {
  _alias = aliasTable;
}

export function setB2AliasTable(table) {
  _alias = table;
}

export function isLegacyB2Id(id) {
  return typeof id === 'string' && /^B2_\d+$/.test(id);
}

export function canonicalRangeId(id) {
  if (id == null || id === '') return id;
  const table = loadB2AliasTable();
  if (table.b2ToCanonical?.[id]) return table.b2ToCanonical[id];
  return id;
}

export function legacyB2IdsFor(canonicalId) {
  const table = loadB2AliasTable();
  const one = table.canonicalToB2?.[canonicalId];
  return one ? [one] : [];
}

export function resolveRangeId(id, options = {}) {
  const canonical = canonicalRangeId(id);
  const migrated = canonical !== id && isLegacyB2Id(id);
  if (isLegacyB2Id(id) && canonical === id) {
    if (options.strict) {
      throw new Error(`Unmapped legacy B2 id: ${id}`);
    }
    return { input: id, canonical: null, migrated: false, unresolved: true };
  }
  return { input: id, canonical, migrated, unresolved: false };
}

/**
 * Rewrite persisted Battleship / progress blobs that keyed rangeMastery or
 * courses by B2_* ids. Idempotent: already-canonical ids are left unchanged.
 */
export function migratePersistedRangeIds(data) {
  if (!data || typeof data !== 'object') return { data, changed: 0 };
  const table = loadB2AliasTable();
  const map = table.b2ToCanonical || {};
  let changed = 0;

  function remapKeyMap(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const next = {};
    for (const [key, value] of Object.entries(obj)) {
      const canon = map[key] || key;
      if (canon !== key) changed += 1;
      const existing = next[canon];
      next[canon] = existing && typeof existing === 'object' && typeof value === 'object'
        ? { ...existing, ...value }
        : value;
    }
    return next;
  }

  const out = { ...data };
  if (out.rangeMastery) out.rangeMastery = remapKeyMap(out.rangeMastery);
  if (out.courses) {
    const courses = {};
    for (const [courseId, course] of Object.entries(out.courses)) {
      const newCourseId = map[courseId] || courseId;
      if (newCourseId !== courseId) changed += 1;
      const chartId = course?.chartId ? (map[course.chartId] || course.chartId) : course?.chartId;
      if (chartId && chartId !== course.chartId) changed += 1;
      const prev = courses[newCourseId];
      courses[newCourseId] = prev
        ? { ...prev, ...course, courseId: newCourseId, chartId: chartId || prev.chartId }
        : { ...course, courseId: newCourseId, chartId };
    }
    out.courses = courses;
  }
  if (out.lastChartId && map[out.lastChartId]) {
    out.lastChartId = map[out.lastChartId];
    changed += 1;
  }
  if (out.lastCourseId && map[out.lastCourseId]) {
    out.lastCourseId = map[out.lastCourseId];
    changed += 1;
  }
  return { data: out, changed };
}
