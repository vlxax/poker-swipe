POKER SWIPE V29 — SAFE SOCIAL PATCH

BASE:
- exact V25 SMART DIAGNOSTIC + POKER INTELLIGENCE from Лерочка.zip

RULE:
- original V25 boots first
- social/Supabase layer installs only AFTER window.__pokerBooted=true
- no V25 screen is replaced during startup

PRESERVED:
- Smart Diagnostic 12 spots
- Poker Intelligence / PokerBrain
- МОИ КАРТЫ
- tournaments
- Push/Fold
- sizing / daily / review / heal / x-ray
- existing V25 YOU logic

ADDED SAFELY:
- isolated local profile by Telegram user ID (device ID fallback)
- Supabase public profile sync
- real other players list in YOU
- public profile with plain-language comparison: stronger/weaker/about equal
- explanation of what Preflop/Postflop/Sizing/Discipline scores mean
- rank ladder and first 3 character arts
- no null 'Form' in public profiles

TEST ORDER:
1. Page must boot exactly like V25.
2. Open YOU.
3. Rank block and Other Players should appear.
4. Use another Telegram/device and verify second row in Supabase.
