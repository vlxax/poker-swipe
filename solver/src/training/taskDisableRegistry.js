export const DISABLED_ACTIVE_TASKS = {
  T_Q832_AQ_V0: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_Q832_AQ_V1: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_Q832_AQ_V2: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_Q832_AQ_V3: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_JT85_KQ_V0: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_JT85_KQ_V1: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_JT85_KQ_V2: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair',
  T_JT85_KQ_V3: 'POSITION_MISMATCH: exact-node variant history omitted hero seat; fixed in library/exact-node adapters — re-enable after context repair'
};

export function disableReason(taskId) {
  return DISABLED_ACTIVE_TASKS[taskId] || null;
}

export function isDisabledTask(taskId) {
  return Boolean(DISABLED_ACTIVE_TASKS[taskId]);
}
