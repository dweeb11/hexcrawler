# Working Agreement — Games Extension

This extends the shared `WORKING_AGREEMENT.md` with game-specific conventions.

---

## Visual Placeholders

Every entity spec (enemy, hazard, pickup, NPC) must include:
- Minimum visual size (e.g., "at least 32x32px")
- High-contrast placeholder color (bright red, green, orange — never dark gray)
- Expected screen region and movement range

Placeholder art is not technical debt — it's the first testable version
of the entity. It ships in the feature branch and gets replaced later.

---

## Debug Menu

Every new entity implementation must include a task to add a spawn
button to the debug menu. This is not optional — if it exists in the
game world, you must be able to summon it on demand for testing.

---

## Testing — Game-Specific

The shared two-track model applies, with these additions:

**Physics and input interactions go in Acceptance Criteria, not
automated tests.** They are inherently visual and timing-dependent.

**State persistence across transitions** — any system with a timer or
state that runs across scene/wave/level transitions must have an
automated test verifying state persists correctly (start -> clear -> start).

---

## Milestone Documents

At the start of each feature, create a milestone doc that consolidates
all acceptance criteria into one playtesting checklist:

    docs/milestones/YYYY-MM-DD-<feature>.md

The developer opens this file while playtesting and checks off each
item. It's the QA reference, not the implementation guide.

---

## Playtesting

Verification step 5 ("Verify") means the human plays the game.
The agent cannot verify gameplay — it confirms implementation exists,
the human confirms it works.

For complex or risky features, generate a deliverable report and
playtest validation doc using the `feature-docs` skill.
