// Hand abstraction interface. Default is the identity abstraction: every combo is
// its own hand state. Later versions can cluster/bucket hands here.

// Return the hand bucket id for a combo (identity by default).
export function bucketOf(combo, _options = {}) {
  return (combo && combo.sort ? [...combo].sort().join('') : combo) || String(combo);
}

export const IDENTITY_ABSTRACTION = {
  name: 'identity',
  bucketOf
};

export function createHandAbstraction(options = {}) {
  if (options && options.mode === 'identity') return IDENTITY_ABSTRACTION;
  return IDENTITY_ABSTRACTION;
}