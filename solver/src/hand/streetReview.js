// First major mistake: earliest street whose EV loss exceeds later streets'
// downstream error, so a turn leak is not reported as a river-only blunder.

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];

export function firstMajorMistake(decisions = [], { majorEvLossBB = 0.15 } = {}) {
  const solved = (decisions || []).filter((d) => d && (d.evLossBB != null || d.grade));
  let first = null;
  for (const d of solved) {
    const loss = Number(d.evLossBB) || 0;
    const badGrade = ['MISTAKE', 'BIG_MISTAKE', 'BIG MISTAKE', 'INACCURATE', 'r'].includes(d.grade || d.mistakeSeverity);
    const major = loss >= majorEvLossBB || (badGrade && loss >= 0.05);
    if (major) {
      first = {
        street: d.street,
        decisionIndex: d.index ?? d.decisionIndex,
        evLossBB: loss,
        action: d.actionTaken || d.action
      };
      break;
    }
  }
  const river = [...solved].reverse().find((d) => d.street === 'river');
  return {
    firstMajorMistake: first,
    label: first ? `FIRST MAJOR MISTAKE: ${String(first.street).toUpperCase()}` : null,
    doNotBlameOnlyRiver: Boolean(first && first.street !== 'river' && river && (Number(river.evLossBB) || 0) > 0)
  };
}

export function streetByStreetReview(decisions = []) {
  const byStreet = {};
  for (const d of decisions || []) {
    const street = d.street || 'unknown';
    byStreet[street] = {
      street,
      action: d.actionTaken || d.action || null,
      recommendedAction: d.recommendedAction || null,
      evLossBB: d.evLossBB ?? null,
      confidence: d.confidence || null,
      strategySource: d.strategySource || d.confidence?.strategySource || null,
      explanation: d.explanation || null
    };
  }
  const major = firstMajorMistake(decisions);
  return {
    streets: STREET_ORDER.filter((s) => byStreet[s]).map((s) => byStreet[s]),
    ...major
  };
}
