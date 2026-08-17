
const SOURCE_BASE = "https://pokernomoney.ru";
const CLUBS_URL = `${SOURCE_BASE}/clubs`;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function cleanText(s = "") {
  return String(s)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function stripTags(html = "") {
  return cleanText(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
  );
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function absoluteUrl(href) {
  if (!href) return null;
  try {
    return new URL(href, SOURCE_BASE).toString();
  } catch {
    return null;
  }
}

function parseMoney(text = "") {
  const m = String(text).match(/(\d[\d\s]{0,8})\s*(?:₽|руб(?:\.|лей|ля)?)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDurationMinutes(text = "") {
  const s = String(text).toLowerCase().replace(",", ".");
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:час|ч\.?)/i);
  if (m) return Math.round(Number(m[1]) * 60);
  m = s.match(/(\d+)\s*(?:минут|мин\.?)/i);
  if (m) return Number(m[1]);
  return null;
}

function parseMaxReentries(text = "") {
  const patterns = [
    /не более\s+(\d+)\s+раз/i,
    /до\s+(\d+)\s+раз/i,
    /(\d+)\s*(?:re-?entry|реба(?:й|я|ев)|ре-?энтри)/i,
  ];
  for (const p of patterns) {
    const m = String(text).match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

function guessGame(text = "") {
  const s = String(text).toUpperCase();
  if (/\bPLO\b|ОМАХ/.test(s)) return "PLO";
  if (/АНАНАС|PINEAPPLE/.test(s)) return "PINEAPPLE";
  if (/HEADS[\s-]?UP|ХЕДЗАП|HU\b/.test(s)) return "HU";
  if (/\bNLH\b|ХОЛДЕМ|HOLD.?EM/.test(s)) return "NLH";
  return null;
}

function guessFormat(text = "") {
  const s = String(text).toUpperCase();
  const m = s.match(/\b([269])[\s-]?MAX\b/);
  if (m) return `${m[1]}-max`;
  if (/HEADS[\s-]?UP|ХЕДЗАП/.test(s)) return "HU";
  return null;
}

function guessBountyType(text = "") {
  const s = String(text).toLowerCase();
  if (/mystery|мистери/.test(s)) return "mystery";
  if (/pko|progressive|прогрессив/.test(s)) return "pko";
  if (/bounty|баунти|нокаут/.test(s)) return "bounty";
  return null;
}

function extractClockTimes(text = "") {
  return unique([...String(text).matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)].map(m => `${m[1]}:${m[2]}`));
}

function normalizeDate(raw, fallbackDate) {
  if (!raw) return fallbackDate;
  const iso = String(raw).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dm = String(raw).match(/\b(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\b/);
  if (dm) {
    const y = dm[3] || fallbackDate.slice(0, 4);
    return `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }
  return fallbackDate;
}

function moscowDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const o = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${o.year}-${o.month}-${o.day}`;
}

function moscowNowISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const o = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}+03:00`;
}

function lateRegInfo(event, nowMs = Date.now()) {
  if (!event.date || !event.start_time || !event.late_reg_minutes) {
    return { late_reg_end: null, late_reg_remaining_minutes: null, late_reg_open: null };
  }
  const start = Date.parse(`${event.date}T${event.start_time}:00+03:00`);
  if (!Number.isFinite(start)) {
    return { late_reg_end: null, late_reg_remaining_minutes: null, late_reg_open: null };
  }
  const end = start + event.late_reg_minutes * 60_000;
  const remaining = Math.ceil((end - nowMs) / 60_000);
  return {
    late_reg_end: new Date(end).toISOString(),
    late_reg_remaining_minutes: Math.max(0, remaining),
    late_reg_open: remaining > 0,
  };
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "user-agent": "PokerSwipe-PolyanaBot/1.0 (+contact: app owner)",
      "accept": "text/html,application/xhtml+xml",
    },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!r.ok) throw new Error(`SOURCE_HTTP_${r.status}:${url}`);
  return await r.text();
}

function discoverClubUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"']*\/club\/c~[^"'?#]+)[^"']*["']/gi)) {
    urls.push(absoluteUrl(m[1]));
  }
  return unique(urls);
}

function extractField(text, labels) {
  const lines = cleanText(text).split("\n").map(x => x.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const label of labels) {
      const low = line.toLowerCase();
      const l = label.toLowerCase();
      if (low === l && lines[i + 1]) return lines[i + 1];
      if (low.startsWith(l + ":")) return line.slice(label.length + 1).trim();
    }
  }
  return null;
}

function parseClubPage(url, html, today) {
  const text = stripTags(html);
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const name = titleMatch ? stripTags(titleMatch[1]).replace(/\s*-\s*PokerNoMoney.*$/i, "").trim() : url.split("c~")[1] || "Клуб";

  const address = extractField(text, ["Адрес"]) || null;
  const feeMatch = text.match(/(?:организационн(?:ый|ого)\s+(?:сбор|взнос)|стоимость)[^\d]{0,80}(\d[\d\s]{2,8})\s*(?:₽|руб)/i);
  const minFeeRub = feeMatch ? Number(feeMatch[1].replace(/\s/g, "")) : parseMoney(text);

  const lateRegMatch = text.match(/(?:поздн(?:яя|ей)\s+регистрац(?:ия|ии))[\s\S]{0,180}?(\d+(?:[.,]\d+)?)\s*(?:час|ч\.?)/i);
  const lateRegMinutes = lateRegMatch ? Math.round(Number(lateRegMatch[1].replace(",", ".")) * 60) : null;

  const rebuyCostMatch = text.match(/(?:ребай|re-?entry)[\s\S]{0,160}?(?:стоимость|сбор)[^\d]{0,30}(\d[\d\s]{2,8})\s*(?:₽|руб)/i);
  const rebuyCostRub = rebuyCostMatch ? Number(rebuyCostMatch[1].replace(/\s/g, "")) : null;

  const tournamentDuration = (() => {
    const m = text.match(/(?:длительность|турнир рассчитан)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*[-–—]?\s*(\d+(?:[.,]\d+)?)?\s*час/i);
    if (!m) return null;
    const a = Number(m[1].replace(",", "."));
    const b = m[2] ? Number(m[2].replace(",", ".")) : a;
    return Math.round(((a + b) / 2) * 60);
  })();

  const maxReentries = parseMaxReentries(text);

  // Heuristic schedule parsing:
  // collect visible lines around clock values. The source may change markup;
  // unknown values remain null instead of being invented.
  const lines = text.split("\n").map(x => x.trim()).filter(Boolean);
  const events = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const tm = lines[i].match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
    if (!tm) continue;
    const time = `${tm[1]}:${tm[2]}`;

    const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 5))
      .filter(x => !/^(адрес|контакты|возраст клуба)$/i.test(x))
      .join(" · ");

    // Try to find a human tournament title near the time.
    const candidates = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 4))
      .filter(x => !x.includes(time))
      .filter(x => x.length >= 3 && x.length <= 100)
      .filter(x => !/^(сегодня|завтра|москва|расписание турниров|связаться|подробнее)$/i.test(x))
      .filter(x => !/PokerNoMoney/i.test(x));

    const tournamentName = candidates.find(x =>
      /NLH|PLO|Hold|Холд|Омах|Turbo|Deep|Bounty|Баунти|Mystery|PKO|Cup|Series|Main|Freeze|Knock|Нокаут|Турнир/i.test(x)
    ) || null;

    const key = `${today}|${time}|${name}|${tournamentName || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      id: `${today}-${time}-${name}-${tournamentName || "event"}`
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 160),
      date: today,
      start_time: time,
      club: name,
      tournament_name: tournamentName,
      game: guessGame(context),
      format: guessFormat(context),
      buy_in_rub: parseMoney(context),
      free: /\bfree\b|бесплат/i.test(context),
      reentry_limit: maxReentries,
      reentry_cost_rub: rebuyCostRub,
      late_reg_minutes: lateRegMinutes,
      duration_minutes: tournamentDuration,
      bounty_type: guessBountyType(context),
      address,
      source_url: url,
    });
  }

  return {
    club: {
      id: url.split("c~")[1] || name.toLowerCase().replace(/\s+/g, "-"),
      name,
      address,
      min_fee_rub: minFeeRub,
      reentry_limit: maxReentries,
      reentry_cost_rub: rebuyCostRub,
      late_reg_minutes: lateRegMinutes,
      duration_minutes: tournamentDuration,
      source_url: url,
    },
    events,
  };
}

async function syncSource(env) {
  const started = Date.now();
  const today = moscowDateISO();
  const clubsHtml = await fetchHtml(CLUBS_URL);
  const clubUrls = discoverClubUrls(clubsHtml);

  if (!clubUrls.length) {
    throw new Error("NO_CLUB_URLS_DISCOVERED");
  }

  const concurrency = Math.max(1, Math.min(6, Number(env.SYNC_CONCURRENCY || 4)));
  const queue = [...clubUrls];
  const clubs = [];
  const events = [];
  const errors = [];

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const html = await fetchHtml(url);
        const parsed = parseClubPage(url, html, today);
        clubs.push(parsed.club);
        events.push(...parsed.events);
      } catch (e) {
        errors.push({ url, error: String(e?.message || e) });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const nowMs = Date.now();
  const normalizedEvents = events
    .map(e => ({ ...e, ...lateRegInfo(e, nowMs) }))
    .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));

  const payload = {
    schema_version: 1,
    updated_at: moscowNowISO(),
    city: "Москва",
    source_status: {
      club_pages_discovered: clubUrls.length,
      club_pages_parsed: clubs.length,
      parse_errors: errors.length,
    },
    clubs,
    events: normalizedEvents,
    errors,
  };

  await env.POLYANA_KV.put("polyana:live", JSON.stringify(payload), {
    expirationTtl: DEFAULT_TTL_SECONDS,
  });

  await env.POLYANA_KV.put("polyana:last_sync", JSON.stringify({
    ok: true,
    updated_at: payload.updated_at,
    duration_ms: Date.now() - started,
    clubs: clubs.length,
    events: normalizedEvents.length,
    errors: errors.length,
  }), { expirationTtl: DEFAULT_TTL_SECONDS });

  return payload;
}

async function getLive(env) {
  const raw = await env.POLYANA_KV.get("polyana:live");
  return raw ? JSON.parse(raw) : null;
}

async function getFreshLive(env) {
  const live = await getLive(env);
  if (!live) return null;
  const nowMs = Date.now();
  return {
    ...live,
    served_at: moscowNowISO(),
    events: (live.events || []).map(e => ({ ...e, ...lateRegInfo(e, nowMs) })),
  };
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      syncSource(env).catch(async e => {
        await env.POLYANA_KV.put("polyana:last_sync", JSON.stringify({
          ok: false,
          updated_at: moscowNowISO(),
          error: String(e?.message || e),
        }), { expirationTtl: DEFAULT_TTL_SECONDS });
        throw e;
      })
    );
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...JSON_HEADERS,
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type,x-sync-key",
        },
      });
    }

    if (url.pathname === "/api/polyana/health") {
      const last = await env.POLYANA_KV.get("polyana:last_sync");
      return json({
        ok: true,
        service: "pokerswipe-polyana-sync",
        now_moscow: moscowNowISO(),
        last_sync: last ? JSON.parse(last) : null,
      });
    }

    if (url.pathname === "/api/polyana/today") {
      const live = await getFreshLive(env);
      if (!live) return json({ ok: false, error: "NO_DATA_YET" }, 503);

      const today = moscowDateISO();
      const events = (live.events || []).filter(e => e.date === today);
      return json({
        updated_at: live.updated_at,
        served_at: live.served_at,
        city: live.city,
        count: events.length,
        events,
      });
    }

    if (url.pathname === "/api/polyana/clubs") {
      const live = await getFreshLive(env);
      if (!live) return json({ ok: false, error: "NO_DATA_YET" }, 503);
      return json({
        updated_at: live.updated_at,
        served_at: live.served_at,
        count: live.clubs?.length || 0,
        clubs: live.clubs || [],
      });
    }

    if (url.pathname === "/api/polyana/live") {
      const live = await getFreshLive(env);
      if (!live) return json({ ok: false, error: "NO_DATA_YET" }, 503);
      return json(live);
    }

    if (url.pathname === "/api/polyana/sync" && request.method === "POST") {
      const expected = env.SYNC_KEY || "";
      const actual = request.headers.get("x-sync-key") || "";
      if (!expected || actual !== expected) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

      const payload = await syncSource(env);
      return json({
        ok: true,
        updated_at: payload.updated_at,
        clubs: payload.clubs.length,
        events: payload.events.length,
        errors: payload.errors.length,
      });
    }

    return json({
      ok: true,
      service: "PokerSwipe Polyana live sync",
      endpoints: [
        "GET /api/polyana/health",
        "GET /api/polyana/today",
        "GET /api/polyana/clubs",
        "GET /api/polyana/live",
        "POST /api/polyana/sync"
      ]
    });
  }
};
