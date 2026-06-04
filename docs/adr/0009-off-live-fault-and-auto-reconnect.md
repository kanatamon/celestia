# 0009 — The `off-live` fault and Session-Tab Auto-Reconnect

**Status:** Accepted

## Context

A paired TikTok Live tab can stop producing **LiveEvents** for reasons the old
**ConnectionState** model could not tell apart. Before this decision the
classifier knew only `offline | interrupted | stale`, so when the user simply
**navigated the paired tab away from the live** (to the FYP, a profile, a VOD),
the live socket closed, events stopped, and the **Connection Advisory** mislabeled
it as `interrupted` — telling the user the "Celestia is debugging this browser"
banner was dismissed or DevTools was opened, which is a lie. Separately, the most
common *real* fault (a transient `interrupted`/`stale` on a tab that is still on
the live) popped the advisory immediately, nagging the user about a blip that
would have cleared on its own.

## Decision

Two changes, kept on opposite sides of the package boundary:

1. **A new `off-live` `ConnectionState` reason, owned by the classifier.** The
   pure `classifyConnectionState` gains a `tabIsLive` signal, supplied by the
   **Chrome Extension Provider**, which now watches `chrome.tabs.onUpdated` for
   its attached tab and re-evaluates `parseTikTokUsername(url)`. Precedence is
   `streamEnded → offline → !tabIsLive (off-live) → !debuggerAttached
   (interrupted) → !confirmedSocket (connecting) → stale → connected`: a tab that
   is not on a live at all *dominates* the downstream "debugger detached" / "no
   events" symptoms, but network loss still wins because we cannot trust a URL
   read while offline. `off-live` is raised **only after a confirmed-live
   connection** (a Provider-owned `everConnectedLive` latch) — a cold attach to a
   non-live tab does not raise it, since the **Launcher** only opens Session Tabs
   for live tabs. Its advisory offers **Reopen live**, which navigates the
   *existing paired tab* back to this session's streamer `/@user/live` — distinct
   from **Reconnect** (re-attach the debugger on the same tab) and **Relaunch**
   (open a *new* paired tab).

2. **Auto-Reconnect, owned by the Session Tab.** For a `reconnecting` fault
   (`interrupted`/`stale`) **while `tabIsLive`**, the Session Tab suppresses the
   advisory and silently fires the existing manual-Reconnect mechanism (remount →
   re-attach → re-discover) up to **3 times** (~6s/attempt, ~1s gap, ~20s worst
   case). Reaching `connected` resets the budget; exhaustion opens the advisory
   with a **patient, un-timed** manual Reconnect. The retry budget lives in the
   **Session Tab**, above the remount boundary — a remount destroys and recreates
   the Provider, so a budget inside `LiveFeed` would reset every attempt and loop
   forever.

## Consequences

- **The Provider's Chrome surface widens.** `tiktok-live-chrome-extension`
  previously touched only the Debugger API; it now also observes `chrome.tabs`
  navigation. This is the cost of keeping `ConnectionState` the single source of
  truth for "what is true about my tab" rather than splitting that knowledge into
  the Session Tab.
- **Auto-Reconnect's 6s per-attempt timeout is deliberately shorter than the
  Provider's 10s promiscuous-decode delay.** An oddly-named live socket that only
  decodes once promiscuous mode engages will *not* recover inside an auto-attempt.
  This is accepted: Auto-Reconnect is fast best-effort; the manual Reconnect
  offered after exhaustion has no timeout and recovers those sockets with full
  patience. The cap exists because ~20s of silent amber "Reconnecting" is the
  ceiling we'll spend before owing the user an honest advisory.
- **The `everConnectedLive` latch is Provider-owned and resets on remount.** In
  the rare race where an Auto-Reconnect remount is in flight *and* the user
  navigates away before the new Provider re-confirms live, the fault classifies as
  `interrupted` rather than `off-live` for a moment, then self-heals. We accept
  this to keep `attach`'s contract clean; the primary `off-live` path (navigate
  away from a *healthy* session) involves no remount and classifies correctly.
- **The advisory now branches on four reasons**, and Auto-Reconnect must abandon
  to the `off-live`/`offline` path if the fault changes mid-retry — the retry loop
  only continues while the fault is still "tab is live but events stopped."

## Considered Options

- **Detect the non-live URL entirely in the Session Tab** (poll `chrome.tabs.get`
  during a fault, layer a separate advisory on top, leave `ConnectionState`
  alone). Keeps the data-layer package free of `chrome.tabs`, but splits "truth
  about the tab" across two layers and bypasses the classifier — contradicting the
  documented "advisory branches on `reason`, classifier is source of truth" model.
  Rejected.
- **Raise `off-live` on the cold first attach too** (drop the `everConnectedLive`
  latch). Honors a literal reading of "check during discovering," but makes a
  slow-loading live page indistinguishable from a genuinely non-live tab and adds
  noise to a case the Launcher already guards. Rejected — a never-connected
  non-live tab simply spins on "Discovering."
- **Exponential backoff for Auto-Reconnect.** With only 3 attempts it buys little
  and just delays the honest advisory past the ~20s ceiling. Rejected for a short
  fixed gap.
