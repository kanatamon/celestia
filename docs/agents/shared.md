# Celestia — shared agent instructions

Celestia is a TikTok Live companion Chrome extension. Read `CONTEXT.md` for domain language and monorepo structure before making changes.

## Monorepo layout

```
apps/
  extension/       ← Chrome extension (Side Panel UI + background service worker)
  legacy/          ← READ-ONLY reference. Do not modify, lint, type-check, or add back to tooling.
packages/
  tiktok-live-core/             ← TikTokLiveProvider interface + LiveEvent types
  tiktok-live-chrome-extension/ ← Chrome Debugger API data layer
  ui/                           ← Shared React components
```

## Naming conventions

**Files:** kebab-case only.
- `chat-feed.tsx` ✓ — `ChatFeed.tsx`, `chatFeed.tsx` ✗
- TypeScript class/interface/type names inside files are PascalCase — this is about file names only.

**Folders:** kebab-case only.
- `live-event/` ✓ — `liveEvent/`, `LiveEvent/` ✗

**Enforced by Biome:** `linter.rules.style.useFilenamingConvention` is set to `kebab-case` and will error on violations.

## Tooling

- **Package manager:** pnpm (workspaces). Run `pnpm install` from root.
- **Task runner:** Turborepo. Run tasks with `pnpm build`, `pnpm typecheck`, etc.
- **Formatter + linter:** Biome. Run `pnpm check` to format and lint in one pass.
- **TypeScript:** Extends `tsconfig.base.json` at root. Each package has its own `tsconfig.json`.

## Live ingestion changes

Changes that affect the Chrome Extension Provider, WebSocket discovery, protobuf
decoding, LiveEvent normalization, deduplication, Provider contract behavior, or
ConnectionState classification must pass the live ingestion contract test gate in
`docs/agents/live-ingestion-contract-gate.md`.

## Key rules

- `apps/legacy` is excluded from pnpm workspaces, Biome, and Turbo pipelines. Never modify it or add it back to tooling.
- Generated files (e.g. `*.generated.ts` from protobuf) are excluded from Biome.
- v1.0.0 is real-time only — no persistence across Live Sessions.
- No backend, no user accounts in v1.0.0. See `docs/adr/0002-no-backend-in-v1.md`.

## Architecture decisions

All ADRs live in `docs/adr/`. Read them before proposing architectural changes:
- `0001` — Chrome extension over Electron
- `0002` — No backend in v1.0.0; Google OAuth for v2
- `0003` — tiktok-live-core as a separate package
- `0004` — User Preferences in chrome.storage.local
- `0005` — Gift celebration overlay (triptych + giver pill + burst queue)
