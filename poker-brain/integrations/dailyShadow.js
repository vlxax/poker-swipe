/**
 * Shadow mode: compare library grading path vs Brain analyze (no user-facing change).
 */

const ACTION_NORM = {
  fold: 'FOLD',
  call: 'CALL',
  check: 'CHECK',
  raise: 'RAISE',
  '3bet': '3BET',
  '4bet': '4BET',
  all_in: 'JAM',
  bet: 'BET'
};

function normAction(a) {
  if (!a) return null;
  const s = String(a).toUpperCase();
  return ACTION_NORM[s.toLowerCase()] || s;
}

function dominantBrainAction(brainDecision) {
  const rec = brainDecision?.recommendation;
  if (rec?.action) return normAction(rec.action);
  const freqs = rec?.frequencies;
  if (!freqs) return null;
  const entries = Object.entries(freqs).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return normAction(entries[0][0]);
}

function libraryAction(libraryVerdict) {
  const a = libraryVerdict?.expectedAction || libraryVerdict?.action || libraryVerdict?.correct;
  if (!a) return null;
  if (/ФОЛД/i.test(a)) return 'FOLD';
  if (/КОЛЛ/i.test(a)) return 'CALL';
  if (/ЧЕК/i.test(a)) return 'CHECK';
  if (/3-БЕТ/i.test(a)) return '3BET';
  if (/4-БЕТ/i.test(a)) return '4BET';
  if (/ОЛЛ/i.test(a)) return 'JAM';
  if (/РЕЙЗ/i.test(a)) return 'RAISE';
  if (/СТАВКА/i.test(a)) return 'BET';
  return normAction(a);
}

export function classifyDailyShadow({ libraryVerdict, brainDecision, drill }) {
  if (!libraryVerdict) return { classification: 'NOT_COMPARABLE', reason: 'no_library_verdict' };
  if (!brainDecision) return { classification: 'NOT_COMPARABLE', reason: 'no_brain_decision' };

  if (brainDecision.flags?.includes('NO_STRATEGY_AVAILABLE') || !brainDecision.provenance?.primarySource) {
    return { classification: 'NO_BRAIN_EVIDENCE', reason: 'no_strategy_evidence' };
  }

  const lib = libraryAction(libraryVerdict);
  const brain = dominantBrainAction(brainDecision);
  if (!lib || !brain) {
    return { classification: 'NOT_COMPARABLE', reason: 'missing_action' };
  }

  const alsoOk = (drill?.alsoOk || libraryVerdict.alsoOk || []).map((x) => libraryAction({ action: x }));
  if (lib === brain) {
    const freq = brainDecision.recommendation?.frequencies?.[brainDecision.recommendation?.action];
    if (freq != null && freq < 0.55 && freq > 0) {
      return { classification: 'ACTION_MATCH_FREQUENCY_DIFFERENCE', reason: 'same_action_low_freq' };
    }
    return { classification: 'EXACT_MATCH', reason: 'action_match' };
  }

  if (alsoOk.includes(brain)) {
    return { classification: 'ACCEPTABLE_ACTION_OVERLAP', reason: 'brain_in_also_ok' };
  }

  if (brainDecision.conflicts?.length) {
    return { classification: 'CONFLICT', reason: 'evidence_conflict' };
  }

  return { classification: 'CONFLICT', reason: 'action_mismatch' };
}

/** @deprecated use classifyDailyShadow */
export function shadowCompareDaily({ libraryVerdict, brainDecision }) {
  const c = classifyDailyShadow({ libraryVerdict, brainDecision });
  if (c.classification === 'EXACT_MATCH') return 'MATCH';
  if (c.classification === 'NO_BRAIN_EVIDENCE') return 'NO_EVIDENCE';
  if (c.classification === 'NOT_COMPARABLE') return 'NOT_COMPARABLE';
  if (c.classification === 'CONFLICT') return 'CONFLICT';
  return 'COMPATIBLE';
}
