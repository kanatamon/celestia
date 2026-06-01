# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view <ID>`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

If the issue has a parent PRD, read its Core Ingestion Risk section before
implementation. If the PRD predates that section, infer the ingestion risk from
the PRD and this issue.

Preserve the v1.0.0 constraints:

- Extension-only: no backend.
- No user accounts.
- No persistence across Live Sessions.
- Keep `tiktok-live-core` platform agnostic.
- Keep Chrome Debugger API, WebSocket discovery, protobuf decode, and
  Chrome-specific Provider behavior inside `tiktok-live-chrome-extension`.

# CONTEXT

Review recent history for context by running:

```sh
git log -n 10 --format="%H%n%ad%n%B---" --date=short
```

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, run `npm run typecheck` and `npm run test` to ensure the tests pass.

# COMMIT

Make a git commit with a short message following Conventional Commits:
`<type>(<optional scope>): <short imperative summary>`

Be specific enough to understand the step at a glance. These commits will be
squashed, so brevity is fine — no extended body needed.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
