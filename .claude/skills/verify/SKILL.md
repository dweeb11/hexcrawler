---
name: verify
description: Run before marking any task complete. Runs build check, automated tests, and confirms acceptance criteria. No exceptions.
---

# verify

Run every step in order. Do NOT claim completion until all pass.

## Step 1: Build check

Run the project's build command:

    [CUSTOMIZE: your build/compile/parse check command]

Required: exit code 0.
If non-zero: show full output, fix all errors, re-run until clean.

## Step 2: Automated tests

Run the project's test command:

    [CUSTOMIZE: your test command]

Required: 0 failures.
If no test framework configured yet: skip with note
"Tests: skipped — no test framework configured."

## Step 3: Acceptance criteria confirmation

Read the task's Acceptance Criteria section. For each item, confirm
the code written in this task supports it.

## Step 4: Output evidence

Output this block before claiming done:

    Build check: exit 0
       [paste actual output]

    Tests: X passed, 0 failed
       [paste actual output]

    Acceptance Criteria:
       - [x] Item 1 — implemented in filename:line
       - [x] Item 2 — implemented in filename:line

No "should work". No "looks good". Evidence only.
