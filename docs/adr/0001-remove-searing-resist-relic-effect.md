# ADR-0001: Remove `searing_resist` relic effect (YAGNI)

**Status:** Accepted  
**Date:** 2026-06-18  
**Issue:** APP-240 / APP-241

## Context

The `searing_resist` relic effect type exists in the domain model (`RelicEffectType`) and journal UI copy, but:

- No relic in `src/engine/data/relics.ts` uses it.
- No rumor chain reward references a `searing_resist` relic.
- The engine applies instant `loss_searing` when the player enters or stands on a consumed hex (`movement.ts`, `checks.ts`). There is no grace-period state or helper in `relics.ts`.

The M2 design spec listed `searing_resist` as one of several effect types, but all shipped relics use `max_resource`, `forage_bonus`, `hope_decay_slow`, or `move_discount`.

## Decision

**Option A — Remove (YAGNI).** Drop `searing_resist` from the relic effect type union, journal display, and design docs until a specific relic and encounter/rumor reward actually need it.

## Rationale

1. **Core tension:** The Searing is an unstoppable clock. Instant death on the consumed line keeps pressure clear and matches player-facing copy ("The Searing catches you").
2. **No content hook:** With no catalog relic or rumor reward assigned, implementing grace semantics would be speculative design and engine surface area.
3. **Grace semantics are underspecified:** Per-run budget vs per-edge stint vs reset-on-escape, stacking across relics, and interaction with searing advance on end-of-turn would all need playtesting before shipping.
4. **Future path is open:** If we want Searing-related relic power later, prefer either (a) slowing `advanceRate` (already noted in M4 tuning notes) or (b) reintroducing `searing_resist` with a fresh ADR once a named relic and rumor reward exist.

## Consequences

- Remove `searing_resist` from `RelicEffectType` and `extraTurns` from `RelicEffect` (only used by this variant).
- Remove journal `describeEffect` branch.
- Update M2 / friends-family design snippets to match the four live effect types.
- APP-241 implementation reduces to verifying removal and regression tests (no grace engine work).

## Alternatives considered

**Option B — Implement grace turns:** Deferred. Would require `GameState` tracking, loss-check changes, HUD/journal messaging, a target relic, and documented stacking rules. Not justified without content that needs it.
