---
name: scope-check
description: Assess current milestone scope vs. progress. Flags scope creep, stalled work, and overdue items. Use when a feature feels like it's growing or a milestone is dragging.
---

# /scope-check — Producer Scope Assessment

Put on the Producer hat and assess whether the current milestone is on track.

## Step 1: Load context

1. Read `MULTI_AGENT.md` — understand the Producer perspective
2. Read `PROJECT_MEMORY.md` — current milestone, status, open threads
3. Read the current milestone spec/plan in `docs/`
4. Check git log for pace and recent activity:
   ```
   git log --oneline --since="2 weeks ago"
   git log --oneline -20
   ```
5. Check for any TODO/FIXME items:
   ```
   grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.gd" --include="*.ts" --include="*.swift" | head -20
   ```

## Step 2: Assess scope

**Original scope:**
- What was the milestone supposed to deliver? (from the plan/spec)
- How many tasks were defined?

**Current progress:**
- How many tasks are complete? (from git history and PROJECT_MEMORY)
- How many are in progress or blocked?
- How many remain?

**Scope creep detection:**
- Are there commits that don't map to a planned task?
- Has the feature list grown since the plan was approved?
- Are tasks taking longer than expected? (compare commit frequency to task count)

**Debt accumulation:**
- How many TODOs/FIXMEs have been added during this milestone?
- Are there "temporary" solutions that are becoming permanent?

## Step 3: Output the assessment

```
## Scope Check — [Date]

### Current Milestone: [name]

### Progress
- Planned tasks: [N]
- Completed: [N] ([%])
- In progress: [N]
- Remaining: [N]

### Pace
- Active development period: [duration from first to latest commit]
- Average commits per task: [N]
- Recent activity: [active / slowing / stalled]

### Scope Creep
- [list any unplanned work that's been added]
- [or "No scope creep detected"]

### Debt
- TODOs added this milestone: [N]
- [list any concerning ones]

### Risk Assessment
- [GREEN / YELLOW / RED]
- [brief explanation]

### Recommendations
- [cut / keep / defer specific items if over scope]
- [focus areas if behind]
- [next milestone planning if on track]
```

Be honest. If the milestone is behind, say so. If scope has crept, name the additions. The human needs accurate signal to make decisions — not optimism.
