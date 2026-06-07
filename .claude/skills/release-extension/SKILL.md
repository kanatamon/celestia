---
name: release-extension
description: Cut a new Celestia Chrome extension release — assess whether a release is warranted, decide the semver bump and write end-user release notes, then build, zip, tag, and create the GitHub release after one human approval. The Chrome Web Store upload stays manual. Use when the user wants to release a new version, cut a release, ship a new extension version, or asks "do we need a release?".
---

# Release

Drive a Celestia extension release end to end. You make the judgment calls
(whether to release, the version bump, the notes); the human approves once; the
Chrome Web Store upload stays in their hands.

The full runbook is **`docs/agents/release.md`** — the single source of truth,
shared with Codex. Follow it exactly. The phases are:

1. **Assess** — commits since the last `vX.Y.Z` tag; if nothing user-facing
   shipped, stop and report "no release needed".
2. **Propose** — semver bump + end-user release notes; **wait for the human's
   approval before writing, committing, building, or tagging anything.**
3. **Apply** — hard-block on `pnpm typecheck && pnpm test`, bump
   `manifest.config.ts`, commit, `pnpm build`, drift-guard the built manifest,
   zip `dist/` to `celestia-chrome-extension-vX.Y.Z.zip`.
4. **Publish** — tag, push (rebase-only `main`), `gh release create` with notes
   + zip.
5. **Hand off** — print the manual Chrome Web Store upload checklist and stop.

Do not automate the Chrome Web Store upload.
