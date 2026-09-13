import { STRATEGY_SOURCE } from '../analysis/strategySource.js';
import { validateIcmInputs } from './icmInputs.js';

export function validatePkoInputs({
  heroBounty = null,
  villainBounty = null,
  effectiveStack = null,
  bountyValue = null,
  remainingPlayers = null,
  payouts = null,
  stacks = null
} = {}) {
  const missing = [];
  if (heroBounty == null || !Number.isFinite(Number(heroBounty))) missing.push('hero_bounty');
  if (villainBounty == null || !Number.isFinite(Number(villainBounty))) missing.push('villain_bounty');
  if (effectiveStack == null || !Number.isFinite(Number(effectiveStack))) missing.push('effective_stack');
  if (bountyValue == null || !Number.isFinite(Number(bountyValue))) missing.push('bounty_value');
  if (remainingPlayers == null) missing.push('remaining_players');
  const icm = validateIcmInputs({ stacks, payouts, playersRemaining: remainingPlayers });
  if (!icm.ok) missing.push(...icm.missing.map((m) => `tournament:${m}`));

  const bountyPresent = heroBounty != null && villainBounty != null;
  const ok = missing.length === 0;
  return {
    ok,
    missing,
    bountyPresent,
    missingBountyTreatedAsZero: false,
    strategySource: ok ? STRATEGY_SOURCE.HEURISTIC : STRATEGY_SOURCE.HEURISTIC,
    canClaimPkoSolver: false,
    note: ok
      ? 'PKO overlay uses bounty economics + tournament inputs. Not a full PKO solver.'
      : 'Incomplete PKO inputs — heuristic only; missing bounty is not treated as zero.'
  };
}

export function pkoCallOverlay({ villainBounty, bountyValue, callAmount } = {}) {
  if (villainBounty == null || bountyValue == null || callAmount == null) {
    return { overlay: null, reason: 'missing_bounty_or_price' };
  }
  const bounty = Number(villainBounty) * Number(bountyValue);
  return { overlay: bounty / Number(callAmount), bountyChipEv: bounty };
}
