// Battleship course catalog — only trainer UO charts that pass eligibility gates.

import { ensureTrainerLookup, buildTrainerMatrixAsync } from '../trainerRanges.js';
import { MATCH_STATUS } from '../../trainer-knowledge/status.js';
import { buildRangeModelFromMatrix } from './trainerRangeModel.js';

const MIN_GRADABLE = 140;
const MAX_BLOCKED = 10;

const POSITION_ORDER = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'EP'];
const STACK_ORDER = ['2-4', '4-6', '6-8', '8-10', '10-12', '12-15', '15-18', '18-25', '25-40', '40+'];

let _catalogPromise = null;

function sortCourses(a, b) {
  const pi = POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);
  if (pi !== 0) return pi;
  return STACK_ORDER.indexOf(a.stack) - STACK_ORDER.indexOf(b.stack);
}

async function evaluateChart(chart, buildMatrix) {
  const selection = {
    dataSource: 'trainer',
    position: chart.heroPosition?.raw,
    stackBand: chart.stack?.raw,
    trainerSourceMode: 'uo',
    situation: 'uo_open'
  };
  const matrix = await buildMatrix(selection);
  if (matrix.matchStatus !== MATCH_STATUS.EXACT_TRAINER_MATCH) return null;
  const model = buildRangeModelFromMatrix(matrix);
  if (!model.supported) return null;
  if (model.gradable < MIN_GRADABLE || model.blocked > MAX_BLOCKED) return null;
  return {
    courseId: chart.id,
    chartId: chart.id,
    position: chart.heroPosition?.raw,
    stack: chart.stack?.raw,
    sourceMode: chart.sourceMode,
    rawSpot: chart.spot?.rawSpot || 'UO',
    provenance: chart.provenance,
    gradable: model.gradable,
    blocked: model.blocked,
    openCount: model.openSet.size,
    selection
  };
}

/** Node/test scan using explicit charts + sync matrix builder. */
export async function scanBattleshipCoursesNode(charts, buildMatrix) {
  const eligible = [];
  for (const chart of charts.filter((c) => c.sourceMode === 'uo')) {
    const row = await evaluateChart(chart, buildMatrix);
    if (row) eligible.push(row);
  }
  eligible.sort(sortCourses);
  return eligible;
}

/** Browser scan via trainer lookup + async matrix builder. */
export async function scanBattleshipCourses() {
  const lookup = await ensureTrainerLookup();
  const charts = (lookup.charts || []).filter((c) => c.sourceMode === 'uo');
  const eligible = [];
  for (const chart of charts) {
    const row = await evaluateChart(chart, (sel) => buildTrainerMatrixAsync(sel));
    if (row) eligible.push(row);
  }
  eligible.sort(sortCourses);
  return eligible;
}

export async function getBattleshipCatalog() {
  if (!_catalogPromise) _catalogPromise = scanBattleshipCourses();
  return _catalogPromise;
}

export function resetBattleshipCatalogCache() {
  _catalogPromise = null;
}

export function findCourse(catalog, courseId) {
  return (catalog || []).find((c) => c.courseId === courseId || c.chartId === courseId) || null;
}

export function formatStackLabel(stack) {
  if (!stack) return '—';
  if (stack.includes('-') || stack.includes('+')) return `${stack} ББ`;
  return `${stack} ББ`;
}
