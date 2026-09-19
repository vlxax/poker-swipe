import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installPokerBrainForTests } from './brainTestEnv.js';
import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';
import { normalizeDecisionContext, adapters } from '../../poker-brain/context/normalize.js';
import { resolvePokerDomain, POKER_DOMAINS } from '../../poker-brain/routing/resolvePokerDomain.js';
import { compareEvidenceContext, CONTEXT_MATCH } from '../../poker-brain/evidence/compareEvidenceContext.js';
import { analyze, grade } from '../../poker-brain/index.js';
import { collectPreflopAtlasEvidence } from '../../poker-brain/evidence/preflopAtlasAdapter.js';
import { createSolverProviderStub } from '../../poker-brain/solver/SolverPolicyProvider.js';

const pack = loadPokerBrainPackFromStrategyFile();

describe('PokerBrain unified engine', () => {
  it('normalizes swipe and myhands to same domain for equivalent spot', () => {
    const scenario = {
      street: 'PREFLOP',
      pos: 'CO',
      hero: ['Ah', 'Kd'],
      stack: 30,
      ctx: 'unopened, first in'
    };
    const ctxSwipe = adapters.swipe({ scenario });
    const ctxHands = adapters.myhands({
      hand: {
        street: 'PREFLOP',
        heroSeat: 'CO',
        effStack: 30,
        hero: ['Ah', 'Kd'],
        actions: [],
        ctx: 'unopened, first in'
      }
    });
    const d1 = resolvePokerDomain(ctxSwipe);
    const d2 = resolvePokerDomain(ctxHands);
    assert.equal(d1, POKER_DOMAINS.PREFLOP_RFI);
    assert.equal(d2, POKER_DOMAINS.PREFLOP_RFI);
  });

  it('does not invent unknown game fields', () => {
    const ctx = normalizeDecisionContext({ scenario: { pos: 'BTN', stack: 40 } });
    assert.equal(ctx.game.type, 'UNKNOWN');
    assert.equal(ctx.game.rake, 'UNKNOWN');
  });

  it('preflop atlas adapter marks partial context and no solver validation', () => {
    const ctx = normalizeDecisionContext({
      scenario: { pos: 'BTN', stack: 30, hero: ['As', 'Ks'], ctx: 'unopened' }
    });
    const ev = collectPreflopAtlasEvidence(ctx, POKER_DOMAINS.PREFLOP_RFI, {
      pack,
      classOf: (c) => 'AKs'
    });
    assert.ok(ev);
    assert.equal(ev.solverValidated, false);
    assert.equal(ev.meta.openSizingDimension, false);
    const match = compareEvidenceContext(ev, ctx);
    assert.ok([CONTEXT_MATCH.PARTIAL, CONTEXT_MATCH.COMPATIBLE].includes(match));
    assert.equal(ev.meta.lookupStackBB, 30);
  });

  it('VS_3BET evidence flags collapsed villain context', () => {
    const ctx = normalizeDecisionContext({
      scenario: { pos: 'CO', stack: 30, hero: ['Qh', 'Qd'], ctx: 'facing 3bet' }
    });
    const ev = collectPreflopAtlasEvidence(ctx, POKER_DOMAINS.PREFLOP_VS_3BET, {
      pack,
      classOf: () => 'QQ'
    });
    assert.ok(ev);
    assert.equal(ev.meta.villainPositionDimension, false);
  });

  it('analyze returns no fake recommendation when pack missing', () => {
    const res = analyze({ scenario: { pos: 'XX', stack: 30, hero: ['2s', '2h'], ctx: 'unopened' } }, { pack: { preflop: {} } });
    assert.equal(res.recommendation.action, null);
    assert.ok(res.flags.includes('NO_STRATEGY_AVAILABLE'));
  });

  it('grade preserves legacy letter grade via executor', () => {
    installPokerBrainForTests();
    const PB = globalThis.window.PokerBrain;
    const res = grade(
      {
        mode: 'swipe',
        scenario: {
          street: 'PREFLOP',
          pos: 'BTN',
          hero: ['As', 'Ks'],
          stack: 30,
          ctx: 'unopened, first in'
        }
      },
      'RAISE',
      {
        pack,
        classOf: PB.classOf.bind(PB),
        legacyGradeDecision: PB.gradeDecision.bind(PB),
        legacyNodeFor: PB.nodeFor.bind(PB)
      }
    );
    assert.ok(res.grading.available);
    assert.ok(['g', 'y', 'r'].includes(res.grading.grade));
    assert.equal(res.domain, POKER_DOMAINS.PREFLOP_RFI);
    assert.equal(res.provenance.solverValidated, false);
  });

  it('solver provider stub returns null evidence', async () => {
    const stub = createSolverProviderStub();
    const out = await stub.getEvidence({}, POKER_DOMAINS.PREFLOP_RFI);
    assert.equal(out, null);
  });

  it('cross-feature: ranges sel vs swipe same primary evidence key', () => {
    const ctxR = adapters.ranges({
      sel: { situation: 'rfi', position: 'BTN', stack: 30, format: '6max' },
      scenario: { pos: 'BTN', stack: 30, hero: ['As', 'Ks'], ctx: 'first in', street: 'PREFLOP' }
    });
    const ctxS = adapters.swipe({
      scenario: { pos: 'BTN', stack: 30, hero: ['As', 'Ks'], ctx: 'first in' }
    });
    const a = analyze({ context: ctxR }, { pack, classOf: () => 'AKs' });
    const b = analyze({ context: ctxS }, { pack, classOf: () => 'AKs' });
    assert.equal(a.domain, b.domain);
    assert.equal(a.explanation.technical, b.explanation.technical);
  });
});
