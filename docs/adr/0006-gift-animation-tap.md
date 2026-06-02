# 0006 — Gift Animation Tap: capturing decrypted gift assets

**Status:** Accepted

## Context

The Gift Celebration (ADR-0005) plays TikTok's **exact** gift animation, so we must obtain the real asset bytes. Investigation established how TikTok delivers them, and the path is not obvious:

- A high-value gift's animation is fetched by a dedicated Web Worker (`alpha_video_load_worker…js`) as a **whole-file-encrypted `.zip`** from a TikTok CDN (e.g. `…/<hash>.zip`), with a constant `decryptKey: 'pw_revenue_gift_alpha_video'` (a key *name*; the real key material is embedded in the worker bundle).
- The bytes on the wire are opaque: entropy ≈ 8.0 bits/byte, no `PK` header, no `ftyp` — confirmed a custom whole-file cipher, **not** a password-protected zip. Re-fetching the CDN URL yields only ciphertext.
- The worker decrypts and unzips into the SBS alpha MP4, then the **page main thread** turns it into a blob via `URL.createObjectURL` and feeds a `<video>`.
- The `blob:` URL is in-memory and origin/document-scoped — invalid in any other context (including our Session Tab), and not visible to `webRequest`.

There were two ways to get decrypted bytes:

- **Option A — reimplement the cipher.** Reverse-engineer TikTok's whole-file cipher + key from the obfuscated worker bundle and decrypt/unzip ourselves (e.g. in the service worker). Keeps capture to pure network interception.
- **Option B — tap the plaintext output.** Let TikTok's worker do the decryption, and intercept the already-decrypted MP4 at the page's main-thread `createObjectURL` choke point.

## Decision

**Option B — the Gift Animation Tap.** Locked, empirically validated on live gifts:

- **Tap point:** the paired TikTok tab's main-thread `URL.createObjectURL`, **armed** by hooking `Worker.prototype.postMessage` for the message carrying `decryptKey === 'pw_revenue_gift_alpha_video'`, then capturing the next `video/mp4` blob and reading `blob.arrayBuffer()`. Proven: every captured blob was an `ftyp`-valid MP4, arm→grab was tight (~95–225 ms), and there were zero false positives (no unarmed mp4 blobs).
- **Injection:** a `world: MAIN` content script at `document_start` (so the global is patched before TikTok's code runs), bridged to an isolated-world content script via `window.postMessage` (the MAIN world has no `chrome.*` APIs). **The MAIN-world tap must inject _synchronously_ at `document_start`.** crxjs (`@crxjs/vite-plugin`) wraps every `content_scripts[].js` entry in an async-`import()` loader stub with no opt-out, which made the patch land ~0.9–1.1 s after navigation — after the document reached `interactive` and after TikTok's code ran (issue #65, measured live). The tap is therefore **kept out of `manifest.config.ts`** and instead bundled into a self-contained classic IIFE by the `giftTapClassicInjection` build plugin (`apps/chrome-extension/gift-tap-classic-injection.ts`), which registers it directly in the emitted `manifest.json`. The isolated-world relay still goes through crxjs's loader — its timing is irrelevant since it only receives `window.postMessage` events.
- **Routing & transport:** the bytes cross three hops — MAIN-world tap → isolated content script (`window.postMessage`), isolated content script → service worker (`chrome.runtime`), service worker → paired Session Tab (`chrome.tabs`). Only the first hop is structured-clone: `window.postMessage` carries the raw `ArrayBuffer` (transferred). The two `chrome.runtime`/`chrome.tabs` hops are **JSON-serialized, not structured-clone** — an `ArrayBuffer` silently flattens to `{}` and is rejected by the type guard, so binary payloads **must be base64-encoded** across those hops. **In-memory only — nothing is written to persistent storage.** The Tab Pairing Registry resolves the destination Session Tab from `sender.tab.id`.
- **Ownership:** the **Session Tab** mints the object URL from the received bytes (base64-decoded back to an `ArrayBuffer`) and **revokes it** when the celebration ends or is dropped by backpressure. The capture side retains nothing after forwarding.
- **Lifecycle:** the Tap is armed only while the TikTok tab is paired to a Session Tab.
- **Independence:** the Tap is independent of the `Provider`. It emits **Gift Animation Assets** (no identity), and never touches the Chrome Debugger API or the protobuf decode path.

## Consequences

- **Robust to TikTok changes.** We tap plaintext, so rotating the cipher, key, or re-obfuscating the worker does not break us. Option A was rejected as a brittle, ongoing reverse-engineering burden.
- **The asset stream is identity-less**, which is *why* the Gift Celebration is anonymous and has no value threshold (see ADR-0005). The same asset is shared by every giver of a gift.
- **New injection surface.** This is the extension's **first content script** (the Provider used only the Chrome Debugger API). It requires `host_permissions` for tiktok.com and a `world: MAIN` registration — a larger attack/permission surface than the Debugger-only design.
- **We never re-fetch the CDN**, so CDN host/path, URL signing, expiry, and `Referer` requirements are all irrelevant. (Observed: different gifts loaded from different CDN paths — confirming we must not depend on them.)
- **Routing reliability** comes from the content script's `sender.tab.id` (always valid), avoiding the worker-initiated-request `tabId === -1` problem that pure `webRequest` interception would have faced.
- **Homes:** the Tap implementation lives in `tiktok-live-chrome-extension` (Chrome platform code; it cannot live in `tiktok-live-core`, which forbids platform dependencies). The platform-agnostic Gift Animation Asset *type* may live in `tiktok-live-core`.
- **Synchronous injection has a build-time cost and a guard.** Bypassing crxjs for the tap means the build patches the crxjs-emitted `manifest.json` after the fact — a dependency on crxjs's manifest-emit ordering. The build plugin asserts the final manifest registers the classic file (not a crxjs `*-loader*.js`) and that the bundle carries no surviving `import()`, so a crxjs upgrade that moves that seam fails loudly at build time rather than silently reintroducing the late-injection race (issue #65). Dev mode (`pnpm dev`) still uses the crxjs loader; this is accepted (MAIN world cannot HMR, dev is not shipped, and `Worker.postMessage` patching is retroactive so dev capture still works).
- **Defense-in-depth self-check.** Because a late or displaced wrapper fails *silently* (gifts simply stop capturing, with no error), the tap verifies at arm time that `URL.createObjectURL` is still our wrapper and `console.error`s if not. This converts the latent failure mode into an observable signal.
- **Deferred to integration:** exact message/queue plumbing between the content scripts, service worker, and Session Tab; memory bounds under bursts (mitigated by ADR-0005's bounded-queue + drop policy).
