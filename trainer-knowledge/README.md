# Trainer Knowledge Layer

Single source of truth for PokerSwipe trainer range data from branch `vlxax-ranges`.

## Architecture

```
data/trainer/source/     Raw manifests, UO JSON, chart ZIP chunks
data/trainer/built/      Generated indexes (run build)
trainer-knowledge/       Runtime lookup API
```

```
TRAINER SOURCE → NORMALIZED TRAINER KNOWLEDGE → QUERY/SELECTOR → CONSUMERS
```

## Build

```bash
node trainer-knowledge/scripts/buildTrainerKnowledge.mjs
```

Extracts Batch 2 WEBP colors conservatively, imports UO normalized records, builds dimension indexes, generates conflict/unmapped reports.

## Runtime API

```js
import {
  lookupTrainerSpot,
  lookupTrainerHandAction,
  getTrainerMeta,
  TRAINER_STATUS,
  MATCH_STATUS
} from './trainer-knowledge/index.js';
```

## Status rules

| Label | Grading | Notes |
|-------|---------|-------|
| AI, RAISE | ✅ EXACT_TRAINER_DATA | Literal trainer legend |
| UO, nAI, UNSELECTED, LOW_PLAYABILITY | ❌ NEEDS_CLARIFICATION | Preserved raw, no inference |
| Batch 2 manifest-only | PARTIAL_TRAINER_DATA | Dimensions without confirmed hand strategy |

## Reports

- `TRAINER_TERMS_TO_CLARIFY.md`
- `TRAINER_UNMAPPED_SPOTS.md`
- `TRAINER_DATA_CONFLICTS.md`
