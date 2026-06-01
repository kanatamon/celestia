---
name: afk-runner
description: Work the ready-for-agent backlog end to end — plan, implement, review, merge — using parallel git worktrees and background subagents. Use when the user wants to run the AFK queue, work ready-for-agent issues autonomously, or replicate the sandcastle loop with Claude Code instead of Codex.
---

# AFK Runner

Replicates the sandcastle `plan → implement → review → merge` loop using Claude
Code's own primitives instead of a sandbox: explicit git worktrees for
per-issue isolation, and background subagents for parallelism. No sandbox, no
auth plumbing — it runs as you.

The four phase prompts live in `.sandcastle/` and are the single source of
truth for *what each phase does*. This file is only the **orchestration**: which
phase runs when, how work is parallelised, and how results gate the next phase.

> **Isolation caveat.** Worktrees isolate *files and branches*, not the
> process. Subagents run on your real machine with your permissions. Only run
> this on a backlog you trust. For a hands-off run, allowlist `gh`, `git`,
> `npm run typecheck`, and `npm run test` in `.claude/settings.json` first, or
> every subagent tool call will prompt.

## Setup (once per run)

1. Confirm `gh auth status` succeeds and the working tree is clean.
2. Capture the base branch — this is the merge target and the review diff base:
   `BASE = git branch --show-current`. Use its value wherever `{{SOURCE_BRANCH}}`
   appears below.

## Loop

Repeat the four phases below until **Phase 1 returns zero issues**. Cap at a
sensible number of rounds (e.g. 3) as a safeguard against churn.

### Phase 1 — Plan

Follow `.sandcastle/plan-prompt.md` yourself (you are the planner). It tells you
to list `ready-for-agent` issues, build the dependency graph, and emit a
`<plan>` JSON block of **unblocked** issues with branch names
(`sandcastle/issue-{id}-{slug}`).

Parse that `<plan>` block. If `issues` is empty, stop and report. Otherwise
continue with the selected issues.

### Phase 2 — Implement (parallel)

For each selected issue, create an isolated worktree, then spawn a background
implementer subagent that works inside it:

```sh
git worktree add .sandcastle/worktrees/issue-<id> -b <branch> "$BASE"
```

Spawn one `Agent` per issue with `subagent_type: general-purpose` and
`run_in_background: true`. Prompt each with:

> Follow the instructions in `.sandcastle/implement-prompt.md`, substituting
> `{{TASK_ID}}=<id>`, `{{ISSUE_TITLE}}=<title>`, `{{BRANCH}}=<branch>`.
> **All work must happen inside the worktree at
> `.sandcastle/worktrees/issue-<id>` — `cd` there first; it is already checked
> out on `<branch>`.** Commit on that branch. Do not push, do not close the
> issue, do not touch any other worktree.

Do **not** pass `isolation: "worktree"` — you are managing worktrees explicitly
so the reviewer (next phase) can reuse the same checkout.

Wait for all implementers to finish (you are notified as each completes).

### Phase 3 — Review (gated)

For each issue, gate on real commits:

```sh
git -C .sandcastle/worktrees/issue-<id> log "$BASE".."<branch>" --oneline
```

If there are no commits, skip the issue (nothing to review or merge). If there
are commits, spawn a reviewer subagent (`general-purpose`, background is fine)
reusing the **same worktree**:

> Follow the instructions in `.sandcastle/review-prompt.md`, substituting
> `{{BRANCH}}=<branch>` and `{{SOURCE_BRANCH}}=<BASE>`. Work inside the worktree
> at `.sandcastle/worktrees/issue-<id>` — `cd` there first. Commit any
> refinements on `<branch>`.

If a reviewer reports blocking correctness problems (not just style), relay them
to that issue's implementer via `SendMessage` and re-review before merging.

Wait for all reviewers to finish. Collect the set of `<branch>`/issue pairs that
have commits — these go to merge.

### Phase 4 — Merge

Run from the **main repository checkout on `$BASE`** (not a worktree). Follow
`.sandcastle/merge-prompt.md`, supplying:

- `{{BRANCHES}}` — a markdown list of the branches to merge, one `- <branch>`
  per line.
- `{{ISSUES}}` — a markdown list of `- <id>: <title>`, one per line.

That prompt squash-merges each branch, runs typecheck + tests, writes a
storyteller commit, closes each issue, and removes the worktrees under
`.sandcastle/worktrees/`. Honor its instructions as written.

Then loop back to Phase 1 to pick up issues unblocked by this round.

## Notes

- The phase prompts are shared with the sandcastle/Codex workflow. They were
  de-sandcastled (the bang-prefixed backtick preprocessor lines — a bang
  character followed by a backtick-wrapped command — are now plain "run this
  command" steps), which works for both runners — the agent executes them.
- `merge-prompt.md`'s cleanup targets `.sandcastle/worktrees/`, which matches
  the worktree paths created in Phase 2, so cleanup is correct as written.
