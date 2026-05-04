# @repliql/shared-exchange

> Share a single [URQL](https://urql.dev) exchange between multiple tabs or processes.

`@repliql/shared-exchange` lets you run one URQL exchange (cache, auth, logging, normalized cache, …) inside a SharedWorker or main process and have multiple URQL clients across tabs/renderers consume it as if it were a local exchange. Operations from all spokes are deduplicated, teardowns are reference-counted, and results are routed back to the originating spoke first.

## Install

```bash
npm install @repliql/shared-exchange @repliql/shared-service @urql/core comlink wonka
# or
bun add @repliql/shared-exchange @repliql/shared-service @urql/core comlink wonka
```

Peer dependencies: [`@urql/core`](https://www.npmjs.com/package/@urql/core) (≥ 5), [`comlink`](https://www.npmjs.com/package/comlink) (≥ 4), [`wonka`](https://www.npmjs.com/package/wonka) (≥ 6). Transport is built on [`@repliql/shared-service`](https://www.npmjs.com/package/@repliql/shared-service), so install it alongside.

## Why

- **Unified cache** — one cache instance shared across every tab.
- **Subscription deduplication** — N spokes asking for the same subscription create one upstream subscription.
- **Reference-counted teardowns** — operations only tear down when every spoke has unsubscribed.
- **Origin-first delivery** — results are forwarded to the originating spoke first.
- **Drop-in** — works with any URQL exchange. No changes to your existing exchanges.

## Architecture

Hub-and-spoke over [Comlink](https://www.npmjs.com/package/comlink) message ports.

- **Hub** — a single SharedWorker (browser) or main process (Electron). Hosts the real `Exchange` inside `SharedExchangeService`.
- **Spokes** — each tab / renderer's URQL client. Uses `proxySharedExchange` to forward operations to the hub.

The hub can also delegate the network leg back down to a chosen spoke — useful when the hub itself can't `fetch` (e.g. behind cookie-bound auth that lives in a tab).

## Browser usage (SharedWorker)

`SharedExchangeService` plugs into [`@repliql/shared-service`](https://www.npmjs.com/package/@repliql/shared-service)'s `SharedServicesManager`. You register it under a name (e.g. `sharedExchange`), expose the manager's `connector` over Comlink to connecting tabs, and grab a typed proxy on the tab side.

### shared.worker.ts — the hub

```ts
import { SharedExchangeService, type SharedExchange } from '@repliql/shared-exchange/shared'
import { SharedServicesManager } from '@repliql/shared-service/shared'
import { cacheExchange } from '@urql/exchange-graphcache'
import { expose } from 'comlink'

const sharedServices = new SharedServicesManager<{ sharedExchange: SharedExchange }>({
  services: {
    sharedExchange: new SharedExchangeService({
      exchange: cacheExchange({}),
    }),
  },
})

self.onconnect = e => expose(sharedServices.connector, e.ports[0])
```

You can register more services on the same manager — for example a Kysely driver bridge — and they'll all share the same SharedWorker connection.

### main.ts — a spoke (your app)

```ts
import { proxySharedExchange, type SharedExchange } from '@repliql/shared-exchange/tab'
import {
  wrapSharedServices,
  type SharedServicesConnector,
} from '@repliql/shared-service/tab'
import { Client, fetchExchange } from '@urql/core'
import { wrap } from 'comlink'

const worker = new SharedWorker(new URL('./shared.worker.ts', import.meta.url), {
  type: 'module',
})

const connector = wrap<SharedServicesConnector>(worker.port)
const { sharedExchange } = wrapSharedServices<{ sharedExchange: SharedExchange }>(connector)

const client = new Client({
  url: '/graphql',
  exchanges: [proxySharedExchange({ sharedExchange }), fetchExchange],
})
```

`sharedExchange` here is the `Remote<SharedExchange>` proxy resolved by `wrapSharedServices` — pass it directly to `proxySharedExchange`.

## Electron usage (main process)

The hub can run in the Electron main process; renderers connect with a `MessagePort` transferred via IPC. The wiring on either side is the same as the SharedWorker case above — substitute the port acquisition for whichever IPC channel you use.

## Hot-swappable exchange

`SharedExchangeService#exchange` is assignable, so you can swap the wrapped exchange at runtime — for example, to reset the cache from any tab on logout. Custom methods can be exposed on a subclass and reached from spokes by adding the subclass type to the `wrapSharedServices` generic.

## Behavior guarantees

- Can be inserted anywhere in the spoke's exchange chain.
- Teardown is broadcast only when **all** subscribed spokes have torn down.
- Operations are forwarded to the **origin spoke first** — results return locally before being multicast.
- Subscriptions are **deduplicated** across spokes.
- Spokes can run identical exchanges locally for non-shared traffic; the proxy only intercepts what it needs to.

## API

### `SharedExchangeService`

```ts
class SharedExchangeService implements SharedService<SharedExchange> {
  exchange: Exchange  // assignable for hot-swap
  constructor(config: { exchange: Exchange })
}
```

Hub-side wrapper. Register it as a service on a [`SharedServicesManager`](https://www.npmjs.com/package/@repliql/shared-service) under whatever name you want (e.g. `sharedExchange`).

### `proxySharedExchange`

```ts
function proxySharedExchange(config: {
  sharedExchange: Remote<SharedExchange>
}): Exchange
```

Spoke-side URQL exchange. Obtain `sharedExchange` from `wrapSharedServices` (in [`@repliql/shared-service/tab`](https://www.npmjs.com/package/@repliql/shared-service)), then pass it here.

## License

MIT
