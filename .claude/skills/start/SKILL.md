---
name: start
description: Adaptive project entry point. Detects where you are (no idea, concept, design complete, existing codebase) and routes to the right workflow. Use when starting a session or picking up a project after time away.
---

# /start — Project Stage Detection

Detect the current project stage and adapt the workflow accordingly.

## Step 1: Read project context

Read these files if they exist (skip any that don't):
- `PITCH.md`
- `MULTI_AGENT.md`
- `WORKING_AGREEMENT.md`
- `PROJECT_MEMORY.md` or `PROJECT.md`
- Latest file in `docs/` (by modification date)

Check git log for recent activity:
```
git log --oneline -10
```

## Step 2: Detect stage

Based on what you found, classify the project into one of four stages:

### Stage A: No Idea
**Signals:** Empty or missing PITCH.md, no source code, no design docs, no git history.

**Action:** Enter brainstorm mode.
- "Looks like a blank slate. Let's figure out what you want to build."
- Ask one question at a time (per WORKING_AGREEMENT.md)
- Focus on: what's the core experience? who's the player? what's the hook?
- Goal: get to a filled-in PITCH.md

### Stage B: Concept Exists
**Signals:** PITCH.md has content, but no design docs in `docs/` and no implementation plan.

**Action:** Move toward design.
- Summarize the pitch back to confirm understanding
- Propose design doc structure (what sections are needed)
- Begin design doc scaffolding one section at a time, getting approval on each
- Goal: approved design doc saved to `docs/`

### Stage C: Design Complete
**Signals:** Design doc exists in `docs/`, but implementation hasn't started or is early.

**Action:** Generate implementation plan.
- Read the design doc
- Propose a milestone breakdown
- Write the implementation plan using spec conventions from WORKING_AGREEMENT.md
- Pre-implementation gate: get explicit approval before any code
- Goal: approved plan, ready to `/implement-from-plan`

### Stage D: Existing Codebase
**Signals:** Source code exists, git history shows prior work, possibly a PROJECT_MEMORY.md with status.

**Action:** Orient and plan next work.
- If PROJECT_MEMORY.md exists: read it, summarize current status and open threads
- If not: reverse-document what exists (scan source tree, read key files, summarize architecture)
- Show recent git activity (last 5-10 commits)
- Ask: "What do you want to work on next?"
- Plan the next milestone or feature from there

## Step 3: Present findings

Output a brief status report:

```
## Project Stage: [A/B/C/D — name]

**What exists:**
- [list what you found]

**Recommended next step:**
- [what to do now]

**Open threads (if any):**
- [from PROJECT_MEMORY.md or recent git]
```

Then proceed with the appropriate action for the detected stage.
