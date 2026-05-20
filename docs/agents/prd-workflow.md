# PRD Workflow

PRDs are GitHub issues that describe product intent before implementation issues
are worked. Use this workflow when creating or updating PRD issues.

## Required Sections

Every PRD must include these sections:

- Problem Statement
- Solution
- User Stories
- Implementation Decisions
- Testing Decisions
- Core Ingestion Risk
- Out of Scope

## Core Ingestion Risk

Every PRD must include a `Core Ingestion Risk` section. The section should be
filled out in product terms so an implementation agent can understand whether the
work affects Celestia's core LiveEvent ingestion path before editing code.

Use this template:

```markdown
## Core Ingestion Risk

Does this PRD affect any part of Celestia's core LiveEvent ingestion path?

- LiveEvent capture:
- ConnectionState behavior:
- WebSocket discovery:
- Protobuf decode:
- LiveEvent normalization:
- LiveEvent deduplication:
- Live Session event store updates:

Expected ConnectionState behavior:

Expected LiveEvent behavior:

Validation required:

- Replay validation required:
- Manual TikTok Live verification required:

Architecture constraints:

- Keep v1.0.0 extension-only: no backend.
- Do not add user accounts or separate authentication.
- Do not persist data across Live Sessions.
- Keep `tiktok-live-core` platform agnostic.
- Keep Chrome Debugger API, WebSocket discovery, protobuf decode, and
  Chrome-specific Provider behavior inside `tiktok-live-chrome-extension`.
```

If a PRD does not touch ingestion, say so explicitly and still complete the
expected behavior and validation fields with `No change` or `Not required`.
