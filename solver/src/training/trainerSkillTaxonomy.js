// Trainer preflop skill/context taxonomy for personalization writeback.

export const TRAINER_SKILL_IDS = [
  'rfi_unopened',
  'bb_defence',
  'vs_open',
  'vs_3bet',
  'vs_4bet',
  'squeeze',
  'vs_squeeze',
  'call_push',
  'sb_vs_bb',
  'short_stack',
  'hu_ante',
  'vs_limp'
];

const SOURCE_MODE_TO_SKILL = {
  uo: 'rfi_unopened',
  vs1r: 'vs_open',
  vs1rshort: 'bb_defence',
  vs1r1c: 'vs_open',
  vs2r: 'vs_open',
  vs3bet: 'vs_3bet',
  vs4bet: 'vs_4bet',
  vssqueeze: 'vs_squeeze',
  vslimp: 'vs_limp',
  callpush: 'call_push',
  sbvsbb: 'sb_vs_bb',
  huante: 'hu_ante'
};

export function trainerSkillsForTask(task) {
  const meta = task?.trainerMeta || {};
  const mode = meta.sourceMode || task?.trainerSourceMode;
  const skills = [];
  if (mode && SOURCE_MODE_TO_SKILL[mode]) skills.push(SOURCE_MODE_TO_SKILL[mode]);
  const stack = task?.heroStack ?? task?.effStack ?? task?.stack;
  if (stack != null && stack <= 15) skills.push('short_stack');
  const pos = task?.position || task?.pos;
  if (pos) skills.push(`pos_${String(pos).toUpperCase()}`);
  if (stack != null) {
    const band = stack <= 12 ? 'stack_micro'
      : stack <= 20 ? 'stack_short'
        : stack <= 30 ? 'stack_medium'
          : 'stack_deep';
    skills.push(band);
  }
  return [...new Set(skills)];
}

export function trainerSkillLabelRu(skillId) {
  const map = {
    rfi_unopened: 'RFI / unopened',
    bb_defence: 'Защита BB',
    vs_open: 'Vs open',
    vs_3bet: 'Vs 3-bet',
    vs_4bet: 'Vs 4-bet',
    squeeze: 'Сквиз',
    vs_squeeze: 'Vs squeeze',
    call_push: 'Call vs push',
    sb_vs_bb: 'SB vs BB',
    short_stack: 'Короткий стек',
    hu_ante: 'HU + ante',
    vs_limp: 'Vs limp'
  };
  return map[skillId] || skillId;
}

export function stackBandLabel(stackBb) {
  if (stackBb == null) return 'unknown';
  if (stackBb <= 12) return 'micro';
  if (stackBb <= 20) return 'short';
  if (stackBb <= 30) return 'medium';
  return 'deep';
}
