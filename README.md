# Repliql

Repliql is an offline-first cache and local database extension for [URQL](https://formidable.com/open-source/urql/), the GraphQL client. It enables data-heavy applications to work seamlessly offline while maintaining data consistency.

## Overview

The core package provides a URQL exchange that replaces document-cache or normalized cache solutions, offering persistent, offline-first data storage with efficient querying and synchronization capabilities.

## Packages

| Package                                                          | Description                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`@repliql/repliql`](packages/repliql)                           | Offline-first URQL exchange backed by a local SQLite database. The headline package.           |
| [`@repliql/reactive-kysely`](packages/reactive-kysely)           | Reactive queries for Kysely — `liveQuery()` re-emits when underlying rows change.              |
| [`@repliql/kysely-driver-bridge`](packages/kysely-driver-bridge) | Bridge a Kysely driver across processes (tab ↔ shared worker ↔ dedicated worker) over Comlink. |
| [`@repliql/shared-exchange`](packages/shared-exchange)           | Share a single URQL exchange across multiple tabs / renderer processes.                        |
| [`@repliql/shared-service`](packages/shared-service)             | Per-tab service instances exposed from a SharedWorker, with automatic tab-death detection.     |
| [`@repliql/conduit`](packages/conduit)                           | SharedWorker with dedicated-worker powers via leader election (e.g. for OPFS access).          |
| [`@repliql/utils`](packages/utils)                               | Shared utilities: hashing, stable serialization, GraphQL execution, URQL helpers.              |

Playgrounds:

- [`playgrounds/linear`](playgrounds/linear) — end-to-end demo wiring all the pieces together against the Linear GraphQL API.

## Use-cases

- Large datasets
- Offline support with data persistence
- Framework to build data sync (not a magic solution that will auto-sync!)
- Flexible and fast local data search, filtering and querying
- Auto-suggest, auto-completion
- Data shared between app windows

Typical applications:

- Calendar
- Mail
- Project management

## Milestones

#### 🤞 0.1.0 Hub & spoke exchange

Scaffold URQL exchange working as hub & spoke: a central hub running in a shared worker connected to spoke exchanges in each web page.

The spoke exchange sits right before the final fetch exchange and intercepts operations and operation results. Data flowing both ways is redirected to the hub for processing. For now the hub won't do any processing, just let data through.

#### 🤞 0.2.0 Write-only normalized cache

Run SQLite (Wasm) in the shared worker, with Kysely as interface.
On operation result, normalize received data and save in SQLite.

#### 🤞 0.3.0 "Dead" normalized cache

Execute GraphQL request locally against the normalized data stored in SQLite.
Updates to read data does not automatically trigger an event.

#### 🤞 0.4.0 Normalized cache

Updates to data in cache recompute live queries and send updates to spokes.

#### 👍 0.5.0 Static query and field resolvers

Local resolution of entities in query and field resolvers, but without DB querying.
Example: `query itemById($id: ID!)` would return a pointer to an entity of type `Item` with given `id`, no DB read necessary.

#### 🚧 0.6.0 Dynamic query and field resolvers

Local resolution with access to read the DB.

#### 🚧 0.7.0 Optimistic mutations

Apply optimistic mutation patches to entities in DB via mutation resolvers.
Undo patch if mutation fails (maybe).

#### 🚧 0.8.0 Offline mutations

Store optimistic mutations in DB. Mutations are processed by a worker async.

#### 0.9.0 Draft mutations

Mutations can be expiring drafts to apply state locally immediately but not commit. Mutations can then be committed or canceled.
This would allow undo (with a timer for example) or app state.
