# Project Pitch

## What is this?

**The Waning Light** — a solo fantasy hexcrawl about survival, exploration, and outrunning an environmental catastrophe. You play as a Cinder-Seeker, a lone adventurer traveling the Twilight Strip between eternal night and the encroaching Searing — an unstoppable wall of heat and light that consumes everything in its path.

Built as a web application: TypeScript, Canvas 2D with an ASCII-glyph terminal aesthetic.

## Why does this exist?

Hexcrawls are compelling but usually buried in tabletop complexity or party management. This strips the genre to its core: one person, dwindling supplies, a map that reveals itself as you move, and a catastrophe on your heels. Every decision — Push forward into the unknown or Pause to recover — carries weight because the world is closing in behind you.

## Who is it for?

Players who enjoy roguelikes, survival games, and atmospheric solo experiences. People who like Brogue, Into the Breach, or Curious Expedition — games where simple systems create emergent tension.

## What does "done" look like?

**MVP:** A playable core loop. Move across procedurally generated hexes, manage Supply/Hope/Health, encounter biome-specific events driven by a tag system, and race the Searing. You can die three ways (health, hope, or the Searing catches you). No win condition yet — survival is the game.

**Full vision:** Rumor Deck (procedural quests that spawn based on terrain), Relics (permanent upgrades), two win conditions (reach the Pillars of Frost or collect enough Relics to Restart the Gear), save/load, sound design.

## Inspirations & References

- **Brogue** — ASCII aesthetic, emergent depth from simple systems
- **Curious Expedition** — hexcrawl exploration with resource management
- **Into the Breach** — perfect information + tight decision space
- **The Long Dark** — solo survival atmosphere, the world as antagonist
- **Dwarf Fortress** — the idea that ASCII glyphs can carry a whole world

## Non-Negotiables

- **Pure turn engine.** All game logic is `(state, action) -> newState`. No logic in the renderer. Testable without a browser.
- **Tagged hexes.** Terrain generation uses tag propagation from neighbors so biomes cluster naturally. Encounters require matching tags — they feel situated, not random.
- **The Searing is random.** It advances from a random direction each game. No memorized optimal paths.
- **Encounters are full-screen moments.** Clicking a hex with an encounter pulls up a dedicated view. The map disappears. You're in the story.
- **Terminal aesthetic.** Dark background, monospace glyphs, muted palette. The atmosphere comes from text and restraint, not illustration.

## Open Questions

- What's the right Searing advance rate? Every 3 turns? 4? Should it accelerate?
- How many encounters per biome are enough for the MVP to not feel repetitive?
- Should forage success rate depend on biome tags?
- Night incidents during Pause — how punishing should they be? Risk of camping needs to be real but not feel unfair.

## Scratchpad
