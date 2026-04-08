# Difficulty Tuning Constants (M4)

Target feel: accessible survival for friends-and-family playtests. Risk should stay present, but early runs should usually survive long enough to see both win paths.

## Tunable constants

| Constant | File | Previous | Current | Notes |
| --- | --- | --- | --- | --- |
| `STARTING_SUPPLY` | `src/engine/state.ts` | `6` | `7` | Adds one extra turn of early runway. |
| `MAX_SUPPLY` | `src/engine/state.ts` | `10` | `10` | No change. |
| `STARTING_HOPE` | `src/engine/state.ts` | `5` | `5` | No change. |
| `MAX_HOPE` | `src/engine/state.ts` | `5` | `5` | No change. |
| `STARTING_HEALTH` | `src/engine/state.ts` | `3` | `3` | No change. |
| `MAX_HEALTH` | `src/engine/state.ts` | `5` | `5` | No change. |
| `SEARING_ADVANCE_RATE` | `src/engine/state.ts` | `4` | `5` | Slows map pressure from every 4 to every 5 turns. |
| `HOPE_DECAY_INTERVAL` | `src/engine/state.ts` | `6` | `7` | Slows passive hope loss. |
| `PILLARS_DISTANCE_THRESHOLD` | `src/engine/win.ts` | `20` | `18` | Makes Pillars win more reachable in demo sessions. |
| `GEAR_RELIC_THRESHOLD` | `src/engine/win.ts` | `5` | `4` | Lowers relic grind for the alternate win. |
| `RUMOR_TAG_WEIGHT_BONUS` | `src/engine/rumors.ts` | `0.25` | `0.30` | Improves hinted-tag encounter targeting. |
| `RUMOR_BIOME_WEIGHT_BONUS` | `src/engine/rumors.ts` | `0.20` | `0.25` | Improves hinted-biome encounter targeting. |
| Quiet night chance | `src/engine/data/incidents.ts` | `0.60` | `0.70` | Reduces camp incident frequency from 40% to 30%. |
| `FORAGE_TABLE.mountain.chance` | `src/engine/resources.ts` | `0.30` | `0.35` | Slightly less punishing in mountain starts. |
| `FORAGE_TABLE.ruins.chance` | `src/engine/resources.ts` | `0.50` | `0.55` | More stable supply loops in ruins. |
| `FORAGE_TABLE.wastes.chance` | `src/engine/resources.ts` | `0.20` | `0.30` | Reduces dead-end runs in wastes. |

## Validation protocol

For next manual tuning pass, run 5-10 games split across:

- Rush strategy (direct Pillars pressure)
- Explore strategy (rumor + relic hunting)

Track per run:

- turns survived
- outcome
- supply-outs and hope-outs count
- whether at least one rumor chain completed

Tune again if median run length is outside 20-40 turns.
