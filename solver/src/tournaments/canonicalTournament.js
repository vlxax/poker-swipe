// Canonical Polyana → My Tournaments → Trip Builder record.
// Keep the source event id. Do not coerce null/unknown into false or 0.

export function unknownToNull(value) {
  if (value === null || value === undefined || value === '') return null;
  return value;
}

export function booleanOrUnknown(value) {
  if (value === true || value === false) return value;
  return null;
}

export function numberOrUnknown(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function canonicalTournamentId(event = {}) {
  const existing = event.id || event._id || event.sourceId;
  if (existing !== null && existing !== undefined && String(existing).trim() !== '') {
    return String(existing);
  }
  return [event.date, event.time, event.club, event.tournament || event.tournament_name]
    .map((x) => String(x || '').trim())
    .join('|');
}

export function fromPolyanaEvent(event = {}) {
  const id = canonicalTournamentId(event);
  return {
    id,
    polyanaId: id,
    source: 'POLYANA',
    date: unknownToNull(event.date),
    time: unknownToNull(event.time || event.start_time),
    game: unknownToNull(event.game || event._game),
    format: unknownToNull(event.format),
    buyin: numberOrUnknown(event.buy_in_rub ?? event.fee_rub),
    fee: numberOrUnknown(event.fee_rub),
    reentryLimit: numberOrUnknown(event.reentry_limit ?? event._reentryCount),
    reentryUnlimited: event._reentryUnlimited === true ? true : booleanOrUnknown(event.reentry_unlimited),
    addon: booleanOrUnknown(event.addon_allowed),
    bounty: unknownToNull(event.bounty_type) ?? (event._isBounty ? 'bounty' : null),
    lateRegistrationMinutes: numberOrUnknown(event.late_reg_minutes),
    lateRegistrationUntil: unknownToNull(event.late_reg_until),
    levels: numberOrUnknown(event.level_minutes),
    location: unknownToNull(event.address),
    club: unknownToNull(event.club),
    tournamentName: unknownToNull(event.tournament || event.tournament_name || event._title),
    type: 'offline'
  };
}

export function attachToTrip(trip = {}, record) {
  const ids = Array.isArray(trip.tournamentIds) ? [...trip.tournamentIds] : [];
  if (record?.id && !ids.includes(record.id)) ids.push(record.id);
  return { ...trip, tournamentIds: ids };
}

export function savePolyanaEventToJournal(event, store) {
  const rec = fromPolyanaEvent(event);
  const target = store || (typeof window !== 'undefined' ? (window.S = window.S || { tournaments: [] }) : { tournaments: [] });
  if (!Array.isArray(target.tournaments)) target.tournaments = [];
  const idx = target.tournaments.findIndex((t) => t.id === rec.id || t.polyanaId === rec.id);
  if (idx >= 0) target.tournaments[idx] = { ...target.tournaments[idx], ...rec };
  else target.tournaments.push(rec);
  if (typeof window !== 'undefined' && typeof window.save === 'function') window.save();
  return rec;
}

if (typeof window !== 'undefined') {
  window.PokerSwipeCanonicalTournament = {
    fromPolyanaEvent,
    savePolyanaEventToJournal,
    attachToTrip,
    canonicalTournamentId
  };
}
