/**
 * Audit real Polyana JSON (production sync output) for late-reg / expiry classification.
 * Usage: node scripts/audit_polyana_event_times.mjs [path-to-json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataPath = process.argv[2] || path.join(root, 'data/live_polyana.json');
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const events = raw.events || [];

const visScript = fs.readFileSync(path.join(root, 'polyana/event-visibility.js'), 'utf8');
const ctx = { window: {}, Date };
vm.createContext(ctx);
vm.runInContext(visScript, ctx);
const V = ctx.window.PspEventVisibility;

function hasNum(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
}

function classify(e) {
  const kind = V.expirySource(e);
  const issues = [];
  if (kind === 'TIME_INCOMPLETE') issues.push('missing date or time');
  if (kind === 'PARSE_ERROR') issues.push('start parse failed');
  return { kind, issues };
}

const byClub = new Map();
const counts = {
  totalEvents: events.length,
  lateRegExplicit: 0,
  endTimeOnly: 0,
  startOnly: 0,
  timeIncomplete: 0,
  parseErrors: 0,
};

const rows = [];
for (const e of events) {
  const c = classify(e);
  counts[c.kind === 'LATE_REG_EXPLICIT' ? 'lateRegExplicit' :
    c.kind === 'END_TIME_ONLY' ? 'endTimeOnly' :
    c.kind === 'START_ONLY' ? 'startOnly' :
    c.kind === 'TIME_INCOMPLETE' ? 'timeIncomplete' : 'parseErrors']++;

  const club = e.club || '(unknown)';
  if (!byClub.has(club)) {
    byClub.set(club, { club, total: 0, LATE_REG_EXPLICIT: 0, END_TIME_ONLY: 0, START_ONLY: 0, TIME_INCOMPLETE: 0, PARSE_ERROR: 0 });
  }
  const g = byClub.get(club);
  g.total++;
  g[c.kind] = (g[c.kind] || 0) + 1;

  rows.push({
    id: e._id,
    club: e.club,
    tournament: e.tournament,
    date: e.date,
    time: e.time,
    late_reg_until: e.late_reg_until ?? null,
    late_reg_minutes: e.late_reg_minutes ?? null,
    late_reg_source: e.late_reg_source ?? null,
    duration_minutes: e.duration_minutes ?? null,
    source_url: e.source_url ?? null,
    class: c.kind,
    issues: c.issues,
  });
}

const usableTimed = counts.lateRegExplicit + counts.endTimeOnly + counts.startOnly;
const fallbackPct = usableTimed ? (counts.startOnly / usableTimed) * 100 : 0;

const offsets = [-30, 0, 10, 15, 30, 60, 90].map((m) => m * 60 * 1000);
const samples = rows.filter((r) => r.class === 'LATE_REG_EXPLICIT').slice(0, 2)
  .concat(rows.filter((r) => r.class === 'START_ONLY').slice(0, 3));

function simulate(e, offsetMs) {
  const ev = events.find((x) => x._id === e.id);
  const start = V.startDate(ev);
  const now = +start + offsetMs;
  return {
    offsetMin: offsetMs / 60000,
    active: V.isActiveTodayEvent(ev, now),
    status: V.eventJoinStatus(ev, now),
    label: V.statusLabel(V.eventJoinStatus(ev, now)),
  };
}

const simulation = samples.map((s) => ({
  club: s.club,
  time: s.time,
  class: s.class,
  late_reg_minutes: s.late_reg_minutes,
  timeline: offsets.map((off) => simulate(s, off)),
  afterLateClose: (() => {
    const ev = events.find((x) => x._id === s.id);
    const lc = V.lateClose(ev);
    if (!lc) return null;
    const now = +lc + 60_000;
    return { active: V.isActiveTodayEvent(ev, now), status: V.eventJoinStatus(ev, now) };
  })(),
}));

console.log(JSON.stringify({
  dataPath,
  updated_at: raw.updated_at || raw.retrieved_at || null,
  source: raw.source || null,
  counts,
  fallbackUsagePercent: Math.round(fallbackPct * 10) / 10,
  byClub: [...byClub.values()].sort((a, b) => b.total - a.total),
  fieldScan: {
    keysOnEvent: [...new Set(events.flatMap((e) => Object.keys(e)))].sort(),
    withLateUntil: events.filter((e) => e.late_reg_until).length,
    withLateMinutes: events.filter((e) => hasNum(e.late_reg_minutes)).length,
    withDuration: events.filter((e) => hasNum(e.duration_minutes)).length,
    lateSources: events.reduce((a, e) => {
      const k = e.late_reg_source || 'none';
      a[k] = (a[k] || 0) + 1;
      return a;
    }, {}),
  },
  examples: rows.slice(0, 8),
  simulation,
}, null, 2));
