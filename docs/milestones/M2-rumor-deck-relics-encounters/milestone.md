# M2: Rumor Deck + Relics + Encounter Overhaul

> Every hex is interesting. The Rumor Deck gives exploration narrative purpose. Relics give tangible progression. The encounter system tells stories.

## Process
- [ ] Vision
- [ ] Art Direction
- [ ] Design
- [ ] Milestone
- [x] Implement
- [x] Verify
- [ ] Ship

## Tasks
- [x] Task 1: Extend GameState with Rumor and Relic Types
- [x] Task 2: Encounter Density — Every Hex Gets an Encounter
- [x] Task 3: Relic Effect Application in Turn Resolution
- [x] Task 4: Rumor Discovery and Weighted Hex Generation
- [x] Task 5: Rumor Step Triggering in Turn Resolution
- [x] Task 6: Journal UI Panel
- [x] Task 7: Encounter Content — Common (1-tag) Encounters
- [x] Task 8: Encounter Content — Uncommon (2-tag) and Rare (3-tag) Encounters
- [x] Task 9: Rumor Chain Content and Data
- [ ] Task 10: Final M2 Integration and Verification

## Notes
Design details in [m2-rumor-deck-relics-encounters.md](../../design/m2-rumor-deck-relics-encounters.md).

Automated verification for Task 10 is complete: `npm test -- --run` and `npm run typecheck` pass.
Manual playtest checklist is still pending before Task 10 can be marked complete.
