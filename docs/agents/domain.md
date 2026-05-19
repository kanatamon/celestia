# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root for Celestia domain language and monorepo structure.
- `docs/adr/` for architecture decisions that touch the area being changed.
- `docs/agents/shared.md` for shared agent instructions.

If any of these files do not exist, proceed silently. Do not suggest creating them upfront.

## File structure

Celestia is a single-context repo:

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   └── agents/
├── apps/
└── packages/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`. Prefer project terms such as Celestia, Side Panel, Provider, Chrome Extension Provider, Live Session, LiveEvent, and ConnectionState.

If the concept needed is not in the glossary yet, note the gap rather than inventing durable terminology.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
