# Shared Exchange

Share a single URQL exchange between multiple tabs/processes.

In browsers, the shared exchange runs in a Shared Worker, used by multiple URQL clients in tabs.
On Electron, the shared exchange runs on main process, used by multiple URQL clients in renderer processes.

This allows to share a cache or other exchanges between tabs/processes, and/or to offload processing to a secondary thread.

It follows the hub & spoke architecture where spokes (tabs/renderer processes) are portals to a hub (shared worker/main process).

Uses [Comlink](https://www.npmjs.com/package/comlink) for inter-process communication.

## Rules of shared exchanges

- Can be added anywhere in the exchange chain
- Keeps track of operations per spoke and only applies teardown when all spokes using the operation have sent teardowns.
- Operations are forwarded to their origin spoke in priority
- Subscriptions are de-duplicated (2 spokes requesting the same subscription will not trigger 2 subscriptions down the chain)

## Usage

### Browsers

**main.js**

```ts
import { createClient } from 'urql'
import { proxySharedExchange } from '@repliql/shared-exchange'

const worker = new SharedWorker('worker.js')

const sharedExchange = proxySharedExchange({
  endpoint: worker.port,
})

const urqlClient = createClient({
    url: '...',
    exchanges: [
      ...,
      sharedExchange,
      ...,
    ],
  })

```

**worker.js**

```ts
import { cacheExchange } from '@urql/exchange-graphcache'
import { exposeSharedExchange } from '@repliql/shared-exchange'

const sharedExchange = cacheExchange({})

exposeSharedExchange(sharedExchange)
```
