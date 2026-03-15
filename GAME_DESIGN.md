# The Waning Light: Game Design Document

## 1. Core Concept
A solo fantasy hexcrawl focused on survival, exploration, and outrunning an environmental catastrophe. You play as a **Cinder-Seeker**, a lone adventurer traveling the "Twilight Strip" between eternal night and the encroaching **Searing**.

## 2. Setting & Atmosphere
*   **The World:** The sun has stalled. One side of the world is a frozen wasteland, the other a burnt hellscape.
*   **The Twilight Strip:** The only habitable zone, a thin band of land slowly being consumed by the sun's expansion.
*   **The Searing:** The "Big Bad." An unstoppable wall of heat and light that advances across the map every few turns, destroying everything in its path.

## 3. Core Mechanics

### The Lone Adventurer
*   No party to manage. It's just you, your supplies, and your dwindling Hope.
*   The game is highly personal; every choice to "Push" or "Pause" rests on your shoulders.

### Resource Management
*   **Supply:** The fuel for movement. Spending 1 Supply allows you to move to a new hex.
*   **Hope:** The "Internal Light." 
    *   **High:** Visibility of adjacent hexes (Fog of War).
    *   **Low:** Hallucinations, "Shadow Encounters," and reduced efficiency.
    *   **Zero:** Game over. The adventurer surrenders to the heat.

### The Game Loop (Push vs. Pause)
*   **PUSH (Move):** Spend 1 Supply. Move, reveal a hex, and resolve an encounter.
*   **PAUSE (Camp):** Spend 0 Supply. Recover Health/Hope or forage for supplies, but risk a "Night Incident."

## 4. Exploration & Discovery

### Procedural Generation
*   The map is generated as you move. 
*   Biomes (Forests, Mountains, Ruins, Settlements) are determined by the "Rumor Deck."

### The Rumor Deck
*   Instead of fixed map markers, you hold **Rumors** (cards).
*   Example: *"The Whispering Well is in a Forest hex near a Mountain."*
*   Once you find the required terrain, the Rumor "spawns" into a physical location on the map.
*   **Reward:** Reaching a Rumor location provides massive Hope boosts and permanent Relics.

## 5. Winning & Losing
*   **Losing:** Health hits zero, Hope hits zero, or the **Searing** catches you.
*   **Winning:** Reaching the "Pillars of Frost" (the theoretical end of the map) or collecting enough Relics to "Restart the Gear."
