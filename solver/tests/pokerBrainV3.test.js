import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';
import { lookupReferencePolicy } from '../../ranges-ui/referenceRanges.js';
import { analyze, adapters } from '../../poker-brain/index.js';
import { collectReference6maxEvidenceSync } from '../../poker-brain/evidence/reference6maxProvider.js';
import { resolvePokerEvidence } from '../../poker-brain/evidence/resolvePokerEvidence.js';
import { collectPokerEvidence } from '../../poker-brain/evidence/collectPokerEvidence.js';
import { POKER_DOMAINS } from '../../poker-brain/routing/resolvePokerDomain.js';
import { canUnifiedBrainOwnDaily } from '../../poker-brain/integrations/dailyMigrationGate.js';
import { explainRangeCell } from '../../poker-brain/integrations/rangesBrainVm.js';
import { ENGINE_VERSION } from '../../poker-brain/version.js';

const pack = loadPokerBrainPackFromStrategyFile();
const deps = { pack, classOf: () => 'AKs', referenceLookupPolicy: lookupReferencePolicy };

describe('PokerBrain V3', () => {
  it('analyze exposes engineVersion', () => {
    const r = analyze({ scenario: { pos: 'BTN', stack: 30, hero: ['As', 'Ks'], ctx: 'unopened' } }, deps);
    assert.equal(r.engineVersion, ENGINE_VERSION);
    assert.ok(r.brainKnows);
    assert.ok(r.strategySourceKnows || !r.provenance.primarySource);
  });

  it('REFERENCE_6MAX is stack-invariant partial when stack known', () => {
    const ctx = adapters.swipe({ scenario: { pos: 'BTN', stack: 33, hero: ['As', 'Ks'], ctx: 'unopened' } });
    const ev = collectReference6maxEvidenceSync(ctx, POKER_DOMAINS.PREFLOP_RFI, deps);
    assert.ok(ev);
    assert.equal(ev.meta.stackSpecific, false);
    assert.ok(ev.meta.ignoredMaterialFields.includes('effectiveStackBB'));
  });

  it('preflop atlas remains primary over reference', () => {
    const ctx = adapters.swipe({ scenario: { pos: 'BTN', stack: 30, hero: ['As', 'Ks'], ctx: 'unopened' } });
    const collected = collectPokerEvidence(ctx, POKER_DOMAINS.PREFLOP_RFI, deps);
    const resolved = resolvePokerEvidence(ctx, collected);
    assert.equal(resolved.primary.layerId, 'PREFLOP_ATLAS');
    const ref = collected.evidence.find((e) => e.layerId === 'REFERENCE_6MAX');
    assert.ok(ref);
  });

  it('explainRangeCell returns brain VM fields', () => {
    const vm = explainRangeCell({ position: 'BTN', stack: 30, hand: 'AKs', situation: 'rfi' }, deps);
    assert.equal(vm.hand, 'AKs');
    assert.ok('primarySource' in vm);
    assert.ok('ignoredMaterialFields' in vm);
  });

  it('canUnifiedBrainOwnDaily blocks collapsed context', () => {
    const ctx = adapters.swipe({
      scenario: { pos: 'CO', stack: 31, hero: ['Ah', '5h'], ctx: 'facing 3bet' }
    });
    const brain = analyze({ context: ctx }, { ...deps, classOf: () => 'A5s' });
    const gate = canUnifiedBrainOwnDaily(ctx, brain);
    assert.equal(gate.canOwn, false);
    assert.ok(gate.blockers.length);
  });

  it('malformed input does not throw', () => {
    const r = analyze({ scenario: {} }, { pack: { preflop: {} } });
    assert.ok(r.flags.includes('NO_STRATEGY_AVAILABLE'));
  });
});
