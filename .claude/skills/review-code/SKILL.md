---
name: review-code
description: Spin up the QA agent to audit recent changes against acceptance criteria, check test coverage, and flag regressions.
---

# /review-code — QA Audit of Recent Changes

Invoke the QA perspective to audit recent code changes.

## Step 1: Load context

1. Read `MULTI_AGENT.md` — understand the QA role
2. Read `WORKING_AGREEMENT.md` — verification standards and two-track testing
3. Check recent git history:
   ```
   git log --oneline -20
   git diff HEAD~5 --stat
   ```
4. Read `PROJECT_MEMORY.md` — current milestone and acceptance criteria
5. Read the most recent spec/plan doc in `docs/`

## Step 2: Identify what to audit

From the recent git history, identify:
- What features/changes were implemented
- Which files were modified
- What the intended behavior was (from specs/plans)

## Step 3: Audit as QA

For each recent feature or change:

**Acceptance Criteria Check:**
- Read the spec's acceptance criteria
- Verify each criterion is implemented (with file:line references)
- Flag any that are missing or incomplete

**Test Coverage Check:**
- What automated tests exist for this change?
- What logic paths are untested?
- What edge cases are missing? (zero, negative, empty, max, rapid succession)
- Propose specific tests for gaps (actual test code, not descriptions)

**Regression Check:**
- Could this change break existing behavior?
- Are there related systems that weren't updated?
- Do existing tests still pass?
  ```
  [run project test command]
  ```

**Code Quality (from path-scoped rules):**
- Check changed files against `.claude/rules/` standards
- Flag violations (magic numbers in gameplay code, state ownership in UI, etc.)

## Step 4: Output the audit

```
## Code Review — [Date]

### Changes Audited
- [commit/feature]: [brief description]

### Acceptance Criteria Status
- [x] [criterion] — implemented in [file:line]
- [ ] [criterion] — MISSING: [what's needed]

### Test Coverage
- Covered: [what's tested]
- Gaps: [what's not tested and should be]
- Proposed tests: [actual test code]

### Regression Risks
- [what could break] — [severity] — [how to verify]

### Rule Violations
- [file:line] — [which rule] — [what to fix]

### Test Run Results
[paste actual test output]

### Verdict
[PASS / PASS WITH NOTES / NEEDS FIXES]
```
