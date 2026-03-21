---
name: worklog
description: Generate the worklog for the current feature branch. Scans git history for commits since branching, lists files changed, links to spec artifacts.
---

# worklog

## Step 1: Identify the current feature

Run:

    git branch --show-current

Extract the feature name from the branch.

## Step 2: Get the merge base

Run:

    git merge-base main HEAD

## Step 3: Get commit history

Run:

    git log main..HEAD --oneline --no-merges

## Step 4: Get files changed

Run:

    git diff main..HEAD --name-status

Separate into Created (A) and Modified (M).

## Step 5: Generate the worklog

Create or overwrite at:
`docs/worklogs/YYYY-MM-DD-<feature-name>.md`

Structure:

    # Worklog: <Feature Name>

    **Date:** YYYY-MM-DD
    **Branch:** `feat/<name>`
    **Status:** Complete | In progress

    ---

    ## Summary

    1-2 sentence description of what was implemented.

    ---

    ## Work Completed

    | Task | Description | Commit |
    |------|-------------|--------|
    | 1 | description | hash |

    ---

    ## Files Changed

    **Created:**
    - list

    **Modified:**
    - list

    ---

    ## Next Steps

    1. next action
    2. next action

## Step 6: Output the file path

Show the generated worklog path and a brief summary of commits captured.
