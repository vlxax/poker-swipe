# CSS Collision Report

Classifications: **intentional** | **dead** | **duplicate** | **conflicting** (fixed in PR #97 pass)

| Selector | Class | Fixed | Files | Note |
|----------|-------|-------|-------|------|
| `#profileArea` | intentional | — | 3 | profile.css wins (loaded late); v39 v38 block removed |
| `#dailyArea` | intentional | — | 2 | game-visual-system + mini-app-compact; bridge in ps-ui-unified.css |
| `#polyana` | intentional | — | 6 | scoped #polyana in polyana-integrated.css |
| `#psPolyanaArea` | duplicate | — | 2 | polyana/polyana-integrated.css + root polyana-integrated.css — verify single link in index |
| `.screen` | intentional | — | 10 | display toggle in style.css; motion in ps-ui-unified |
| `.screen.active` | conflicting | yes | 6 | undefined |
| `.hidden` | intentional | — | 4 | utility class across bundles |
| `.card` | intentional | — | 5 | poker table cards vs app cards — different contexts |
| `.nav` | intentional | — | 13 | bottom nav patches; tokens do not override layout grid |
| `.nav button` | intentional | — | 10 | nav chrome; press scale in game-motion + unified bridge |
| `#home` | intentional | — | 6 | v36 home + polish gradients |
| `.v32` | dead | — | 2 | legacy hooks only |
| `.v38` | dead | — | 1 | DOM removed; CSS stripped from v39 |
| `.psScreen` | intentional | — | 2 | design system shell |
| `.psCard` | intentional | — | 1 | design system |
| `.psBtn` | intentional | — | 1 | design system |

## Motion owner (final)

- **Screen enter:** `ps-design-tokens.css` `@keyframes psScreenEnter` + `ps-ui-unified.css` `.psScreen.screen.active`
- **game-motion.css:** no longer sets `animation: none` on `.screen.active`
- **game-polish.css:** optional `.ps-screen-enter` uses `psScreenEnterPolish` (distinct keyframes)
