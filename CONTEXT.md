# The Waning Light

Solo fantasy hexcrawl. The player is a Cinder-Seeker on the Twilight Strip, managing Supply, Hope, and Health while outrunning the Searing.

## Language

**Restart the Gear**:
A win condition reached by collecting enough Relics and deliberately performing the Gear Ritual.
_Avoid_: Gear win, relic win

**Gear Ritual**:
A special encounter offered when the player holds enough Relics. Two choices: perform the ritual (win) or decline and return to the map. Re-offered on every hex entry while the relic threshold remains met.
_Avoid_: Auto-win, passive relic threshold, one-shot ritual

**Relic**:
A permanent upgrade earned through encounters or rumor rewards. Relics modify capabilities and count toward the Restart the Gear threshold.
_Avoid_: Item, artifact, trinket

**Pillars of Frost**:
A win condition reached by finding and entering a unique landmark hex whose location is seeded at game start. The Pillars spawn in the safe corridor — ahead of the player along the axis opposite the Searing's advance. Placement must be at least a minimum distance from both the player and the Searing, and may be anywhere from that minimum up to a maximum cap along that corridor. The player does not know the Pillars location at game start; frost proximity messages and rumors are the only guidance. Entering the Pillars triggers a single-acknowledgment win encounter — no decline option.
_Avoid_: Distance-from-Searing win, silent win, off-axis scavenger hunt, map marker, compass, deferrable win

**Landmark hex**:
A specially placed hex tied to a win condition (e.g. the Pillars of Frost), with its coordinates fixed at game start. Entering it triggers a narrative encounter rather than a normal biome encounter. Landmark encounters take priority over other special encounters (including the Gear Ritual) on the same hex.
_Avoid_: Win tile, endpoint hex, procedurally spawned landmark

**Frost proximity**:
Atmospheric log messages signaling the player is nearing the Pillars of Frost. Triggered when the player is within banded distance of the seeded Pillars coordinate and within the safe corridor tolerance band.
_Avoid_: Searing-distance signal, weather effect

**Safe corridor**:
The region along the axis opposite the Searing's advance where the Pillars of Frost can spawn and frost proximity messages can fire. The player is considered in the corridor when within ±2 hexes of the ideal line toward the Pillars.
_Avoid_: Escape lane, north path

**Pillars rumor chain**:
A dedicated multi-step rumor that progressively guides the player toward the Pillars of Frost through narrative hints about the safe corridor and the frozen world. Optional — the Pillars are findable and winnable without completing the chain.
_Avoid_: Compass quest, map reveal rumor, required gate
