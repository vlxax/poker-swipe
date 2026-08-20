// Shared numeric helpers for the personalised training layer.

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export function avg(list) {
  const arr = (list || []).filter((n) => Number.isFinite(Number(n)));
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + Number(n), 0) / arr.length;
}