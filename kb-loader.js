export async function loadPokerKB() {
  const files = [
    '00_shared_math.json',
    '01_shared_board_textures.json',
    '02_shared_glossary.json',
    '03_shared_freaky_voice.json',
    '10_onboarding_diagnostic.json',
    '20_swipe.json',
    '30_sizing.json',
    '40_review.json',
    '50_daily.json',
    '60_heal.json',
    '70_my_hands.json',
    '80_reg_battle.json',
    '90_you.json',
    '95_preflop_principles.json',
    '96_river_principles.json'
  ];
  const entries = await Promise.all(
    files.map(async file => [file, await fetch(`./data/${file}`).then(r => r.json())])
  );
  return Object.fromEntries(entries);
}
