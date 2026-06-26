# ADR-0002: Seeded Pillars landmark with encounter-based wins

**Status:** Accepted  
**Date:** 2026-06-25  
**Domain glossary:** `CONTEXT.md`

## Context

Early M3 implementation and design docs described the Pillars of Frost win as a **distance-from-Searing threshold**: when the player pushed far enough ahead of the advancing line, the game auto-declared `win_pillars` at end-of-turn (or generated a landmark on the next hex). Restart the Gear similarly auto-won when relic count met a threshold.

That model made the Pillars a side effect of sprinting rather than a place to find, and it denied the Gear Ritual its intended player-choice beat. `/grill-with-docs` (2026-06-25) resolved a replacement model recorded in `CONTEXT.md`.

## Decision

**Pillars of Frost:** At game start, seed a `pillarsCoord` in the **safe corridor** (along the axis opposite the Searing's advance). Placement must be at least a minimum distance from both the player start and the Searing line, and may be placed anywhere from that minimum up to a maximum cap along the corridor. The player does **not** know the location at start. When map generation reveals that coordinate, it becomes the Pillars landmark hex. Entering it triggers a **single-acknowledgment** win encounter (no decline). A dedicated **optional** Pillars rumor chain guides players narratively but is not required to win.

**Restart the Gear:** When relic count meets threshold, entering any hex offers a **Gear Ritual** encounter with two choices — perform the ritual (win) or decline and continue. Re-offered on every hex entry while the threshold remains met.

**Shared rules:**
- Landmark/special encounters take **priority** over the Gear Ritual when both would fire on the same hex (Pillars wins).
- **Frost proximity** log messages fire when the player is within banded distance of `pillarsCoord` **and** within ±2 hexes of the safe-corridor line — not based on Searing distance alone.
- Wins resolve through encounters → `gameover` with `win_pillars` or `win_gear`; **no silent auto-win** in end-of-turn checks.

## Rationale

1. **Navigation fantasy:** Seeded coordinates turn the Pillars into a destination to discover (via frost hints and rumors), not an invisible finish line.
2. **Symmetric win beats:** Both paths get a narrative encounter before victory; Gear retains deferral, Pillars commits on arrival.
3. **Tunable without coupling:** Min/max placement distances and corridor tolerance are independent tuning knobs (M4), decoupled from Searing advance rate.
4. **Preserves pressure:** Unknown location + optional rumor chain keeps exploration tension without hard gates.

## Consequences

- Add `pillarsCoord` to `GameState`; seed in `createInitialState`.
- Replace `checkPillarsOfFrost(player, searing)` distance-threshold logic with coord equality / landmark generation in `map.ts`.
- Remove `win_pillars` / `win_gear` auto-win from `applyWinChecks` in `end-of-turn.ts`.
- Trigger Gear Ritual and Pillars encounters on hex entry in movement resolution; Pillars encounter priority first.
- Rework frost proximity in `movement.ts` to use distance-to-`pillarsCoord` plus safe-corridor check.
- Add Pillars rumor chain content (new rumor data).
- Replace `PILLARS_DISTANCE_THRESHOLD` tuning constant with `PILLARS_MIN_DISTANCE`, `PILLARS_MAX_DISTANCE`, and `SAFE_CORRIDOR_TOLERANCE`.
- Update `friends-family-demo.md`, `m3-win-conditions-game-feel.md`, and `difficulty-tuning-constants.md` (done with this ADR).

## Alternatives considered

**Distance threshold (rejected):** Simple to implement but conflates "far from Searing" with "found the Pillars," produces silent wins, and undermines frost messages as navigation feedback.

**Known map marker / compass (rejected):** Removes exploration tension; player should discover via frost and rumors.

**Required Pillars rumor gate (rejected):** Punishes players who push the safe corridor without finding the chain; asymmetrical with Gear path.

**Deferrable Pillars win (rejected):** Undercuts the landmark moment; deferral is reserved for Gear Ritual.
