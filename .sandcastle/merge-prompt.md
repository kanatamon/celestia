# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge --squash <branch>`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving all conflicts, run `npm run typecheck` and `npm run test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch
5. Write and create a single squash commit for that branch following the **Squash Commit Convention** below

## Squash Commit Convention

For each branch, write one commit after the squash merge. Use the repo-local
`commit-message-storyteller` skill at `.agents/skills/commit-message-storyteller/SKILL.md`
to write the message. Provide it with the output of `gh issue view <ID>` and
`git log <branch> --oneline` as context.

Extend the storyteller output with the following:

- Append `#<ISSUE_ID>` to the end of the subject line so it appears in `git log --oneline`
- Derive `type` and `scope` from the issue title and labels, not from the diff
- Structure the body as three paragraphs: **Why** (from the issue description), **What changed** (synthesized from the branch commit log), **Gaps** (known limitations or follow-up issues — omit if none)
- Add these lines to the footer:
  ```
  Closes #<ISSUE_ID>
  Branch: <branch-name>
  Agent: RALPH
  ```

# CLOSE ISSUES

For each branch that was merged, close its issue using the following command:

`gh issue close <ID> --comment "Completed by Sandcastle"`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
