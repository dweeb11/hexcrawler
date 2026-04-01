# M1: Minimum Viable UX + Save/Load

> Make the current game playable by non-developers — readable HUD, intuitive controls, save/load so players can leave and come back.

## Process
- [x] Vision
- [x] Art Direction — glyph style in [ADD.md](../../ADD.md)
- [x] Design — [docs/design/m1-ux-save-load.md](../../design/m1-ux-save-load.md)
- [x] Milestone — this doc
- [x] **Implement** — PR #2, PR #45
- [x] Verify — 53 tests passing, typecheck clean
- [x] Ship — merged to main

## Tasks
- [x] Verify and harden state serialization (#3)
- [x] LocalStorage save/load (#4)
- [x] Integrate save/load into game loop (#5)
- [x] Simplify hex display — remove tag glyphs, add visited tracking (#6)
- [x] Persistent key legend (#7)
- [x] Resource HUD improvements (#8)
- [x] Event log visual hierarchy (#9)
- [x] Tutorial hints (#10)
- [x] Final integration test and playtest (#11)

## Notes
Design details in [m1-ux-save-load.md](../../design/m1-ux-save-load.md). Full demo roadmap in [friends-family-demo.md](../../design/friends-family-demo.md).
