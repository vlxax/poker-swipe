/**
 * PokerBrain Facade - Passive Slice 1
 *
 * Minimal facade for architecture proof.
 * No production consumers yet.
 * Preflop lookup only.
 */

export class PokerBrain {
  constructor(preflopProvider = null) {
    this.preflopProvider = preflopProvider;
  }

  /**
   * Analyze a preflop poker context
   * Returns normalized decision or UNSUPPORTED state
   */
  analyze(context = {}) {
    const { street } = context;

    // Only preflop is supported in Slice 1
    if (street && street !== 'PREFLOP') {
      return {
        status: 'UNSUPPORTED_DOMAIN',
        domain: street,
        message: 'Slice 1 supports preflop only'
      };
    }

    if (!this.preflopProvider) {
      return {
        status: 'MISSING_PROVIDER',
        message: 'No preflopProvider configured'
      };
    }

    try {
      const policy = this.preflopProvider.lookup(context);

      if (!policy) {
        return {
          status: 'POLICY_NOT_FOUND',
          context,
          source: this.preflopProvider.source()
        };
      }

      return {
        status: 'POLICY_FOUND',
        domain: 'preflop',
        recommendedActions: policy,
        source: this.preflopProvider.source(),
        sourceAuthority: this.preflopProvider.authority(),
        provenance: {
          solverOutput: false,
          documented: false
        }
      };
    } catch (err) {
      return {
        status: 'ERROR',
        error: err.message,
        context
      };
    }
  }
}

export default PokerBrain;
