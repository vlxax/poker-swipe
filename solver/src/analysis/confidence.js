// Confidence 0..1 and label (high/medium/low) based on:
//  - number of Monte Carlo simulations
//  - villain range combo count / size
//  - whether heuristic assumptions were used
export function confidenceFor({
  analysisMethod,
  simulations = 0,
  comboCount = 0,
  heuristic = false,
  iterations = 0
}) {
  let score = 0.5;
  const n = analysisMethod === 'exact' ? 1 : simulations || iterations;

  if (analysisMethod === 'exact') {
    score = 0.98;
  } else if (n >= 200000) score = 0.96;
  else if (n >= 100000) score = 0.94;
  else if (n >= 50000) score = 0.9;
  else if (n >= 20000) score = 0.85;
  else if (n >= 5000) score = 0.75;
  else score = 0.6;

  // smaller ranges = more confidence; very wide ranges = slightly less
  if (comboCount > 0 && comboCount > 500) score -= 0.05;

  if (heuristic) score -= 0.25;

  score = Math.max(0.05, Math.min(0.99, score));
  const label = score >= 0.85 ? 'high' : score >= 0.6 ? 'medium' : 'low';
  return { confidence: round(score, 2), label };
}

// Confidence for a CFR solver result. Unlike the heuristic path, this is aware of
// convergence, exploitability and the abstraction granularity, and it must NEVER
// report "high" if the solver did not converge or the abstraction is too coarse.
export function solverConfidence({
  converged = false,
  stopReason = 'max_iterations',
  exploitabilityBB = Infinity,
  iterations = 0,
  minIterations = 200,
  chanceAbstraction = Infinity,
  betAbstraction = 1,
  rangeAbstraction = 0,
  evSeparationBB = 0
}) {
  const reasons = [];
  let score = 0.5;

  if (converged) {
    score += 0.28;
    reasons.push('Решение сошлось');
  } else {
    score -= 0.3;
    reasons.push(`Решение не сошлось (${stopReason})`);
  }

  const exp = Number.isFinite(exploitabilityBB) ? exploitabilityBB : Infinity;
  if (exp <= 0.005) { score += 0.15; reasons.push(`Exploitability ${bb(exp)}`); }
  else if (exp <= 0.02) { score += 0.1; reasons.push(`Exploitability ${bb(exp)}`); }
  else if (exp <= 0.1) { score += 0.03; reasons.push(`Exploitability ${bb(exp)}`); }
  else { score -= 0.12; reasons.push(`Exploitability ${bb(exp)} — грубое приближение`); }

  if (iterations >= minIterations) {
    score += 0.02;
    reasons.push(`${iterations} итераций`);
  } else if (iterations > 0) {
    score -= 0.05;
    reasons.push(`Мало итераций (${iterations})`);
  }

  // Abstraction penalties.
  const chanceCap = Number.isFinite(chanceAbstraction) ? chanceAbstraction : Infinity;
  if (Number.isFinite(chanceCap)) {
    score -= chanceCap <= 1 ? 0.2 : 0.08;
    reasons.push(`Ограниченная chance abstraction (${chanceCap} ветка${chanceCap === 1 ? '' : 'и'})`);
  }
  const bet = Number.isFinite(betAbstraction) ? betAbstraction : 1;
  if (bet > 0.5) { score -= 0.05; reasons.push('Крупные размеры ставок'); }
  score -= rangeAbstraction * 0.2;

  // Action EV separation: if the top actions are nearly tied, the recommendation
  // is inherently less decisive.
  if (evSeparationBB >= 0 && evSeparationBB < 0.02) {
    score -= 0.08;
    reasons.push('EV лучших действий близки');
  }

  // High confidence is only possible when the solver actually converged.
  let level;
  if (score >= 0.8 && converged) level = 'high';
  else if (score >= 0.6) level = 'medium';
  else level = 'low';

  score = Math.max(0.05, Math.min(0.97, score));
  return { score: round(score, 2), level, reasons };
}

function bb(n) {
  return `${Number(n).toFixed(3)} ББ`;
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}