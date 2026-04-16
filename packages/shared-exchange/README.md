# Shared Exchange

> Share a single [URQL](https://urql.dev) exchange between multiple tabs/processes.

`@repliql/shared-exchange` enables centralized GraphQL state management across browser tabs or Electron renderer processes using a hub-and-spoke architecture. Run a single exchange in a shared worker or main process, and have multiple URQL clients access it simultaneously.

## Features

- **Unified Cache** – Share a single GraphQL cache across multiple tabs/processes
- **Deduplication** – Identical subscriptions are only sent once, regardless of request count
- **Intelligent Teardown** – Operations are only cleaned up when all consumers unsubscribe
- **Priority Forwarding** – Results are returned to origin spokes first
- **Flexible Architecture** – Works with any URQL exchange (cache, auth, logging, etc.)
- **Cross-Platform** – Browser (SharedWorker) and Electron (main process) support
- **Zero-Config** – Drop-in integration into existing URQL clients

## Installation

```bash
npm install @repliql/shared-exchange
```

**Peer Dependencies:**

- `@urql/core` ≥ 5.0.0
- `wonka` ≥ 6.0.0

## How It Works

The library uses a hub & spoke architecture powered by [Comlink](https://www.npmjs.com/package/comlink) for inter-process communication:

- **Hub** – Single shared worker (browser) or main process (Electron) running the exchange
- **Spokes** – Multiple tabs or renderer processes that connect to the hub
- **MessagePort** – Lightweight bidirectional communication channel between hub and spoke

## Setup

### Browser Setup (SharedWorker)

#### 1. Create a SharedWorker file

**worker.ts** – The hub process

```ts
import { cacheExchange } from '@urql/exchange-graphcache'
import { exposeSharedService, SharedService } from '@repliql/shared-exchange'

// Create the exchange (cache, logging, auth, or any custom exchange)
const sharedService = new SharedService({
  exchange: cacheExchange({}),
})

// Expose to all connected tabs
exposeSharedService(sharedService)
```

#### 2. Connect from your tabs

**main.ts** – The spoke (your app)

```ts
import { createClient, fetchExchange } from 'urql'
import { proxySharedExchange } from '@repliql/shared-exchange'

// Connect to the shared worker
const worker = new SharedWorker('worker.ts')

// Create the proxy exchange
const sharedCacheExchange = proxySharedExchange({
  endpoint: worker.port,
})

// Use in your URQL client
const urqlClient = createClient({
  url: 'https://api.app/graphql',
  exchanges: [sharedCacheExchange, fetchExchange],
})
```

### Electron Setup (Main Process)

#### 1. Set up the hub (main process)

**main.ts**

```ts
import { app, ipcMain } from 'electron'
import { cacheExchange } from '@urql/exchange-graphcache'
import { exposeSharedService, SharedService } from '@repliql/shared-exchange'

app.on('ready', () => {
  const sharedService = new SharedService({
    exchange: cacheExchange({}),
  })

  exposeSharedService(sharedService)
})
```

#### 2. Connect from renderer processes

**renderer.ts**

```ts
import { createClient, fetchExchange } from 'urql'
import { proxySharedExchange } from '@repliql/shared-exchange'
import { ipcRenderer } from 'electron'

const port = // receive MessagePort from main process
const sharedCacheExchange = proxySharedExchange({ endpoint: port })

const urqlClient = createClient({
  url: 'https://api.app/graphql',
  exchanges: [sharedCacheExchange, fetchExchange],
})
```

## Rules of Shared Exchanges

These behaviors are automatic and enforce consistency across spokes:

- ✅ Can be added anywhere in the exchange chain
- ✅ Keeps track of operations per spoke and only applies teardown when **all** spokes using the operation have sent teardowns
- ✅ Operations are forwarded to their **origin spoke in priority**
- ✅ Subscriptions are **de-duplicated** (2 spokes requesting the same subscription will not trigger 2 subscriptions down the chain)

## Advanced Examples

### Reset Cache Between Tabs

Extend `SharedService` to expose custom methods callable from any spoke:

**worker.ts**

```ts
import { cacheExchange } from '@urql/exchange-graphcache'
import { exposeSharedService, SharedService } from '@repliql/shared-exchange'

function initCacheExchange() {
  return cacheExchange({})
}

// Extend to expose custom methods to spokes
class MySharedService extends SharedService {
  resetCache() {
    this.exchange = initCacheExchange()
  }
}

const sharedService = new MySharedService({
  exchange: initCacheExchange(),
})

exposeSharedService(sharedService)
```

**app.tsx**

```ts
import { createClient, fetchExchange } from 'urql'
import { proxySharedExchange, proxySharedService } from '@repliql/shared-exchange'

const worker = new SharedWorker('worker.ts')

// Get a proxy to call custom methods on SharedService
const sharedService = proxySharedService({ endpoint: worker.port })

const urqlClient = createClient({
  url: 'https://api.app/graphql',
  exchanges: [proxySharedExchange({ sharedService }), fetchExchange],
})

// Call shared service method from any spoke
export function handleLogout() {
  sharedService.resetCache()
  // Cache is now cleared for all connected tabs
}
```

## API Reference

### SharedService

The hub-side exchange wrapper. Manages state synchronization and operation deduplication.

```ts
class SharedService {
  exchange: Exchange
  constructor(options: { exchange: Exchange })
}
```

**Properties:**

- `exchange` – The underlying URQL exchange (assignable for hot-swapping)

### exposeSharedService()

Exposes a `SharedService` instance to all connecting spokes. Call once in your shared worker or main process.

```ts
function exposeSharedService(service: SharedService): void
```

### proxySharedExchange()

Creates a spoke-side exchange that proxies all operations to the hub. Drop this into your URQL client's exchange chain.

```ts
function proxySharedExchange(
  config: { endpoint: MessagePort } | { sharedService: SharedService },
): Exchange
```

**Parameters:**

- `endpoint` – MessagePort from SharedWorker or main process
- `sharedService` – Optional proxy reference to call custom methods

### proxySharedService()

Gets a proxy reference to the hub's `SharedService` instance. Allows calling custom methods exposed by extended `SharedService` classes.

```ts
function proxySharedService(config: { endpoint: MessagePort }): any
```

## Use Cases

- **Multi-Tab Synchronization** – Share cache and optimistic updates across browser tabs
- **Offline-First Apps** – Centralize offline state detection and retry logic
- **Electron Apps** – Keep data in sync between main and renderer processes
- **SSO Integration** – Share authentication state across tabs
