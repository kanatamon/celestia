# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view <ID>`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

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

Make a git commit. Use the repo-local `commit-message-storyteller` skill at
`.agents/skills/commit-message-storyteller/SKILL.md` to write the commit message
from the staged diff, issue context, and PRD context.

The commit message must:

1. Follow Conventional Commits:
   `<type>(<optional scope>): <short imperative summary>`
2. Explain why the change was needed, not just what changed
3. Include the task completed and PRD reference when available
4. Mention key decisions made
5. Summarize files or areas changed
6. Include blockers, verification gaps, or notes for the next iteration when relevant
7. Include `Agent: RALPH` in the footer

Keep it concise. Do not use vague messages such as "update files" or
"misc changes".

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
