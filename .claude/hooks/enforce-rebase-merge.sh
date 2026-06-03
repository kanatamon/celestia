#!/usr/bin/env bash
#
# PreToolUse(Bash) hook — enforce the rebase-only / linear-history merge policy.
# See docs/agents/shared.md → "Git workflow". Reads the hook JSON on stdin and
# emits a `deny` permission decision for any non-rebase merge into history.
#
# Blocks:
#   - `gh pr merge` with --merge or --squash, or without --rebase
#   - `git merge` that is not --ff-only (allows --ff-only and merge-state flags)
# Allows everything else through untouched.
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""')"

deny() {
	jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
	exit 0
}

# --- gh pr merge ----------------------------------------------------------
if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])gh([[:space:]]+[^|;&]*)?[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)'; then
	if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--(merge|squash)([[:space:]]|=|$)'; then
		deny "Rebase-only policy (docs/agents/shared.md → Git workflow): main is linear-history-only. Re-run \`gh pr merge\` with --rebase instead of --merge/--squash."
	fi
	if ! printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--rebase([[:space:]]|$)'; then
		deny "Rebase-only policy (docs/agents/shared.md → Git workflow): \`gh pr merge\` must pass --rebase to keep main's history linear."
	fi
fi

# --- git merge (not git merge-base, not gh pr merge) ----------------------
if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])git([[:space:]]+(-[^[:space:]]+|[^[:space:]]*=[^[:space:]]*))*[[:space:]]+merge([[:space:]]|$)'; then
	# Allow fast-forward-only integration and merge-state management.
	if ! printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--(ff-only|abort|continue|quit)([[:space:]]|$)'; then
		deny "Rebase-only policy (docs/agents/shared.md → Git workflow): a non-ff \`git merge\` creates a merge commit. Use \`git merge --ff-only\` or rebase the branch instead."
	fi
fi

exit 0
