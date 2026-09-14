import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(join(root, 'polyana/event-visibility.js'), 'utf8');

function loadVisibility() {
  const ctx = { window: {}, Date };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return ctx.window.PspEventVisibility;
}

const MSK_DAY = '2026-09-14';
const baseEvent = {
  date: MSK_DAY,
  time: '19:00',
  club: 'Test Club',
  tournament: 'NLH Deep',
};

test('event not started — active with status СКОРО', () => {
  const V = loadVisibility();
  const start = V.startDate(baseEvent);
  const now = +start - 60 * 60 * 1000;
  assert.equal(V.isActiveTodayEvent(baseEvent, now), true);
  assert.equal(V.eventJoinStatus(baseEvent, now), 'soon');
  assert.equal(V.statusLabel('soon'), 'СКОРО');
});

test('after start, late registration still open', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, late_reg_minutes: 60 };
  const start = V.startDate(e);
  const now = +start + 5 * 60 * 1000;
  assert.equal(V.isActiveTodayEvent(e, now), true);
  assert.equal(V.eventJoinStatus(e, now), 'late_reg');
});

test('late registration closed — removed from active today', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, late_reg_minutes: 30 };
  const lc = V.lateClose(e);
  const now = +lc + 1000;
  assert.equal(V.isActiveTodayEvent(e, now), false);
  assert.equal(V.eventJoinStatus(e, now), 'expired');
});

test('event ended (duration) without late reg metadata', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, duration_minutes: 120 };
  const end = V.eventEndDate(e);
  const now = +end + 1000;
  assert.equal(V.isActiveTodayEvent(e, now), false);
});

test('fallback window after start when only start time known', () => {
  const V = loadVisibility();
  const start = V.startDate(baseEvent);
  const inside = +start + V.FALLBACK_AFTER_START_MS - 1000;
  const outside = +start + V.FALLBACK_AFTER_START_MS + 1000;
  assert.equal(V.isActiveTodayEvent(baseEvent, inside), true);
  assert.equal(V.isActiveTodayEvent(baseEvent, outside), false);
});

test('moscow calendar day boundary — yesterday not active today', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, date: '2026-09-13' };
  const now = +new Date('2026-09-14T12:00:00+03:00');
  assert.equal(V.isScheduledToday(e, now), false);
  assert.equal(V.isActiveTodayEvent(e, now), false);
});

test('browser UTC vs Moscow — same instant on MSK today', () => {
  const V = loadVisibility();
  const mskToday = V.moscowCalendarDay(Date.UTC(2026, 8, 14, 20, 0, 0));
  const e = { ...baseEvent, date: mskToday };
  const now = Date.UTC(2026, 8, 14, 17, 0, 0);
  assert.equal(V.isScheduledToday(e, now), true);
});

test('filterActiveToday is canonical subset', () => {
  const V = loadVisibility();
  const start = V.startDate(baseEvent);
  const now = +start + V.FALLBACK_AFTER_START_MS + 5000;
  const list = [
    baseEvent,
    { ...baseEvent, time: '21:00', late_reg_minutes: 120 },
  ];
  const active = V.filterActiveToday(list, now);
  assert.equal(active.length, 1);
  assert.equal(active[0].time, '21:00');
});
