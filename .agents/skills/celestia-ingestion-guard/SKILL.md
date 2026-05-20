---
name: celestia-ingestion-guard
description: >-
  Use for Celestia work that can affect LiveEvent ingestion, including the
  Chrome Extension Provider, WebSocket discovery, protobuf decode,
  normalization, deduplication, provider contract behavior, ConnectionState
  classification, Side Panel ingestion, diagnostics, or replay tooling.
---

# Celestia Ingestion Guard

Use this skill before editing any Celestia code or docs that can change how the Chrome
Extension Provider captures TikTok Live traffic, decodes frames, emits LiveEvents, or reports
ConnectionState.

LiveEvent ingestion is a high-risk product area. Missing LiveEvents and false connected state are
core Celestia regressions because the Side Panel can look healthy while the Live Session feed is
incomplete or dead.

## Trigger Areas

Invoke this skill when work touches any of these areas:

- Chrome Extension Provider attachment, debugger lifecycle, WebSocket discovery, frame routing, or
  socket identity.
- Protobuf frame decoding, envelope parsing, decompression, browser base64 handling, or decoded
  payload interpretation.
- LiveEvent normalization for chat, gifts, likes, member joins, viewer counts, stream-ended events,
  or future event types.
- Deduplication, event ordering, event buffering, or reset behavior across Live Sessions.
- Provider contract behavior, emitted LiveEvents, decode failure handling, post-decode emission
  handling, or ConnectionState classification.
- Side Panel ingestion behavior, Provider subscription lifecycle, confirmed Live Target switching,
  feed reset, or state display based on Provider output.
- Diagnostic/replay infrastructure, captured Chrome Debugger API traces, replay fixtures, provider
  observation logs, or local replay harnesses.

If the change only alters presentation of already-normalized LiveEvents and cannot affect Provider
behavior, state why this skill does not apply before proceeding.

## Required Pre-Edit Statement

Before making code edits, state the ingestion risk in plain product terms:

1. Affected stage: classify the change as one or more of `capture`, `decode`, `normalize`,
   `dedup`, `provider state`, `Side Panel ingestion`, or `diagnostic/replay infrastructure`.
2. User-visible risks: identify whether the change could cause missing LiveEvents, false connected
   state, stale/error state regressions, duplicate events, swallowed decode failures, or
   browser-only runtime failures.
3. Expected product impact: explain what the user should see in terms of LiveEvents and
   ConnectionState when the change works correctly.
4. Required validation: name the focused provider/decoder contract tests, replay checks, or manual
   live verification needed before completion.

Do not start editing ingestion-sensitive code until this statement is complete.

## Known Regression Assumptions

Check these assumptions explicitly during design, implementation, and review:

- Do not assume unknown WebSocket URLs mean a frame is irrelevant. Debugger attachment can miss
  WebSocket creation events, so unmapped request IDs may still carry valid TikTok Live payloads.
- Do not mark a Provider connected from empty decoded frames. Connected means the Provider has proof
  of real LiveEvent ingestion, not merely a decodable empty payload.
- Distinguish decode failures from post-decode emission failures. A listener or timer failure after
  decode should not be reported as a decode failure.
- Malformed unmapped frames should not prove a Live socket and should not poison the Live Session.
- Reused Live WebSocket URLs can appear with new request IDs; socket identity must handle that
  without dropping valid frames.
- Browser-native APIs can require their global receiver. Validate browser-compatible use of timers,
  base64 helpers, and other globals that differ from Node behavior.

## Validation Gate

Focused provider/decoder validation is required before declaring ingestion-sensitive work complete.

Prefer external behavior tests over private implementation tests:

- Provider contract tests should assert emitted LiveEvents, ConnectionState transitions, decode
  failure counts, and diagnostic observations at the Provider boundary.
- Decoder tests should cover browser-compatible base64 decoding, protobuf envelope handling,
  decompression paths, deduplication, and normalized LiveEvent output.
- Replay tests should feed captured Chrome Debugger API sequences through the same Provider boundary
  used by the Side Panel.

For changes in this area, run the narrow test first while developing, then run the repository gates
required for the task. If a real TikTok Live Session is still needed, state what could not yet be
represented by a contract or replay fixture.

## Completion Summary

When reporting completion, include:

- The affected ingestion stage or stages.
- The expected LiveEvent and ConnectionState behavior after the change.
- The validation that ran, especially focused provider/decoder tests.
- Any remaining manual live verification or replay fixture gap.
