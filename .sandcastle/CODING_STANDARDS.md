# Coding Standards

These standards are loaded by the Sandcastle reviewer. Treat this file as the
portable, container-visible source of project review rules. Do not assume host
machine Codex skills, global prompts, shell aliases, or editor configuration are
available inside Sandcastle's Docker container.

## Required Context

- Read `CONTEXT.md` before reviewing architectural or domain changes.
- Follow `docs/agents/shared.md` for shared agent rules.
- Read relevant ADRs in `docs/adr/` before accepting architectural changes.
- Use the project language from `CONTEXT.md`: Celestia, Live Session, Side Panel,
  Provider, Chrome Extension Provider, LiveEvent, ConnectionState,
  `tiktok-live-core`, `tiktok-live-chrome-extension`, and `ui`.
- Avoid legacy or ambiguous terms called out in `CONTEXT.md`, including Ceresia,
  overlay, connector, service, client, room, status, and ambiguous uses of stream.

## Style

- Use TypeScript strict-mode patterns. Avoid `any`, unsafe casts, non-null
  assertions, and unchecked indexing unless the code first validates the data or
  clearly narrows the type.
- Use `import type` for type-only imports.
- Keep file and folder names kebab-case ASCII only. This is enforced by Biome.
- Follow Biome formatting: tabs, single quotes in JavaScript/TypeScript, trailing
  commas, and a 100-column line width.
- Prefer explicit, readable control flow over clever compact code. Avoid nested
  ternaries.
- Keep comments sparse and useful. Remove comments that restate obvious code;
  keep comments that explain protocol quirks, Chrome extension constraints, or
  non-obvious domain decisions.
- Do not introduce unrelated refactors, formatting churn, or broad abstractions
  while reviewing a focused change.

## Testing

- Run the narrowest relevant verification for the change, then broaden when the
  change touches shared contracts or multiple packages.
- Prefer root workspace commands when pnpm is available:
  - `pnpm check` for Biome format/lint fixes
  - `pnpm typecheck` for TypeScript
  - `pnpm test` for tests
  - `pnpm build` when build outputs or package boundaries are affected
- In Sandcastle containers that have Node/npm but not pnpm installed, use the
  equivalent npm scripts: `npm run typecheck`, `npm run test`, and
  `npm run build`.
- New or changed behavior should have tests when the project has an applicable
  test surface. If no test surface exists yet, call out the gap instead of
  pretending behavior is verified.
- Do not lint, type-check, test, modify, or re-add `apps/legacy` to tooling.

## Architecture

- `apps/legacy` is read-only reference material. Never modify it.
- v1.0.0 is extension-only and real-time only: no backend, no Celestia account,
  no database, and no persistence across Live Sessions.
- Keep `@celestia/tiktok-live-core` platform agnostic. It owns the
  `TikTokLiveProvider` interface, `ConnectionState`, `LiveEvent` union, and
  shared value types. It must not import Chrome APIs, React UI, or Provider
  implementations.
- Keep `@celestia/tiktok-live-chrome-extension` responsible for Chrome-specific
  Provider implementation details: Chrome Debugger API integration, WebSocket
  discovery, protobuf decoding, and normalized LiveEvent emission.
- Keep `@celestia/ui` display-only. UI components may depend on
  `tiktok-live-core` types but must not depend on Chrome APIs or concrete
  Providers.
- The Side Panel should subscribe to a Provider and render LiveEvents and
  ConnectionState. It should not talk directly to Chrome Debugger APIs.
- Preserve package boundaries from `CONTEXT.md` and ADR 0003. Do not collapse
  platform-agnostic types into Chrome-extension-specific packages.
- Generated files such as `*.generated.ts` are excluded from Biome. Avoid manual
  edits to generated outputs unless the generation workflow is unavailable and
  the reason is documented in the review.

## Security And Privacy

- Celestia observes TikTok through the user's existing browser tab. Do not add
  TikTok credential handling, session ownership, credential storage, or separate
  TikTok login flows.
- Do not introduce network calls, telemetry, persistence, or account concepts
  without an explicit architecture decision.
- Be careful with logs: do not log credentials, cookies, session identifiers, or
  raw protocol payloads that could expose private user data.
