// Trainer-backed narrowing lessons — one verified open chart per lesson.

import { getBattleshipCatalog, findCourse, formatStackLabel } from '../battleship/courses.js';
import { loadRangeModel } from '../battleship/trainerRangeModel.js';

let _catalogPromise = null;

export async function getNarrowingCatalog() {
  if (!_catalogPromise) _catalogPromise = getBattleshipCatalog();
  return _catalogPromise;
}

export function lessonLabel(entry) {
  const stack = formatStackLabel(entry.stack);
  return `${entry.position} · ${stack}`;
}

export function actionLine(position) {
  return `${position} открыл 2.2 ББ`;
}

export async function loadLesson(entry) {
  const model = await loadRangeModel(entry.selection);
  if (!model.supported) return null;
  return {
    lessonId: entry.courseId,
    chartId: entry.chartId,
    position: entry.position,
    stack: entry.stack,
    label: lessonLabel(entry),
    actionLine: actionLine(entry.position),
    selection: entry.selection,
    model,
    anchorHand: null
  };
}

export function findLesson(catalog, lessonId) {
  return findCourse(catalog, lessonId);
}
