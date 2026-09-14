import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(join(root, 'polyana/event-visibility.js'), 'utf8');
const live = JSON.parse(readFileSync(join(root, 'data/live_polyana.json'), 'utf8'));

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

test('after start, late registration still open (minutes)', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, late_reg_minutes: 60 };
  const start = V.startDate(e);
  const now = +start + 5 * 60 * 1000;
  assert.equal(V.isActiveTodayEvent(e, now), true);
  assert.equal(V.eventJoinStatus(e, now), 'late_reg');
});

test('late registration from late_reg_until only (production shape)', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, late_reg_until: '22:00', late_reg_minutes: null };
  const lc = V.lateClose(e);
  assert.ok(lc);
  const now = +V.startDate(e) + 30 * 60 * 1000;
  assert.equal(V.eventJoinStatus(e, now), 'late_reg');
  assert.equal(V.isActiveTodayEvent(e, +lc + 1000), false);
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
  assert.equal(V.eventJoinStatus(e, +V.startDate(e) + 60 * 60 * 1000), 'started_unknown');
});

test('start only — stays on Сегодня after +15/+60 min until Moscow day end', () => {
  const V = loadVisibility();
  const start = V.startDate(baseEvent);
  const plus15 = +start + 15 * 60 * 1000;
  const plus60 = +start + 60 * 60 * 1000;
  assert.equal(V.isActiveTodayEvent(baseEvent, plus15), true);
  assert.equal(V.isActiveTodayEvent(baseEvent, plus60), true);
  assert.equal(V.eventJoinStatus(baseEvent, plus60), 'started_unknown');
  assert.equal(V.statusLabel('started_unknown'), 'ИГРА НАЧАЛАСЬ');
  const dayEnd = V.moscowDayEndExclusiveMs(MSK_DAY);
  assert.equal(V.isActiveTodayEvent(baseEvent, dayEnd - 1000), true);
  assert.equal(V.isActiveTodayEvent(baseEvent, dayEnd + 1000), false);
});

test('malformed time — parse error / inactive', () => {
  const V = loadVisibility();
  const e = { ...baseEvent, time: '99:99' };
  assert.equal(V.startDate(e), null);
  assert.equal(V.expirySource(e), 'PARSE_ERROR');
  assert.equal(V.isActiveTodayEvent(e, Date.now()), false);
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

test('filterActiveToday — explicit late reg outlives start-only at +30 min', () => {
  const V = loadVisibility();
  const start = V.startDate(baseEvent);
  const now = +start + 30 * 60 * 1000;
  const list = [baseEvent, { ...baseEvent, time: '21:00', late_reg_minutes: 120 }];
  const active = V.filterActiveToday(list, now);
  assert.equal(active.length, 2);
});

test('production snapshot — real schema includes both explicit late reg and start-only', () => {
  const V = loadVisibility();
  const events = live.events || [];
  assert.ok(events.length >= 30);
  let explicit = 0;
  let startOnly = 0;
  for (const e of events) {
    const src = V.expirySource(e);
    if (src === 'LATE_REG_EXPLICIT') explicit++;
    if (src === 'START_ONLY') startOnly++;
  }
  assert.ok(explicit >= 10);
  assert.ok(startOnly >= 10);
});
