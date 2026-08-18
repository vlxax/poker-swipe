export const ERROR_CODES = {
  INVALID_CARD: 'INVALID_CARD',
  DUPLICATE_CARD: 'DUPLICATE_CARD',
  INVALID_BOARD: 'INVALID_BOARD',
  INVALID_HAND: 'INVALID_HAND',
  INVALID_RANGE: 'INVALID_RANGE',
  INVALID_STREET: 'INVALID_STREET',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_STACK: 'INVALID_STACK',
  INVALID_POT: 'INVALID_POT',
  NO_AVAILABLE_ACTIONS: 'NO_AVAILABLE_ACTIONS',
  MISSING_INPUT: 'MISSING_INPUT',
  INVALID_CONFIG: 'INVALID_CONFIG',
  TREE_TOO_LARGE: 'TREE_TOO_LARGE',
  NOT_SOLVED: 'NOT_SOLVED',
  UNSUPPORTED: 'UNSUPPORTED',
  CANCELLED: 'CANCELLED'
};

export class SolverError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'SolverError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    const out = { error: { code: this.code, message: this.message } };
    if (this.details != null) out.error.details = this.details;
    return out;
  }
}

export function assert(condition, code, message) {
  if (!condition) throw new SolverError(code, message);
}

export function catchErrors(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      if (err instanceof SolverError) return err.toJSON();
      if (err && err.code) return { error: { code: err.code, message: err.message } };
      return { error: { code: 'INTERNAL', message: err && err.message ? err.message : String(err) } };
    }
  };
}