# Live Ingestion HITL Checklist

Use this checklist only for live-only ingestion failures that cannot be reproduced from an
existing `celestia-trace-v1` artifact or provider contract fixture.

## One Manual Live Run

1. Build and reload the unpacked Chrome extension from the current branch.
2. Enable trace mode before starting the Live Session:

```js
localStorage.setItem('celestia.trace', '1');
```

3. Reload the Side Panel and verify the Provider log marker appears:

```text
[Celestia Live Ingestion Diagnostics] provider.marker
```

The marker details should include `build: "live-ingestion-diagnostics-v1"` and
`traceEnabled: true`.

4. Open or confirm the intended TikTok Live tab in the Side Panel.
5. Let the Live Session run for 120 seconds, or until the suspected failure appears.
6. Export the replay trace from the Side Panel console:

```js
await window.__CELESTIA_EXPORT_LIVE_TRACE__();
```

7. Attach or paste the exported JSON artifact with the issue context. Do not include screenshots
or raw browser logs unless the trace export failed.

## Follow-Up Debugging

After one useful live artifact is captured, follow-up debugging should start with local replay:

```sh
corepack pnpm --filter @celestia/tiktok-live-chrome-extension test
```

Ask for another manual TikTok Live run only when the existing trace cannot represent the suspected
Chrome Debugger API sequence, browser-native runtime behavior, or Provider boundary behavior.
