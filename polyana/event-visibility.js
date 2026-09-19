/**
 * Polyana event time visibility (Moscow schedule, Europe/Moscow).
 * Loaded before polyana-integrated.js; exposed as window.PspEventVisibility.
 *
 * Visibility hierarchy (production pokernomoney.ru homepage sync):
 * 1. Explicit late registration close (late_reg_minutes and/or late_reg_until)
 * 2. Explicit event end (duration_minutes) — event no longer active after end
 * 3. Start only — remain on «Сегодня» until end of Moscow calendar day; registration status unknown after start
 */
(function () {
  'use strict';

  const MSK_TZ = 'Europe/Moscow';

  function startDate(e) {
    if (!e?.date || !e?.time) return null;
    const time = String(e.time).trim();
    if (/^\d{2}:\d{2}$/.test(time)) {
      const [hh, mm] = time.split(':').map((x) => Number(x));
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return null;
    }
    const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
    const d = new Date(`${e.date}T${normalizedTime}+03:00`);
    return Number.isNaN(+d) ? null : d;
  }

  function lateCloseFromUntil(e) {
    const s = startDate(e);
    const until = String(e.late_reg_until || '').trim();
    if (!s || !/^\d{1,2}:\d{2}$/.test(until)) return null;
    const [hh, mm] = until.split(':').map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return null;
    const close = new Date(
      `${e.date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+03:00`
    );
    if (Number.isNaN(+close)) return null;
    if (+close < +s) return new Date(+close + 24 * 60 * 60 * 1000);
    return close;
  }

  function lateClose(e) {
    const s = startDate(e);
    if (!s) return null;
    const raw = e.late_reg_minutes;
    if (raw !== null && raw !== undefined && raw !== '') {
      const m = Number(raw);
      if (Number.isFinite(m) && m >= 0) return new Date(+s + m * 60000);
    }
    return lateCloseFromUntil(e);
  }

  function eventEndDate(e) {
    const s = startDate(e);
    if (!s) return null;
    const dur = e.duration_minutes;
    if (dur !== null && dur !== undefined && dur !== '' && Number.isFinite(Number(dur))) {
      return new Date(+s + Number(dur) * 60000);
    }
    return null;
  }

  function moscowCalendarDay(nowMs = Date.now()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MSK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(nowMs));
  }

  /** Exclusive upper bound: start of the next Moscow calendar day after event.date */
  function moscowDayEndExclusiveMs(dateStr) {
    if (!dateStr) return Number.POSITIVE_INFINITY;
    const anchor = new Date(`${dateStr}T00:00:00+03:00`);
    if (Number.isNaN(+anchor)) return Number.POSITIVE_INFINITY;
    return +anchor + 24 * 60 * 60 * 1000;
  }

  function isScheduledToday(e, nowMs = Date.now()) {
    if (!e?.date) return false;
    return String(e.date) === moscowCalendarDay(nowMs);
  }

  function expirySource(e) {
    if (lateClose(e)) return 'LATE_REG_EXPLICIT';
    if (eventEndDate(e)) return 'END_TIME_ONLY';
    if (startDate(e)) return 'START_ONLY';
    if (!e?.date || !e?.time) return 'TIME_INCOMPLETE';
    return 'PARSE_ERROR';
  }

  /** Last instant the event stays in the active «Сегодня» list (exclusive upper bound for now). */
  function activeUntilMs(e) {
    const lc = lateClose(e);
    if (lc) return +lc;
    const end = eventEndDate(e);
    if (end) return +end;
    if (e?.date && startDate(e)) return moscowDayEndExclusiveMs(e.date);
    return Number.POSITIVE_INFINITY;
  }

  function isActiveTodayEvent(e, nowMs = Date.now()) {
    if (!isScheduledToday(e, nowMs)) return false;
    if (!startDate(e)) return false;
    return nowMs < activeUntilMs(e);
  }

  /**
   * @returns {'soon'|'late_reg'|'started_unknown'|'expired'|'unknown'}
   */
  function eventJoinStatus(e, nowMs = Date.now()) {
    const s = startDate(e);
    if (!s) return 'unknown';
    if (nowMs < +s) return 'soon';
    const lc = lateClose(e);
    if (lc) {
      if (nowMs < +lc) return 'late_reg';
      return 'expired';
    }
    const end = eventEndDate(e);
    if (end && nowMs >= +end) return 'expired';
    if (nowMs >= +s) return 'started_unknown';
    return 'unknown';
  }

  function statusLabel(status) {
    const map = {
      soon: 'СКОРО',
      late_reg: 'ПОЗДНЯЯ РЕГИСТРАЦИЯ',
      started_unknown: 'ИГРА НАЧАЛАСЬ',
      expired: 'РЕГИСТРАЦИЯ ЗАКРЫТА',
      unknown: 'УТОЧНИТЬ РЕГИСТРАЦИЮ',
    };
    return map[status] || '';
  }

  function filterActiveToday(events, nowMs = Date.now()) {
    return (Array.isArray(events) ? events : []).filter((e) => isActiveTodayEvent(e, nowMs));
  }

  window.PspEventVisibility = {
    MSK_TZ,
    startDate,
    lateClose,
    lateCloseFromUntil,
    eventEndDate,
    moscowCalendarDay,
    moscowDayEndExclusiveMs,
    isScheduledToday,
    expirySource,
    activeUntilMs,
    isActiveTodayEvent,
    filterActiveToday,
    eventJoinStatus,
    statusLabel,
  };
})();
