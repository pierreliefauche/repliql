# Agent notes

Conventions for agents working in this repo.

## Keep docs in sync

After making changes, check whether they invalidate or extend the existing docs, and update them in the same change if so:

- [README.md](README.md) — high-level project description and milestones. Update when the project's scope, milestones, or positioning changes.
- Per-package / per-playground READMEs (e.g. [packages/reactive-kysely/README.md](packages/reactive-kysely/README.md), [playgrounds/linear/README.md](playgrounds/linear/README.md)) — update when the package's public API, supported operators/types, or user-facing workflow changes.
- Per-package `AGENTS.md` (e.g. [packages/reactive-kysely/AGENTS.md](packages/reactive-kysely/AGENTS.md)) — update when you change a design decision, internal invariant, or anything the "Design decisions" section documents.
- Root [AGENTS.md](AGENTS.md) — update when you introduce a repo-wide convention, script, or workflow future agents should know about.

Skip the update if the change is a pure bugfix or refactor that doesn't alter documented behavior.

## Playgrounds

### `playgrounds/linear`

- The shipped GraphQL schema is a subset generated from `queries.ts`. If you add or modify a query, regenerate it: `bun run scripts/build-schema-subset.ts` from the playground directory. Details in [playgrounds/linear/README.md](playgrounds/linear/README.md#graphql-schema).
