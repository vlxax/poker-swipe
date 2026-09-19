/** Audit table — do not delete legacy files in v1 */
export const LEGACY_BRAIN_OWNERSHIP = [
  { file: 'poker_brain.js', status: 'ADAPTER_REQUIRED', role: 'Core pack lookup + gradeDecision' },
  { file: 'poker_brain_v20.js', status: 'DIAGNOSTIC_ONLY', role: 'ICM approximation snippets' },
  { file: 'poker_brain_v33.js', status: 'ADAPTER_REQUIRED', role: 'Context parsing overlay' },
  { file: 'poker_brain_v34.js', status: 'ACTIVE', role: 'Teaching copy overlay on gradeDecision' },
  { file: 'poker_brain_v25.js', status: 'DEAD', role: 'Superseded reference in index fragments' },
  { file: 'poker-brain/', status: 'ACTIVE', role: 'Canonical decision engine owner' }
];
