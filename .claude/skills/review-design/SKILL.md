---
name: review-design
description: Spin up the UX Designer agent to review current design docs for gaps, inconsistencies, and missing player-experience considerations.
---

# /review-design — Design Gap Analysis

Invoke the UX Designer perspective to audit the current design docs.

## Step 1: Load context

Read in order:
1. `MULTI_AGENT.md` — understand the UX Designer role
2. `PITCH.md` — the game's vision and audience
3. All design docs in `docs/` — the current approved designs
4. Any UX docs in `design/ux/` — existing UX work
5. `PROJECT_MEMORY.md` — current status and open threads

## Step 2: Analyze as UX Designer

Review every design doc through the UX Designer lens from MULTI_AGENT.md. For each doc, evaluate:

**Completeness:**
- Does it describe what the player is trying to accomplish?
- Are interaction flows specified (how many inputs, what order)?
- Are edge cases covered (empty states, error states, first-time experience)?
- Is there a "how does the player discover this?" answer?

**Player experience:**
- Does the design respect the player's time and attention?
- Are there unnecessary friction points?
- Is the information hierarchy clear (what's most important on screen)?
- Will this be intuitive or require explanation?

**Accessibility:**
- Text readability at target resolution?
- Color-only information conveyance?
- Controller/keyboard navigation considered?

**Consistency:**
- Do the designs use consistent patterns across features?
- Do interaction patterns match player expectations from the genre?

## Step 3: Output the review

```
## Design Review — [Date]

### Documents Reviewed
- [list of docs]

### Gaps Found
- [doc name]: [specific gap and why it matters for the player]

### Inconsistencies
- [pattern A in doc X] vs [pattern B in doc Y] — recommend [which to standardize on]

### Missing Player Experience Considerations
- [what's not addressed that should be]

### Strengths
- [what's well-designed — not just criticism]

### Recommended Next Steps
1. [highest priority gap to address]
2. [second priority]
3. [third priority]
```
