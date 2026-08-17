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

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}