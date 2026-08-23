/**
 * Read-only Polyana clubs adapter for My Tournaments (SPORT / OFFLINE venue pickers).
 * Uses the same canonical JSON sources as polyana-integrated.js — no duplicated club arrays.
 */
(function (global) {
  'use strict';

  const CLUB_URLS = [
    'data/moscow_club_locations_source.json',
    'data/moscow_clubs_pokernomoney.json',
    'data/live_polyana.json'
  ];

  let cache = null;
  let loadPromise = null;

  async function fetchFirst(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        const clubs = data && data.clubs;
        if (Array.isArray(clubs) && clubs.length) return clubs;
      } catch (_) {
        /* try next source */
      }
    }
    return [];
  }

  function normalizeClub(raw) {
    const id = String(raw.id || raw.slug || '').trim();
    const name = String(raw.name || raw.title || raw.club || '').trim();
    if (!name) return null;
    return { id: id || null, name, city: raw.city || '' };
  }

  function mergeClubs(rawList) {
    const byKey = new Map();
    rawList.forEach((raw) => {
      const c = normalizeClub(raw);
      if (!c) return;
      const key = (c.id || c.name.toLowerCase()).trim();
      const prev = byKey.get(key);
      if (!prev || (c.id && !prev.id)) byKey.set(key, c);
    });
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  async function loadPolyanaClubs() {
    if (cache) return cache.slice();
    if (loadPromise) return loadPromise.then((list) => list.slice());
    loadPromise = fetchFirst(CLUB_URLS).then((raw) => {
      cache = mergeClubs(raw);
      return cache;
    });
    return loadPromise.then((list) => list.slice());
  }

  function getCachedPolyanaClubs() {
    return cache ? cache.slice() : [];
  }

  global.PolyanaClubsAdapter = {
    loadPolyanaClubs,
    getCachedPolyanaClubs
  };
})(typeof window !== 'undefined' ? window : globalThis);
