import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';
import { adapters, normalizeDecisionContext } from '../../poker-brain/context/normalize.js';
import { normalizeActionHistory } from '../../poker-brain/context/actionHistory.js';
import { deriveEffectiveStackBB } from '../../poker-brain/context/effectiveStack.js';
import { derivePotAndSpr } from '../../poker-brain/context/potSpr.js';
import { analyze } from '../../poker-brain/index.js';
import { compareEvidenceContextDetail, CONTEXT_MATCH } from '../../poker-brain/evidence/compareEvidenceContext.js';
import { collectPreflopAtlasEvidence } from '../../poker-brain/evidence/preflopAtlasAdapter.js';
import { POKER_DOMAINS } from '../../poker-brain/routing/resolvePokerDomain.js';
import { buildCanonicalSpot } from '../../task-context/canonicalSpot.js';
import { resolvePokerEvidence } from '../../poker-brain/evidence/resolvePokerEvidence.js';

const pack = loadPokerBrainPackFromStrategyFile();

const FIXTURE_VS_3BET = {
  street: 'PREFLOP',
  position: 'CO',
  hero: ['A♠', '5♠'],
  heroStack: 31,
  villain: 'BTN',
  villainStack: 50,
  effStack: 31,
  history: [
    { street: 'ПРЕФЛОП', text: 'CO открыл 2.3 ББ, BTN 3-бет 7.5 ББ.', pot: 11 }
  ]
};

describe('PokerBrain real context integration V2', () => {
  it('normalizes action history with canonical fields and rawAction metadata', () => {
    const hist = normalizeActionHistory([
      { street: 'PREFLOP', actor: 'HERO', action: 'РЕЙЗ', size: 2.3 },
      { street: 'PREFLOP', actor: 'VILLAIN', position: 'BTN', action: '3-БЕТ', size: 7.5 }
    ]);
    assert.equal(hist.length, 2);
    assert.equal(hist[0].action, 'RAISE');
    assert.equal(hist[1].action, '3BET');
    assert.equal(hist[1].amountBB, 7.5);
    assert.ok(hist[1].metadata?.rawAction);
  });

  it('effective stack uses min hero/villain not hero alone', () => {
    const eff = deriveEffectiveStackBB({ heroStackBB: 55, villainStacksBB: [31] });
    assert.equal(eff.effectiveStackBB, 31);
    assert.equal(eff.method, 'HEADS_UP_MIN');
  });

  it('pot/SPR only when reliable', () => {
    const { spr, sprReliable } = derivePotAndSpr({
      potBB: 10,
      effectiveStackBB: 30,
      actionHistory: [],
      street: 'FLOP'
    });
    assert.equal(spr, 3);
    assert.equal(sprReliable, true);
  });

  it('VS_3BET exposes collapsed villain and sizing in compatibility', () => {
    const canonical = buildCanonicalSpot(FIXTURE_VS_3BET);
    const ctx = adapters.swipe({ scenario: { ...canonical, _canonical: canonical } });
    const ev = collectPreflopAtlasEvidence(ctx, POKER_DOMAINS.PREFLOP_VS_3BET, {
      pack,
      classOf: () => 'A5s'
    });
    const detail = compareEvidenceContextDetail(ev, { ...ctx, domainNeedsVillainPosition: true });
    assert.equal(detail.match, CONTEXT_MATCH.PARTIAL);
    assert.ok(detail.ignoredMaterialFields.includes('threeBettorPosition'));
    assert.ok(detail.ignoredMaterialFields.includes('threeBetSizeBB') || detail.ignoredMaterialFields.includes('openSizeBB'));
    assert.equal(ev.meta.stackBucketDistanceBB, 1);
  });

  it('stack bucket distance for 33bb → 30', () => {
    const ctx = normalizeDecisionContext({
      scenario: { pos: 'CO', stack: 33, hero: ['Ah', '5h'], ctx: 'facing 3bet' }
    });
    assert.equal(ctx.stackBucket.lookupStackBB, 30);
    assert.equal(ctx.stackBucket.stackBucketDistanceBB, 3);
  });

  it('my hands preserves full action history length', () => {
    const hand = {
      hero: ['K♠', 'K♦'],
      heroSeat: 'BB',
      villainPosition: 'BTN',
      effectiveStack: 40,
      street: 'PREFLOP',
      board: [],
      actions: [
        { actor: 'VILLAIN', street: 'PREFLOP', action: 'RAISE', size: 2.2 },
        { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 8 },
        { actor: 'VILLAIN', street: 'PREFLOP', action: 'CALL', size: 8 }
      ]
    };
    const ctx = adapters.myhands({ hand });
    assert.equal(ctx.actionHistory.length, 3);
    assert.equal(ctx.actionHistory[2].action, 'CALL');
  });

  it('cross-feature same situation normalizes equivalent domain and stack bucket', () => {
    const scenario = { street: 'PREFLOP', pos: 'BTN', hero: ['As', 'Ks'], stack: 30, ctx: 'unopened, first in' };
    const ctxSwipe = adapters.swipe({ scenario });
    const ctxHands = adapters.myhands({
      hand: {
        street: 'PREFLOP',
        heroSeat: 'BTN',
        effectiveStack: 30,
        hero: ['As', 'Ks'],
        actions: [],
        ctx: 'unopened, first in'
      }
    });
    const d1 = analyze({ context: ctxSwipe }, { pack, classOf: () => 'AKs' }).domain;
    const d2 = analyze({ context: ctxHands }, { pack, classOf: () => 'AKs' }).domain;
    assert.equal(d1, d2);
    assert.equal(ctxSwipe.effectiveStackBB, ctxHands.effectiveStackBB);
  });

  it('EXACT_NODES evidence ranks above POSTFLOP_ATLAS', () => {
    const collected = {
      evidence: [
        { layerId: 'POSTFLOP_ATLAS', contextMatch: 'PARTIAL', policy: { CHECK: 40, BET: 60 }, source: 'POSTFLOP_ATLAS' },
        { layerId: 'EXACT_NODES', contextMatch: 'COMPATIBLE', policy: { CHECK: 10, BET: 90 }, source: 'EXACT_REFERENCE_NODE' }
      ]
    };
    const resolved = resolvePokerEvidence({}, collected);
    assert.equal(resolved.primary.layerId, 'EXACT_NODES');
  });

  it('analyze does not throw on malformed input', () => {
    const res = analyze({ scenario: { pos: null, stack: 'xx', hero: [] } }, { pack: { preflop: {} } });
    assert.ok(res.flags.includes('NO_STRATEGY_AVAILABLE'));
  });

  it('sizing spot with _canonical passes pot and stacks', () => {
    const task = {
      id: 'SZ_TEST',
      street: 'ФЛОП',
      position: 'BTN',
      villain: 'BB',
      hero: ['A♠', 'K♠'],
      board: ['K♥', '7♦', '2♣'],
      heroStack: 45,
      villainStack: 42,
      pot: 12,
      history: [{ street: 'ФЛОП', text: 'Чек BB, решение Hero.', pot: 12 }]
    };
    const canonical = buildCanonicalSpot(task);
    const ctx = adapters.sizing({ spot: { _canonical: canonical, pot: 12 } });
    assert.equal(ctx.potBB, 12);
    assert.ok(ctx.effectiveStackBB <= 45);
  });
});
