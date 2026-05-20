# Live Ingestion Contract Test Gate

This gate is required before an agent can declare work complete when a change affects
Celestia's LiveEvent ingestion path, including:

- Chrome Extension Provider behavior
- Chrome Debugger API WebSocket discovery
- protobuf frame decoding
- LiveEvent normalization
- LiveEvent deduplication
- Provider contract behavior
- ConnectionState classification

The gate is based on externally observable behavior. Tests should assert emitted
LiveEvents, ConnectionState transitions, decode failure counts, and diagnostic logs.
Do not couple the gate to private implementation details such as internal maps, helper
method call order, or transport bookkeeping that users and Provider consumers cannot
observe.

## Required Scenarios

Focused validation must cover these scenarios before ingestion-sensitive work is
complete:

- Unmapped request IDs recover after payload-proven LiveEvents. A valid TikTok Live
  payload received without a known WebSocket URL must emit LiveEvents and allow the
  Provider to recover discovery.
- Empty decoded frames do not mark the Provider connected. A decoded frame with no
  LiveEvents must not confirm a WebSocket or transition ConnectionState to connected.
- Malformed unmapped frames do not count as decode failures. Irrelevant or malformed
  frames from request IDs that have not been proven to be the Live WebSocket must be
  ignored without increasing the Provider decode failure count.
- The same Live WebSocket URL with a new request ID is accepted. A later WebSocket
  created with the known TikTok Live URL must decode LiveEvents and replace the
  confirmed request ID.
- Browser-native APIs that require a global receiver are invoked correctly.
  Browser-compatible paths for APIs such as `atob`, `setTimeout`, and `clearTimeout`
  must not throw `Illegal invocation` in Chrome-like environments.
- Decode failures are distinguished from post-decode LiveEvent emission failures. A
  decoded payload that fails during handler emission must be logged and isolated from
  decode failure accounting.

## Focused Commands

Run the focused ingestion gate for ingestion-sensitive work:

```sh
pnpm --filter @celestia/tiktok-live-chrome-extension test
```

That package command type-checks the executable contract tests. The required scenario
coverage lives in:

- `packages/tiktok-live-chrome-extension/tests/provider-contract.test.ts` for Provider
  behavior, WebSocket discovery, ConnectionState transitions, decode failure counts,
  post-decode emission diagnostics, and browser timer invocation behavior.
- `packages/tiktok-live-chrome-extension/tests/decode-webcast-frame.test.ts` for decoder
  behavior, browser-compatible base64 decoding, protobuf envelope handling,
  deduplication, and normalization outputs.

Before committing any completed issue, also run the repository-wide checks required by the implementation workflow:

```sh
pnpm typecheck
pnpm test
```

If pnpm is unavailable in the execution environment, use the equivalent npm scripts.

## Review Notes

Use `packages/tiktok-live-chrome-extension/tests/provider-contract.test.ts` as the
canonical executable behavior spec for Chrome Extension Provider ingestion behavior. Use
`packages/tiktok-live-chrome-extension/tests/decode-webcast-frame.test.ts` for decoder
compatibility, protobuf envelope handling, normalization, and browser base64 behavior.

If a required scenario is not covered by an existing test after an ingestion-sensitive
change, add or update the contract test before implementation is considered complete.
