# Live Ingestion Trace Replay

Use the replay harness when a `celestia-trace-v1` export needs local validation without a
real TikTok Live Session.

The harness lives in:

- `packages/tiktok-live-chrome-extension/tests/live-ingestion-replay-harness.ts`

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

Run the focused gate with:

```sh
corepack pnpm --filter @celestia/tiktok-live-chrome-extension test
```
