# Compiler reconstruction notes

Source: Cursor transcript Write + 3 StrReplace for compileTrainerProduction.py
(chat 638e99a8-a505-496f-889e-db0070a607aa).

Deviations from transcript (intentional):
1. find_import_root: also probes ~/Desktop/zzzz/data/trainer-ranges
2. End-of-compile: COPY uo-hand-records.json → uo-hand-records.legacy.json
   instead of rename, so trusted baseline file remains in place.
