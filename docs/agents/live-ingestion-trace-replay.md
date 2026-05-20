# Live Ingestion Trace Replay

Use the replay harness when a `celestia-trace-v1` export needs local validation without a
real TikTok Live Session.

If a new live-only artifact is required, use the human-in-the-loop capture workflow in
`docs/agents/live-ingestion-hitl-checklist.md` first. One useful manual live run should be
converted into local replay evidence before requesting another run.

The harness lives in:

- `packages/tiktok-live-chrome-extension/tests/live-ingestion-replay-harness.ts`
- `packages/tiktok-live-chrome-extension/tests/golden-live-ingestion-replay-fixtures.ts`

It accepts either a parsed `LiveIngestionTraceDocument` or the exported JSON string. Replay
feeds reconstructed Chrome Debugger API events into `ChromeExtensionTikTokLiveProvider` through
a fake `ChromeDebuggerTransport`, matching the Provider boundary used by the Side Panel.

Replay assertions are intentionally external:

- emitted `LiveEvent` types
- observed `ConnectionState` transitions
- final `decodeFailures` count
- Provider diagnostic logs for decode results and decode errors

The harness does not assert private Provider state such as socket maps, timer IDs, or helper call
order. `frame_received.syntheticPayloadBase64` is injected as `response.payloadData`; skipped
frames with `syntheticPayloadBase64: null` are not injected.

## Golden Fixtures

Golden replay fixtures are small, sanitized `celestia-trace-v1` documents that preserve a
previously discovered live-ingestion failure mode. They should live in
`golden-live-ingestion-replay-fixtures.ts` and be added to `goldenLiveIngestionReplayFixtures`.

Each new live-only bug should become a fixture after one useful manual artifact is captured:

- reduce the trace to the smallest Chrome Debugger API sequence that reproduces the Provider
  behavior
- keep user data sanitized: hashed tab URLs, hashed usernames, hashed query strings, generic
  request IDs, and synthetic protobuf payloads without real user identity or chat text
- assert user-visible behavior only: emitted `LiveEvent` types, observed `ConnectionState`
  transitions, final `decodeFailures`, and diagnostic log categories
- keep Chrome Debugger API details, WebSocket discovery behavior, protobuf payloads, and
  Chrome-specific Provider behavior inside `tiktok-live-chrome-extension`
- do not add backend storage, user accounts, or persistence across Live Sessions for replay
  artifacts

Run the focused gate with:

```sh
corepack pnpm --filter @celestia/tiktok-live-chrome-extension test
```
