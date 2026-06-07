# Celestia — Claude Code instructions

Shared repo instructions live in `docs/agents/shared.md`.

## Required reading

- Read `CONTEXT.md` for domain language and monorepo structure before making changes.
- Follow all rules in `docs/agents/shared.md`.

## Claude-specific notes

- Do not modify `apps/legacy`.
- Do not add `apps/legacy` back to tooling.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `kanatamon/celestia`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Release

Cutting a new extension release (assess → propose version + notes → build → zip → tag → GitHub release; Chrome Web Store upload stays manual). See `docs/agents/release.md`.
