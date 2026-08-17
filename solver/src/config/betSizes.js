export const DEFAULT_BET_SIZES = {
  flop: [0.25, 0.33, 0.5, 0.75, 1.0],
  turn: [0.33, 0.66, 0.75, 1.0],
  river: [0.33, 0.66, 0.75, 1.0]
};

export function betSizesForStreet(street) {
  return DEFAULT_BET_SIZES[String(street || 'flop').toLowerCase()] || DEFAULT_BET_SIZES.flop;
}