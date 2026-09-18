/**
 * Evidence Provider Interface - V2.3 Evidence Providers
 *
 * Providers are independent sources of poker knowledge.
 * Each provider:
 * - Understands specific context constraints
 * - Returns structured evidence or null
 * - Declares its authority/provenance
 * - Marks ignored material fields
 *
 * PokerBrain.resolve() uses providers to build evidence set,
 * then resolver selects primary evidence.
 */

export class EvidenceProvider {
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata || {};
  }

  /**
   * Attempt to provide evidence for a decision
   * Returns: { policy, source, authority, incompleteness, ignored }
   * or null if provider can't support this context
   */
  analyze(context) {
    throw new Error('analyze() must be implemented');
  }

  /**
   * Declare what this provider needs to function
   */
  requirements() {
    return {
      minimumFields: [],
      preferredFields: [],
      incompatibleWith: []
    };
  }

  /**
   * Assess context compatibility (0-1)
   * Lower = provider doesn't fit this context well
   */
  contextFit(context) {
    return 0.5; // implement in subclasses
  }

  /**
   * Return structured result
   */
  result(data = {}) {
    return {
      policy: data.policy || null,
      source: data.source || this.name,
      authority: data.authority || this.metadata.authority || 'unknown',
      provenance: data.provenance || this.metadata.provenance || {},

      contextFit: data.contextFit || this.contextFit(data.context),
      ignoredMaterialFields: data.ignored || [],
      unusableReason: data.unusableReason || null,

      confidence: data.confidence || 0,
      stackSpecific: data.stackSpecific !== false,
      actionTreeSpecific: data.actionTreeSpecific || false,

      metadata: data.metadata || {}
    };
  }

  /**
   * Return null result (provider can't help)
   */
  nullResult(reason) {
    return {
      policy: null,
      source: this.name,
      unusableReason: reason,
      contextFit: 0
    };
  }
}

export default EvidenceProvider;
