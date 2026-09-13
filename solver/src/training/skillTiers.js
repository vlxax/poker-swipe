// Score-ranked skill tiers for session slot targeting.

export function buildSkillTiers(skillProfile) {
  if (!skillProfile || !skillProfile.skills) {
    return { primary: [], secondary: [], medium: [], strong: [], ranked: [] };
  }
  const STRONG_THRESHOLD = 82;
  const ranked = Object.values(skillProfile.skills)
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score);
  const strong = ranked.filter((s) => s.score >= STRONG_THRESHOLD).map((s) => s.skill);
  const nonStrong = ranked.filter((s) => s.score < STRONG_THRESHOLD);
  let primary = nonStrong.slice(0, 2).map((s) => s.skill);
  let secondary = nonStrong.slice(2, 4).map((s) => s.skill);
  let medium = ranked
    .filter((s) => s.score >= 45 && s.score <= 75 && !primary.includes(s.skill) && !secondary.includes(s.skill))
    .map((s) => s.skill);
  if (!medium.length) {
    medium = ranked
      .filter((s) => s.score >= 30 && s.score < STRONG_THRESHOLD && !primary.includes(s.skill) && !secondary.includes(s.skill))
      .map((s) => s.skill);
  }
  if (!medium.length && strong.length) {
    medium = ranked
      .filter((s) => s.score >= 70 && s.score < STRONG_THRESHOLD)
      .map((s) => s.skill);
  }
  if (!primary.length && !secondary.length && ranked.length >= 2) {
    primary = ranked.slice(0, 2).map((s) => s.skill);
    secondary = ranked.length > 2 ? ranked.slice(2, 4).map((s) => s.skill) : [];
    if (!medium.length && ranked.length > 4) {
      medium = ranked.slice(4, Math.min(6, ranked.length)).map((s) => s.skill);
    }
  }
  return { primary, secondary, medium, strong, ranked };
}
