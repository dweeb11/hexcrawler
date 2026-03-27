# The Waning Light — Friends & Family Demo Design Spec

## Overview

This spec covers the roadmap from functional prototype to a playable demo suitable for friends and family. Four milestones, each producing a playable build:

- **M1:** Minimum Viable UX + Save/Load
- **M2:** Rumor Deck + Relics + Encounter Overhaul
- **M3:** Win Conditions + Game Feel
- **M4:** Analytics + Demo Polish

## Milestone 1: Minimum Viable UX + Save/Load

### Goal

A non-developer can pick this up cold, understand how to play, complete a session, leave, and come back.

### Hex Display Simplification

MUST: Remove tag glyphs from the hex map entirely. Each hex shows only:
- Biome glyph (`♠` forest, `▲` mountain, `Ω` ruins, `⌂` settlement, `~` wastes)
- Visited vs unvisited state (full brightness vs dimmed)
- Searing gradient (`░▒▓█` advancing from consumed side)
- Player position (`@`)

MUST: Tags surface only in encounter narrative text (e.g., "This clearing sits beside a stream, ancient stones half-buried in the undergrowth"), not on the map.

### Persistent Key Legend

MUST: Always-visible panel showing available actions for the current game mode.

**Map mode:**
- Hex directional diagram showing QWEASD mapped to the six hex neighbors — the diagram must visually match the hex grid orientation so there is no ambiguity about which key moves which direction
- Action keys: R (rest), F (forage), J (journal — added in M2, legend updated then)

**Encounter mode:**
- Numbered choices (1, 2, 3)

**Game over mode:**
- Enter for new game

### Resource HUD

MUST: Supply, Hope, Health bars with numeric values and clear labels.
MUST: Color coding — green (healthy), yellow (warning), red (critical) — paired with icons or symbols, not color alone (colorblind safety).
SHOULD: Searing proximity warning when it's within N hexes of the player.

### Tutorial Hints

MUST: Contextual, first-game-only messages that appear when relevant:
- First turn: "QWEASD to move, R to rest, F to forage"
- First low supply: "Press F to forage for supplies"
- First encounter: "Choose with 1, 2, or 3"
- First rumor discovered (M2): "Press J to open your journal"

MUST: Hints dismiss when the relevant action is taken. Do not repeat after first trigger.
MUST: Hint state stored in LocalStorage so hints don't re-trigger on reload.

### Event Log Improvements

MUST: Visual hierarchy in the log — encounter outcomes, resource changes, and searing warnings should be visually distinct.
MUST: Resource deltas shown inline with color: "+2 Supply" in green, "-1 Hope" in amber, "-1 Health" in red.

### Save/Load

MUST: Auto-save to LocalStorage after every turn resolution.
MUST: On game start, check for existing save. If found, show "Continue" / "New Game" prompt.
MUST: "New Game" clears the save. Win or loss clears the save.
MUST: Implement `serialize`/`deserialize` helpers in `state.ts` for Map/Set conversion.

**What gets saved:** Entire `GameState` — player position, map, searing state, resources, turn count, log (capped to last 50 entries to avoid bloat). In M2, extended to include rumor progress and relic inventory.

**What doesn't get saved:** Encounter data cache (re-fetched on load), UI state (camera position, panel toggles).

### Parallel Work (M1)

Save/load engine work (serialization) is independent of all UX changes. These can be built concurrently.

---

## Milestone 2: Rumor Deck + Relics + Encounter Overhaul

### Goal

The game has systemic depth and tells stories. Every hex is interesting. The Rumor Deck gives exploration purpose. Relics give tangible progression.

### Encounter Density Model

**Current model (replaced):** Encounters are sparse — only hexes whose tags match a specific encounter in the database get one. Unmatched hexes are empty.

**New model:** Every hex has an encounter. Tag count drives rarity:

| Tag requirement | Rarity | Role | Demo pool size |
|---|---|---|---|
| 1 tag | Common | Bread-and-butter biome flavor. Short, atmospheric. | ~8-10 per biome (40-50 total) |
| 2 tags | Uncommon | More specific situations. Richer text, meaningful choices. | ~3-5 per relevant tag combo (~30-40 total) |
| 3 tags | Rare | Memorable set-pieces. Strong narrative, significant resource swings. | ~1-2 per plausible combo (~10-15 total) |
| Rumor step | Unique | Multi-step story encounters spawned by the quest system. | ~3-5 per rumor chain, 4-6 chains |

MUST: When generating a hex, match the highest tag-count encounter available. Fall back to a 1-tag common encounter. Rarer encounters take priority when a hex qualifies.

MUST: Tags surface in encounter narrative text, not on the hex map. A hex tagged `water, ancient` shows encounter text like "A stream cuts through crumbling foundations" — the player absorbs the tags through story, not symbols.

MUST: Demo ships with ~80-100 encounters across all tiers, plus rumor chain encounters. This is the longest-lead content item.

### Rumor Deck (Journal System)

The Rumor Deck is a journal of multi-step narrative chains. "Deck" is the internal name for the randomization system — the player-facing metaphor is a journal of leads and whispers.

**Data model:**

```typescript
interface Rumor {
  id: string;
  title: string;              // "The Whispering Well"
  steps: RumorStep[];         // ordered sequence
  reward: Relic | null;       // granted on final step completion
  hopeBonus: number;          // Hope gained on completion
}

interface RumorStep {
  stepIndex: number;
  encounter: Encounter;       // the encounter for this step
  hint: string;               // narrative hint toward next step's location
                              // e.g., "She mentioned frozen peaks to the north"
  hintTags: string[];         // tags the hint implies (used by generation weighting)
  hintBiomes?: Biome[];       // biomes the hint implies (optional)
}
```

**Discovery:** Players discover rumors through regular encounters. A 2-tag or 3-tag encounter may include a rumor hook — an extra outcome that adds a rumor to the journal. Not every encounter has one.

**Progression — the dual-pull mechanic:**

1. **Narrative hint (player-facing):** Completing a rumor step shows text with a keyword hint suggesting terrain/biome to seek. Example: *"The old map points toward stone ruins near water."* The player reads this and makes exploration choices. This rewards paying attention to the narrative.

2. **Weighted generation (system-facing, invisible):** When the player has an active rumor, hex generation gets a weight bonus toward the next step's `hintTags` and `hintBiomes`. SHOULD: +20-30% weight on matching tags/biomes during hex generation. This doesn't guarantee the next hex matches — it nudges probability so the player doesn't wander 30 turns without finding the right terrain.

**Rumor step triggering:** When the player enters a hex whose tags satisfy the next step's encounter requirements, that rumor step triggers instead of the normal hex encounter. If multiple active rumors could match the same hex, the rumor with the fewest remaining steps takes priority (closest to completion). The skipped rumor can still trigger on a future matching hex.

**Completion:** On final step: Hope bonus applied, Relic reward granted (if any), rumor moves to "completed" in journal.

**Journal UI:**
MUST: Toggleable panel (J key) showing:
- Active rumors: title, current step hint text, progress (e.g., "2/4")
- Completed rumors: title, reward received
- No map markers, no waypoints. The journal is narrative, not GPS.

**Demo scope:** 4-6 rumor chains, 3-5 steps each. A single playthrough should surface 2-3 rumors but not see all of them.

### Relics

Permanent upgrades that modify player capabilities. The tangible reward for engaging with rumors and rare encounters, and the currency for the "Restart the Gear" win condition.

**Data model:**

```typescript
interface Relic {
  id: string;
  name: string;               // "The Ember Compass"
  description: string;        // flavor text
  effect: RelicEffect;
}

type RelicEffect =
  | { type: "max_resource"; resource: "supply" | "hope" | "health"; bonus: number }
  | { type: "forage_bonus"; chance: number }         // +N% forage success
  | { type: "searing_resist"; extraTurns: number }   // survive N extra turns on searing edge
  | { type: "hope_decay_slow"; intervalBonus: number } // hope decays N turns slower
  | { type: "move_discount"; chance: number }         // N% chance move costs 0 supply
```

**Acquisition:** Primarily from rumor chain completion. Rare 3-tag encounters may also grant relics.

**Inventory UI:** Visible in the HUD or a toggleable panel (could share the J key with the journal, tabbed). Each relic shows name, description, and active effect in plain language ("Foraging is 15% more likely to succeed").

**Balance:** Relics stack but each effect type has diminishing returns or a cap. Exact tuning deferred to M4.

**Demo scope:** 8-10 unique relics. A single playthrough finds 3-5 depending on rumor engagement.

### GameState Extensions

The `GameState` type expands in M2:

```typescript
interface GameState {
  // ... existing fields ...
  rumors: {
    available: Rumor[];           // rumor chains loaded at startup
    active: ActiveRumor[];        // rumors the player has discovered
    completed: CompletedRumor[];  // finished rumor chains
  };
  relics: Relic[];                // collected relics, apply effects during turn resolution
}

interface ActiveRumor {
  rumorId: string;
  currentStep: number;           // index into rumor.steps
}

interface CompletedRumor {
  rumorId: string;
  completedAtTurn: number;
}
```

MUST: Serializers updated to handle the new state shape. Save/load from M1 continues to work.

### Parallel Work (M2)

- Encounter content writing is pure data — can begin as soon as the encounter density model is defined (even during M1)
- Rumor Deck engine logic (discovery, weighted generation, step triggering) is independent of the Relic system until integration
- Relic system (data model, effect application in turn resolution, inventory UI) is independent of the Rumor Deck until integration
- Journal/inventory UI can be built after either engine system is complete

---

## Milestone 3: Win Conditions + Game Feel

### Goal

The game has endings, atmosphere, and emotional payoff. Players can win two different ways or die trying.

### Win Condition: Pillars of Frost

**Mechanic:** The player reaches a threshold distance from the Searing's origin along the opposite axis. This rewards Push-heavy, efficient movement.

MUST: When the player reaches distance >= N from the Searing origin (N tuned in M4), the next generated hex is the Pillars of Frost — a unique landmark hex.
MUST: Entering the Pillars hex triggers a win encounter with narrative text.
SHOULD: The world signals proximity to the Pillars — encounter text gets colder, frost imagery increases in the turns before arrival.
MUST: Win screen shows journey stats (turn count, hexes explored, encounters resolved, relics found, rumors completed).

### Win Condition: Restart the Gear

**Mechanic:** Collect enough relics to perform a ritual that restarts the world's mechanism. This rewards exploration and rumor-chasing.

MUST: When relic count >= threshold (tuned in M4, starting estimate: 5-6), a special encounter triggers at the next hex — the Gear ritual.
MUST: The ritual is a player choice, not automatic. The encounter presents the option to perform the ritual or continue exploring.
MUST: Win screen shows relics collected and rumors completed.

### Loss Conditions (unchanged)

- Health reaches 0
- Hope reaches 0
- Searing consumes the player's hex

### Game Feel: Low-Hope Effects

SHOULD: Visual distortion when Hope is at 1-2 (the reduced-visibility range). Possible effects: slight color desaturation, text flicker in the log, encounter text becomes more paranoid/unreliable.
SHOULD: Shadow Encounters — at low Hope, some encounters have an unsettling variant. The stream might look wrong. The shrine might feel hostile. Same mechanical choices, different narrative tone.

### Game Feel: Searing Drama

SHOULD: Improved Searing gradient — more dramatic visual as it approaches.
SHOULD: Screen pulse or color shift when the Searing is within 2-3 hexes.
SHOULD: Searing advancement produces a log message with urgency scaling based on proximity.

### Game Feel: Sound Design

SHOULD: Ambient loops per biome (Web Audio API).
SHOULD: Searing ambient rumble, increasing with proximity.
SHOULD: Encounter stings (short audio cues on encounter start, choice resolution).
SHOULD: Win/loss audio.

Note: Sound asset sourcing can begin during M2. Implementation happens in M3.

### Death/Win Screens

MUST: Narrative text appropriate to the outcome — not just "You died" but a sentence or two of story.
MUST: Stats summary: turns survived, hexes explored, encounters resolved, rumors found/completed, relics collected, cause of death or victory type.
MUST: "New Game" option.

### Parallel Work (M3)

- Win condition engine logic (distance check, relic threshold, Pillars/Gear encounters) is independent of visual/audio work
- Sound asset sourcing can start during M2
- Low-Hope effects (visual) are independent of sound design

---

## Milestone 4: Analytics + Demo Polish

### Goal

Ship-ready for friends & family. Lightweight analytics to learn from playtests.

### Analytics

MUST: New Turso table for play events.
MUST: Serverless endpoint `POST /api/analytics` for event submission.
MUST: Events are fire-and-forget — analytics never block gameplay. Failed requests are silently dropped.

**Events tracked:**

| Event | Data |
|---|---|
| `game_start` | session_id, timestamp |
| `game_end` | session_id, outcome (win_pillars / win_gear / loss_health / loss_hope / loss_searing), turn_count, hexes_explored |
| `rumor_discovered` | session_id, rumor_id, turn |
| `rumor_completed` | session_id, rumor_id, turn |
| `relic_acquired` | session_id, relic_id, source (rumor / encounter) |
| `death_detail` | session_id, resource_zeroed or "searing", biome_at_death, turn |

MUST: Session ID is a random string generated client-side. No user identifiers, no IP logging, no cookies.

**Admin stats view:**
SHOULD: Simple stats page in the admin panel — win/loss ratios, average turn count, most common death cause, most/least completed rumors, average relics per game. Table view.

### Demo Polish

- Difficulty tuning based on internal playtesting (Searing advance rate, resource economy, encounter balance)
- Edge case fixes discovered during M1-M3 playtesting
- Mobile/responsive considerations (touch input for hex selection, responsive layout)
- Final encounter content pass (fill gaps, improve weak encounters)
- Playtest round with friends & family, feedback capture

### Parallel Work (M4)

Analytics backend (Turso table, serverless endpoint, admin view) is independent of gameplay polish work.

---

## Dependency Map

```
M1 (UX + Save/Load)
 │
 ├──→ M2 (Rumor Deck + Relics + Encounters)
 │     │
 │     ├──→ M3 (Win Conditions + Game Feel)
 │     │     │
 │     │     └──→ M4 (Analytics + Polish)
 │     │
 │     └── [sound asset sourcing can start here]
 │
 └── [encounter content writing can start here]
```

Each milestone depends on the previous for integration, but sub-tasks within each milestone have parallel opportunities noted in each section.

## Content Volume Summary

| Content type | Count | Milestone |
|---|---|---|
| 1-tag common encounters | 40-50 | M2 |
| 2-tag uncommon encounters | 30-40 | M2 |
| 3-tag rare encounters | 10-15 | M2 |
| Rumor chains | 4-6 (3-5 steps each) | M2 |
| Rumor step encounters | 15-25 | M2 |
| Relics | 8-10 | M2 |
| Total encounters | ~100-130 | M2 |

This is the longest-lead item in the roadmap. Encounter content can be authored in parallel with engine work starting as early as M1.

## Open Tuning Questions (Resolved in M4)

- Pillars of Frost distance threshold
- Restart the Gear relic count threshold
- Weighted generation bonus for active rumors (+20-30% — needs playtesting)
- Hope decay rate with the denser encounter model (may need rebalancing)
- Searing advance rate with relics that slow it
- Common encounter pool size per biome — is 8-10 enough to avoid repetition?
