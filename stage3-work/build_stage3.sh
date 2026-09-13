#!/bin/bash

# Stage 3 Build Script
# Combines base engine, extended presets, scenarios, and new features

echo "Building Stage 3..."

# Get first 2100 lines from base (engine)
head -2100 base.html > stage3_temp.html

# Add extended opponent presets
cat >> stage3_temp.html << 'PRESETS_END'

// ============================================================
//  OPPONENT PRESETS - EXPANDED (Stage 3)
// ============================================================

const OPPONENT_PRESETS = {
PRESETS_END

# Insert extended presets (excluding module.exports)
grep -v "module.exports" opponent_presets_extended.js | grep -v "^//" | tail -n +3 >> stage3_temp.html

cat >> stage3_temp.html << 'SCENARIOS_HEADER'
};

// ============================================================
//  SCENARIO LIBRARY (Stage 3)
// ============================================================

const SCENARIO_LIBRARY = {
SCENARIOS_HEADER

# Insert scenarios (skip opening and closing)
sed -n '/^  \/\/ =/,/^  }/p' scenario_templates.js | sed '1,2d;$d' >> stage3_temp.html

cat >> stage3_temp.html << 'ENDSCENARIOS'
};

// Map library to old SCENARIOS format for compatibility
const SCENARIOS = {};
Object.entries(SCENARIO_LIBRARY).forEach(([key, scenario]) => {
  SCENARIOS[scenario.id] = scenario;
});

ENDSCENARIOS

# Get rest of base file from line 2200 onwards
tail -n +2200 base.html >> stage3_temp.html

# Move to final location
mv stage3_temp.html PokerSwipe_DailyHand_STAGE3.html

echo "✓ Stage 3 production file created"
echo "$(wc -l PokerSwipe_DailyHand_STAGE3.html | awk '{print $1}') lines"
