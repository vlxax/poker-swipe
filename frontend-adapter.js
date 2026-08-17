
// Minimal PokerSwipe adapter.
// Put WORKER_BASE in your frontend config and call this instead of loading old snapshots.

const POLYANA_API_BASE = "https://YOUR-WORKER.workers.dev";

export async function loadPolyanaToday() {
  const r = await fetch(`${POLYANA_API_BASE}/api/polyana/today`, {
    cache: "no-store"
  });
  if (!r.ok) throw new Error(`POLYANA_API_${r.status}`);
  return await r.json();
}

export function formatLateReg(event) {
  if (!event?.late_reg_minutes) return null;
  if (event.late_reg_open === false) return "Late reg закрыта";
  const min = Number(event.late_reg_remaining_minutes);
  if (!Number.isFinite(min)) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `Late reg · осталось ${h}ч ${m}м` : `Late reg · осталось ${m}м`;
}
