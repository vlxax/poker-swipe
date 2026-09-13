/**
 * Dual UO families are distinct datasets that share sourceMode 'uo':
 *   zip      — trusted production UO zip charts (ids UO_*, sourceGroup 'UO')
 *   bekhtold — BekhtOLD UO import charts (ids BL_uo-*, sourceGroup 'uo')
 *
 * Callers must not rely on silent preference. Dimension lookup without an
 * explicit family fails with AMBIGUOUS_UO_FAMILY when both families match.
 * Chart-id lookup is never ambiguous.
 */

export const UO_FAMILY = Object.freeze({
  ZIP: 'zip',
  BEKHTOLD: 'bekhtold'
});

export function chartUoFamily(chart) {
  if (!chart) return null;
  const id = String(chart.id || '');
  if (id.startsWith('UO_')) return UO_FAMILY.ZIP;
  if (id.startsWith('BL_uo')) return UO_FAMILY.BEKHTOLD;
  if (chart.sourceGroup === 'UO') return UO_FAMILY.ZIP;
  if (chart.sourceMode === 'uo' && chart.sourceGroup === 'uo') return UO_FAMILY.BEKHTOLD;
  return null;
}

export function idUoFamily(id) {
  const s = String(id || '');
  if (s.startsWith('UO_')) return UO_FAMILY.ZIP;
  if (s.startsWith('BL_uo')) return UO_FAMILY.BEKHTOLD;
  return null;
}

/**
 * Explicit family from a lookup query. null = unspecified.
 * sourceGroup 'UO' is zip; sourceGroup 'uo' / 'bekhtold' is BekhtOLD.
 */
export function resolveUoFamily(query = {}) {
  if (query.uoFamily === UO_FAMILY.ZIP || query.uoFamily === UO_FAMILY.BEKHTOLD) {
    return query.uoFamily;
  }
  if (query.sourceGroup === 'UO' || query.trainerSourceGroup === 'UO') return UO_FAMILY.ZIP;
  if (
    query.sourceGroup === 'uo' ||
    query.sourceGroup === 'bekhtold' ||
    query.trainerSourceGroup === 'uo' ||
    query.trainerSourceGroup === 'bekhtold'
  ) {
    return UO_FAMILY.BEKHTOLD;
  }
  const fromId = idUoFamily(query.chartId || query.id);
  if (fromId) return fromId;
  return null;
}

export function isUoShapedQuery(query = {}) {
  if (resolveUoFamily(query)) return true;
  if (query.sourceMode === 'uo') return true;
  if (String(query.rawSpot || '').toUpperCase() === 'UO') return true;
  return false;
}

export function filterChartsByUoFamily(charts, family) {
  if (!family) return charts;
  return (charts || []).filter((c) => chartUoFamily(c) === family);
}

/**
 * After family-neutral scoring, both families at a competitive score is unsafe.
 */
export function findAmbiguousUoPair(ranked, query = {}, options = {}) {
  const family = resolveUoFamily(query);
  if (family) return null;
  if (!isUoShapedQuery(query)) return null;
  const minScore = options.minScore ?? 40;
  const maxGap = options.maxGap ?? 15;
  const zipBest = (ranked || []).find((r) => chartUoFamily(r.chart) === UO_FAMILY.ZIP);
  const blBest = (ranked || []).find((r) => chartUoFamily(r.chart) === UO_FAMILY.BEKHTOLD);
  if (!zipBest || !blBest) return null;
  if (Math.min(zipBest.score, blBest.score) < minScore) return null;
  if (Math.abs(zipBest.score - blBest.score) > maxGap) return null;
  return { zip: zipBest, bekhtold: blBest };
}
