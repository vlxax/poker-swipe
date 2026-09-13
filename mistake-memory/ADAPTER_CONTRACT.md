# Adapter field contract (P1-4)

## rangeIntelligenceAdapter

| Field | Status | Notes |
|-------|--------|-------|
| weaknessScore | USED | Passed into attempt; influences severity fallback |
| components.actionError | USED | Fills classification only when attempt.classification is absent |
| components.frequencyDeviation | PASSTHROUGH | Stored on attempt; core frequency model uses counters+target, not this field |
| components.evidenceStrength | PASSTHROUGH | Stored in attempt.context for external consumers |
| components.actionRecency | PASSTHROUGH | context only |
| components.frequencyRecency | PASSTHROUGH | context only |

**Source of truth:** `attempt.classification` if present. RI never overrides it.

## strategyMapAdapter

| Field | Status | Notes |
|-------|--------|-------|
| priorityBoost | PASSTHROUGH | Caller must apply via `applyStrategyMapBoost`. reviewQueue does NOT auto-apply. |
| signals.* | PASSTHROUGH | Metadata for external consumers |

## reviewQueue

Does not read strategy-map boosts or RI passthrough fields.
