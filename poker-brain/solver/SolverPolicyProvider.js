/**
 * Future solver-backed policies plug in here. No fake solver data in v1.
 */

export class SolverPolicyProvider {
  constructor(options = {}) {
    this.id = options.id || 'SOLVER_EXPORT';
    this.solverValidated = true;
  }

  /** @returns {Promise<null|object>} evidence item or null if not applicable */
  async getEvidence(_context, _domain) {
    return null;
  }
}

export function createSolverProviderStub() {
  return new SolverPolicyProvider({ id: 'SOLVER_EXPORT_STUB' });
}
