# @repliql/shared-service

> Per-tab service instances exposed from a SharedWorker, with automatic lifecycle and tab-death detection.

`@repliql/shared-service` is a thin lifecycle layer on top of [`comlink`](https://www.npmjs.com/package/comlink) for SharedWorkers. You declare named services on the worker side; each connecting tab gets its own per-tab instance via `onConnectTab(tabId)`, and disconnects (including crashed tabs) trigger `onDisconnectTab(tabId, instance)` so you can clean up.

## Install

```bash
npm install @repliql/shared-service comlink
# or
bun add @repliql/shared-service comlink
```

[`comlink`](https://www.npmjs.com/package/comlink) is a peer dependency.

## Why

- **Per-tab state, not per-worker** — each tab gets its own instance keyed by a stable `tabId`. The worker can hold tab-scoped state (subscriptions, in-flight requests, etc.) without juggling tab identity itself.
- **Automatic teardown** — when a tab closes (or crashes), Web Locks heartbeat detection invokes `onDisconnectTab`. No leaked subscriptions.
- **Multiple services in one worker** — register a map of services and consume them on the tab side as a typed object.
- **Pure [Comlink](https://www.npmjs.com/package/comlink) under the hood** — no novel transport, no novel types.

## Usage

### Define your service

```ts
// MyCalculator.ts
export type MyCalculator = {
  square: (n: number) => number
}
```

### shared.worker.ts — the hub

```ts
import {
  SharedServicesManager,
  type SharedService,
} from '@repliql/shared-service/shared'
import * as Comlink from 'comlink'

import type { MyCalculator } from './MyCalculator'

const calculator: SharedService<MyCalculator> = {
  onConnectTab(tabId) {
    return {
      square(n) {
        return n * n
      },
    }
  },
  onDisconnectTab(tabId, instance) {
    // Clean up any tab-scoped state held by `instance`
  },
}

const manager = new SharedServicesManager<{ calculator: MyCalculator }>({
  services: { calculator },
})

onconnect = e => Comlink.expose(manager.connector, e.ports[0])
```

### tab.ts — the spoke

```ts
import {
  wrapSharedServices,
  type SharedServicesConnector,
} from '@repliql/shared-service/tab'
import * as Comlink from 'comlink'

import type { MyCalculator } from './MyCalculator'

const worker = new SharedWorker(new URL('./shared.worker.ts', import.meta.url))
const connector = Comlink.wrap<SharedServicesConnector>(worker.port)

const { calculator } = wrapSharedServices<{ calculator: MyCalculator }>(connector)

console.log(await calculator.square(2)) // 4
```

## Lifecycle

1. The tab calls `wrapSharedServices`, which acquires a Web Locks heartbeat for its `tabId` and calls `connector.connect(tabId)` on the hub.
2. The hub instantiates each registered service via `onConnectTab(tabId)` and exposes them to the tab.
3. When the tab is closed or its process dies, the heartbeat lock releases. The hub detects the release and invokes `onDisconnectTab(tabId, instance)` for each service so you can dispose of tab-scoped state.

This means crashed tabs are cleaned up just like cleanly closed ones — you don't need a `pagehide` listener for correctness.

## API

### `SharedServicesManager`

```ts
new SharedServicesManager<TServices>({
  services: SharedServiceMap<TServices>,
  heartbeat?: Heartbeat,
  logger?: LoggerConfig,
})
```

Hub-side registry. Expose `manager.connector` over Comlink on the SharedWorker's connect port.

### `SharedService<T>`

```ts
interface SharedService<T> {
  onConnectTab: (tabId: string) => T
  onDisconnectTab?: (tabId: string, instance: T) => void
}
```

The contract each registered service implements.

### `wrapSharedServices`

```ts
function wrapSharedServices<TServices>(
  connector: Remote<SharedServicesConnector>,
): RemoteServices<TServices>
```

Spoke-side helper that returns a typed proxy where every service method is async ([Comlink](https://www.npmjs.com/package/comlink)-wrapped).

## License

MIT
