# Release: Chrome extension

How an AI agent (Claude Code or Codex) cuts a new Celestia release. The agent
does the judgment; the human approves once; the Chrome Web Store upload stays
**manual**. This file is the single source of truth — the Claude skill
`.claude/skills/release-extension/SKILL.md` is only a thin pointer to it.

## What this flow owns vs. doesn't

- **Owns:** deciding *whether* to release, the semver bump, the release notes,
  the version bump commit, the build, the zip, the git tag, and the GitHub
  release.
- **Does NOT own:** uploading to the Chrome Web Store. The flow ends by handing
  the human an explicit upload checklist (Phase 5).

## Facts about this repo

- **Version source of truth:** the `version` field in
  `apps/chrome-extension/manifest.config.ts`. Nothing else. `package.json` stays
  `0.0.0`/`private` and is never bumped.
- **Release artifact name:** `celestia-chrome-extension-vX.Y.Z.zip`, containing
  the **contents** of `apps/chrome-extension/dist/` (so `manifest.json` sits at
  the zip root — the Chrome Web Store requires this).
- **Tag scheme:** `vX.Y.Z`, placed on the version-bump commit.
- **Bump commit convention:** `chore(extension): bump version to X`.
- The release zip **must** be the built `dist/`, never a dev build — the
  MAIN-world Gift Animation Tap is injected only by the build-time plugin, so
  Animated Gift Celebrations do not fire under `vite dev`.

## Preconditions

1. `gh auth status` succeeds.
2. On `main`, working tree clean, up to date with origin.
   (`main` is rebase-only — see `shared.md`.)

## Phase 1 — Assess: is a release warranted?

1. Last release: `git describe --tags --match 'v*' --abbrev=0`; cross-check with
   `gh release list -L 5`.
2. Commits since: `git log vLAST..HEAD --oneline`.
3. Classify each commit as **user-facing** vs **non-shipping**:
   - *User-facing* — touches `apps/chrome-extension`, `packages/ui`, or
     `packages/tiktok-live-*` (anything that ships inside the extension).
   - *Non-shipping* — `apps/marketing` only, `docs/`, repo chores, CI, tests.
4. **Gate A:** if nothing user-facing shipped since `vLAST`, **stop and report
   "no release needed"** with the rationale (name the non-shipping paths). Do
   not proceed.

## Phase 2 — Propose version + notes (the one human checkpoint)

1. Choose the bump by Conventional Commits, taking the **highest** present:
   - `!` / `BREAKING CHANGE` → **major**
   - `feat` → **minor**
   - `fix` / `perf` → **patch**

   Apply judgment, don't just tally — several tiny `feat`s can still be one minor.
2. Read the current version from `manifest.config.ts`; compute the next.
3. Draft **end-user** release notes: grouped **Features** / **Fixes**, written
   for someone reading the store listing — not a raw commit dump. Reference issue
   numbers where they clarify. Keep the trailing
   `**Full Changelog**: …/compare/vLAST...vNEXT` link (matches existing releases).
4. **Checkpoint — present the proposed `vX.Y.Z` and the notes, then wait for the
   human's approval or edits.** Write, commit, build, and tag **nothing** before
   approval. (Version decided by AI, reviewed by human.)

## Phase 3 — Apply (only after approval)

1. **Quality gate (hard block):** `pnpm typecheck && pnpm test`. Any failure
   aborts the release — fix or abandon, never bump past a red gate.
2. Edit `version` in `apps/chrome-extension/manifest.config.ts` to `X.Y.Z`.
3. Commit: `chore(extension): bump version to X`.
4. Build: `pnpm build` (produces `apps/chrome-extension/dist/`).
5. **Drift guard:** confirm `apps/chrome-extension/dist/manifest.json` `version`
   equals `X.Y.Z`. If it doesn't, stop — the build didn't pick up the bump.
6. Zip the **contents** of `dist/`:
   ```sh
   ( cd apps/chrome-extension/dist && zip -r "../../../celestia-chrome-extension-vX.Y.Z.zip" . )
   ```
   Verify the zip has `manifest.json` at its root (`unzip -l <zip> | grep -E ' manifest.json$'`).

## Phase 4 — Publish to GitHub

1. Tag the bump commit and push (rebase-only `main`):
   ```sh
   git tag vX.Y.Z
   git push origin main --follow-tags
   ```
2. Create the release with the curated notes + zip:
   ```sh
   gh release create vX.Y.Z \
     --title "Celestia X.Y.Z" \
     --notes-file <notes> \
     celestia-chrome-extension-vX.Y.Z.zip
   ```

## Phase 5 — Hand off the manual step

Print this checklist for the human and **stop** — the flow never touches the
store:

- [ ] Open the Chrome Web Store developer dashboard.
- [ ] Upload `celestia-chrome-extension-vX.Y.Z.zip` to the Celestia item.
- [ ] Submit for review.

## Quick reference

| Step            | Command / file                                                |
| --------------- | ------------------------------------------------------------- |
| Last tag        | `git describe --tags --match 'v*' --abbrev=0`                 |
| Commits since   | `git log vLAST..HEAD --oneline`                               |
| Version         | `apps/chrome-extension/manifest.config.ts` → `version`        |
| Gate            | `pnpm typecheck && pnpm test`                                 |
| Build           | `pnpm build` → `apps/chrome-extension/dist/`                  |
| Zip             | `( cd apps/chrome-extension/dist && zip -r ../../../celestia-chrome-extension-vX.Y.Z.zip . )` |
| Tag + push      | `git tag vX.Y.Z && git push origin main --follow-tags`        |
| Release         | `gh release create vX.Y.Z --title "Celestia X.Y.Z" --notes-file <notes> <zip>` |
| CWS upload      | **manual** — dashboard                                        |
