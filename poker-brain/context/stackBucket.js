export const STACK_BUCKETS = [20, 25, 30, 40, 50];

export function nearestStackBucket(bb) {
  const n = Number(bb);
  if (!Number.isFinite(n)) return { lookupStackBB: null, stackBucketDistanceBB: null };
  const lookup = STACK_BUCKETS.reduce(
    (a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a),
    STACK_BUCKETS[0]
  );
  return {
    actualStackBB: n,
    lookupStackBB: lookup,
    stackBucketDistanceBB: Math.abs(n - lookup)
  };
}
