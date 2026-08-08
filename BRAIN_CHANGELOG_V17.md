# V17 Brain integration

- Removed hard-coded grading from Poker Swipe runtime path; decisions now go through `PokerBrain.gradeDecision`.
- Sizing uses action policy + size-family fit from Brain.
- Daily action/size grade uses Brain; argument-board stays a separate reasoning score.
- Review culprit/loss map and repair size use Brain line models.
- My Hands gets software analysis of the last Hero decision using exact/nearest model matching.
- X-Ray exposes exact combo-removal engine status.
- YOU stores Brain metadata and shows the active data volume.
- Home shows Brain online state and policy count.

No fake EV values are shown.
