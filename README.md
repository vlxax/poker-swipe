
# PokerSwipe Polyana Live Sync

Standalone Cloudflare Worker for keeping PokerSwipe "Поляна" data fresh.

## Architecture

Public source -> Cloudflare Worker scraper/normalizer -> KV -> PokerSwipe API.

The frontend never needs to display the source brand. `source_url` is stored only as technical provenance/debug metadata.

## Endpoints

- `GET /api/polyana/health`
- `GET /api/polyana/today`
- `GET /api/polyana/clubs`
- `GET /api/polyana/live`
- `POST /api/polyana/sync` with header `x-sync-key`

## Important behavior

- Cron runs every 10 minutes.
- Moscow time is used for event dates and late-registration countdowns.
- Missing values are returned as `null`; the Worker does not invent tournament names or poker parameters.
- `late_reg_remaining_minutes` is recalculated at request time.
- If the upstream markup changes, parse errors are visible in `/health` and in the full `/live` payload.

## Setup

1. Create a KV namespace in Cloudflare.
2. Replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` in `wrangler.jsonc`.
3. Install:
   `npm install`
4. Add secret:
   `npx wrangler secret put SYNC_KEY`
5. Deploy:
   `npm run deploy`
6. Manually seed once:
   `curl -X POST https://YOUR-WORKER.workers.dev/api/polyana/sync -H "x-sync-key: YOUR_KEY"`
7. Check:
   `https://YOUR-WORKER.workers.dev/api/polyana/health`

Cron changes in Cloudflare can take several minutes to propagate.

## PokerSwipe frontend

Use:
`GET https://YOUR-WORKER.workers.dev/api/polyana/today`

Do not render `source_url`.

Suggested card fields:
- `start_time`
- `tournament_name`
- `club`
- `game`
- `format`
- `buy_in_rub`
- `reentry_limit`
- `late_reg_end`
- `late_reg_remaining_minutes`
- `duration_minutes`
- `bounty_type`
- `address`

When `tournament_name` is null, show only the club + time; never show a fake placeholder such as "Турнир клуба".

## Production hardening

Before relying on this as production data:
- verify the upstream site's permission/robots/terms for automated collection;
- test selectors/heuristics against several club pages;
- add alerting when event count unexpectedly drops;
- add a second source later (club Telegram channels or direct club feeds);
- cache photos/logos separately rather than hotlinking external assets.
