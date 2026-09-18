/** Map canonical context → legacy poker_brain spot shape (preserves extra fields from raw). */
export function spotFromContext(context) {
  const raw = context._raw || {};
  const spot = raw.spot || raw.scenario || raw.hand || raw;
  const desc = spot.ctx || spot.description || '';
  return {
    spotId: spot.spotId || spot.id,
    id: spot.id || spot.spotId,
    street: context.street !== 'UNKNOWN' ? context.street : spot.street,
    hero: context.hero?.cards !== 'UNKNOWN' ? context.hero?.cards : spot.hero,
    board: context.board !== 'UNKNOWN' ? context.board : spot.board,
    pos: context.hero?.position !== 'UNKNOWN' ? context.hero?.position : spot.pos,
    stack: context.effectiveStackBB !== 'UNKNOWN' ? context.effectiveStackBB : spot.stack,
    pot: context.potBB !== 'UNKNOWN' ? context.potBB : spot.pot,
    ctx: desc || buildCtxFromContext(context),
    theme: spot.theme,
    openSizeBB: spot.openSizeBB,
    ...spot
  };
}

function buildCtxFromContext(ctx) {
  const parts = [];
  if (ctx.actionHistory?.some((a) => a.action === 'UNOPENED')) parts.push('unopened');
  const open = ctx.actionHistory?.find((a) => a.action === 'OPEN');
  if (open) parts.push(`open from ${open.position}`);
  if (ctx.actionHistory?.some((a) => /3BET/i.test(a.action))) parts.push('3bet');
  return parts.join('; ') || ctx.facing?.type || '';
}
