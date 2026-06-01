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
- **Injection:** a `world: MAIN` content script at `document_start` (so the global is patched before TikTok's code runs), bridged to an isolated-world content script via `window.postMessage` (the MAIN world has no `chrome.*` APIs).
- **Routing & transport:** isolated content script → service worker → the paired Session Tab, via `chrome.runtime` messaging carrying the `ArrayBuffer` (structured-clone). **In-memory only — nothing is written to persistent storage.** The Tab Pairing Registry resolves the destination Session Tab from `sender.tab.id`.
- **Ownership:** the **Session Tab** mints the object URL from the transferred bytes and **revokes it** when the celebration ends or is dropped by backpressure. The capture side retains nothing after forwarding.
- **Lifecycle:** the Tap is armed only while the TikTok tab is paired to a Session Tab.
- **Independence:** the Tap is independent of the `Provider`. It emits **Gift Animation Assets** (no identity), and never touches the Chrome Debugger API or the protobuf decode path.

## Consequences

- **Robust to TikTok changes.** We tap plaintext, so rotating the cipher, key, or re-obfuscating the worker does not break us. Option A was rejected as a brittle, ongoing reverse-engineering burden.
- **The asset stream is identity-less**, which is *why* the Gift Celebration is anonymous and has no value threshold (see ADR-0005). The same asset is shared by every giver of a gift.
- **New injection surface.** This is the extension's **first content script** (the Provider used only the Chrome Debugger API). It requires `host_permissions` for tiktok.com and a `world: MAIN` registration — a larger attack/permission surface than the Debugger-only design.
- **We never re-fetch the CDN**, so CDN host/path, URL signing, expiry, and `Referer` requirements are all irrelevant. (Observed: different gifts loaded from different CDN paths — confirming we must not depend on them.)
- **Routing reliability** comes from the content script's `sender.tab.id` (always valid), avoiding the worker-initiated-request `tabId === -1` problem that pure `webRequest` interception would have faced.
- **Homes:** the Tap implementation lives in `tiktok-live-chrome-extension` (Chrome platform code; it cannot live in `tiktok-live-core`, which forbids platform dependencies). The platform-agnostic Gift Animation Asset *type* may live in `tiktok-live-core`.
- **Deferred to integration:** exact message/queue plumbing between the content scripts, service worker, and Session Tab; memory bounds under bursts (mitigated by ADR-0005's bounded-queue + drop policy).
