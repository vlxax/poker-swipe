/**
 * PokerBrain V2 - Unified Decision Engine
 *
 * Orchestrates multiple evidence sources.
 * Real context integration + evidence reconciliation.
 *
 * Flow:
 * 1. Feature adapter → DecisionContext
 * 2. Providers analyze context → Evidence[]
 * 3. Resolver selects best evidence
 * 4. Return actionable decision
 *
 * V2 adds context recovery and evidence reconciliation.
 * V3 will add consolidation of multiple decision owners.
 */

import { DecisionContext } from './DecisionContext.js';
import { PreflopAtlasProvider, PostflopAtlasProvider, ReferenceProvider } from './providers/AtlasProviders.js';
import EvidenceProvider from './providers/EvidenceProvider.js';

export class PokerBrainV2 {
  constructor(config = {}) {
    this.config = config;
    this.providers = config.providers || [];
    this.pack = config.pack || (typeof window !== 'undefined' ? window.POKER_BRAIN_PACK : null);
    this.version = '2.0.0';
    this.traceEnabled = config.trace || false;

    // Default providers if not supplied
    if (this.providers.length === 0) {
      this._initializeDefaultProviders();
    }
  }

  _initializeDefaultProviders() {
    this.providers = [
      new PreflopAtlasProvider(this.pack),
      new PostflopAtlasProvider(this.pack),
      new ReferenceProvider()
    ];
  }

  /**
   * Main V2 entry: full context analysis
   * Input: raw feature input
   * Adapter: DecisionContext
   * Process: Provider evaluation
   * Output: Structured decision with provenance
   */
  async analyzeFullContext(context, options = {}) {
    if (!context || !(context instanceof DecisionContext)) {
      return {
        status: 'INVALID_INPUT',
        error: 'Context must be DecisionContext instance'
      };
    }

    const trace = [];
    if (this.traceEnabled) {
      trace.push(`[BRAIN] Analyzing context: ${context.featureSource}`);
      trace.push(`        Domain: ${context.normalizeDomain()}, Quality: ${context.contextQuality}`);
    }

    // Readiness check
    const domain = context.normalizeDomain();
    const readiness = context.readinessFor(domain);
    if (!readiness.ready) {
      return {
        status: 'INSUFFICIENT_CONTEXT',
        missing: readiness.missing,
        contextQuality: context.contextQuality,
        trace
      };
    }

    // Gather evidence from all providers
    const evidence = [];
    for (const provider of this.providers) {
      try {
        const result = provider.analyze(context);
        if (result) {
          evidence.push(result);
          if (this.traceEnabled) {
            const status = result.policy ? 'found' : 'not_applicable';
            trace.push(`        ${provider.name}: ${status}`);
          }
        }
      } catch (err) {
        if (this.traceEnabled) {
          trace.push(`        ${provider.name}: ERROR - ${err.message}`);
        }
      }
    }

    // Resolve evidence
    const decision = this._resolveEvidence(evidence, context);
    decision.trace = trace;

    return decision;
  }

  /**
   * Legacy compat: synchronous analysis for immediate decisions
   */
  analyze(context, options = {}) {
    if (!context || !(context instanceof DecisionContext)) {
      return {
        status: 'INVALID_INPUT'
      };
    }

    const domain = context.normalizeDomain();
    const readiness = context.readinessFor(domain);
    if (!readiness.ready) {
      return {
        status: 'INSUFFICIENT_CONTEXT',
        missing: readiness.missing
      };
    }

    // Gather evidence
    const evidence = [];
    for (const provider of this.providers) {
      try {
        const result = provider.analyze(context);
        if (result) evidence.push(result);
      } catch (_) {
        // skip errored providers
      }
    }

    return this._resolveEvidence(evidence, context);
  }

  /**
   * Resolve multiple evidence sources to single recommendation
   * Rules:
   * 1. Filter by context fit (don't use incompatible sources)
   * 2. Prefer concrete over partial
   * 3. Higher confidence wins
   * 4. Flag conflicts
   */
  _resolveEvidence(evidence, context) {
    // Filter out null results
    const viable = evidence.filter(e => e.policy !== null && e.unusableReason === null);

    if (viable.length === 0) {
      return {
        status: 'NO_EVIDENCE',
        domain: context.normalizeDomain(),
        contextQuality: context.contextQuality,
        recommendation: null,
        allEvidence: evidence
      };
    }

    // Sort by quality
    viable.sort((a, b) => {
      // Higher confidence first
      const confDiff = (b.confidence || 0) - (a.confidence || 0);
      if (confDiff !== 0) return confDiff;

      // Better context fit first
      const fitDiff = (b.contextFit || 0) - (a.contextFit || 0);
      if (fitDiff !== 0) return fitDiff;

      return 0;
    });

    const primary = viable[0];
    const conflicts = this._findConflicts(viable);

    return {
      status: 'DECISION_FOUND',
      domain: context.normalizeDomain(),
      contextQuality: context.contextQuality,

      recommendation: primary.policy,
      recommendationSource: primary.source,
      recommendationAuthority: primary.authority,
      recommendationConfidence: primary.confidence,

      allEvidence: evidence,
      primaryEvidence: primary,
      alternateEvidence: viable.slice(1),
      conflicts,

      contextIgnored: primary.ignoredMaterialFields,
      contextFit: primary.contextFit
    };
  }

  /**
   * Detect conflicts between evidence sources
   */
  _findConflicts(evidence) {
    const conflicts = [];

    for (let i = 0; i < evidence.length - 1; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const a = evidence[i];
        const b = evidence[j];

        // Compare policies
        if (a.policy && b.policy) {
          const aDominant = a.policy.topActions ? a.policy.topActions[0]?.action : null;
          const bDominant = b.policy.topActions ? b.policy.topActions[0]?.action : null;

          if (aDominant && bDominant && aDominant !== bDominant) {
            conflicts.push({
              sourceA: a.source,
              sourceB: b.source,
              recommendationA: aDominant,
              recommendationB: bDominant,
              severity: 'DECISION_CONFLICT'
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Get trace information about decision
   */
  trace(context) {
    const saved = this.traceEnabled;
    this.traceEnabled = true;

    const result = this.analyze(context);

    this.traceEnabled = saved;
    return result.trace || [];
  }

  /**
   * For observability: summary of providers
   */
  status() {
    return {
      version: this.version,
      providers: this.providers.map(p => ({
        name: p.name,
        authority: p.metadata?.authority
      })),
      packLoaded: !!this.pack
    };
  }
}

export default PokerBrainV2;
