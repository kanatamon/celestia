# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `npm run typecheck` and `npm run test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge. Use
the repo-local `commit-message-storyteller` skill at
`.agents/skills/commit-message-storyteller/SKILL.md` to write the commit message
from the merge diff and issue list.

The merge commit message must:

1. Follow Conventional Commits format
2. Explain why the merged branches belong together
3. Summarize the issues completed and major areas changed
4. Include blockers, verification gaps, or notes for follow-up when relevant

# CLOSE ISSUES

For each branch that was merged, close its issue using the following command:

`gh issue close <ID> --comment "Completed by Sandcastle"`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
