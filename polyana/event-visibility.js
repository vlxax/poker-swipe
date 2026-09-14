/**
 * Polyana event time visibility (Moscow schedule, Europe/Moscow).
 * Loaded before polyana-integrated.js; exposed as window.PspEventVisibility.
 */
(function () {
  'use strict';

  /** If only start time is known: hide from active list this long after start (documented fallback). */
  const FALLBACK_AFTER_START_MS = 15 * 60 * 1000;
  const MSK_TZ = 'Europe/Moscow';

  function startDate(e) {
    if (!e?.date || !e?.time) return null;
    const time = String(e.time).trim();
    const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
    const d = new Date(`${e.date}T${normalizedTime}+03:00`);
    return Number.isNaN(+d) ? null : d;
  }

  function lateClose(e) {
    const s = startDate(e);
    const raw = e.late_reg_minutes;
    if (!s || raw === null || raw === undefined || raw === '') return null;
    const m = Number(raw);
    return Number.isFinite(m) && m >= 0 ? new Date(+s + m * 60000) : null;
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
    return new Intl.DateTimeFormat('en-CA', { timeZone: MSK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
  }

  function isScheduledToday(e, nowMs = Date.now()) {
    if (!e?.date) return false;
    return String(e.date) === moscowCalendarDay(nowMs);
  }

  /** Last instant the event stays in the active «Сегодня» list (exclusive upper bound for now). */
  function activeUntilMs(e) {
    const lc = lateClose(e);
    if (lc) return +lc;
    const end = eventEndDate(e);
    if (end) return +end;
    const s = startDate(e);
    if (!s) return Number.POSITIVE_INFINITY;
    return +s + FALLBACK_AFTER_START_MS;
  }

  function isActiveTodayEvent(e, nowMs = Date.now()) {
    if (!isScheduledToday(e, nowMs)) return false;
    return nowMs < activeUntilMs(e);
  }

  /**
   * @returns {'soon'|'late_reg'|'started'|'expired'|'unknown'}
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
    if (nowMs >= +s + FALLBACK_AFTER_START_MS) return 'expired';
    return 'started';
  }

  function statusLabel(status) {
    const map = {
      soon: 'СКОРО',
      late_reg: 'ПОЗДНЯЯ РЕГИСТРАЦИЯ',
      started: 'ИДЁТ РЕГИСТРАЦИЯ',
      expired: 'РЕГИСТРАЦИЯ ЗАКРЫТА',
      unknown: '',
    };
    return map[status] || '';
  }

  function filterActiveToday(events, nowMs = Date.now()) {
    return (Array.isArray(events) ? events : []).filter((e) => isActiveTodayEvent(e, nowMs));
  }

  window.PspEventVisibility = {
    FALLBACK_AFTER_START_MS,
    MSK_TZ,
    startDate,
    lateClose,
    eventEndDate,
    moscowCalendarDay,
    isScheduledToday,
    activeUntilMs,
    isActiveTodayEvent,
    filterActiveToday,
    eventJoinStatus,
    statusLabel,
  };
})();
