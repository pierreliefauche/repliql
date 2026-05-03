# @repliql/shared-service

## Installation

```bash
npm install @repliql/shared-service
```

## Setup

**MyCalculator.ts**

```ts
type MyCalculator = {
  square: (n: number) => number
}
```

**shared.worker.ts**

```ts
import { SharedServicesManager, type SharedService } from '@repliql/shared-service/shared'
import * as Comlink from 'comlink'

const calculator = {
  onConnectTab(tabId): MyCalculator {
    return {
      square(n) {
        return n * n
      },
    }
  },
  onDisconnectTab(tabId) {
    ...
  }
}

const sharedServiceManager = new SharedServicesManager<{ calculator: MyCalculator }>({
  services: {
    calculator
  }
})

onconnect = e => Comlink.expose(sharedServiceManager.connector, e.ports[0])
```

**tab.ts**

```ts
import { wrapSharedServices, type SharedServicesConnector } from '@repliql/shared-service/tab'
import * as Comlink from 'comlink'

const sharedWorker = new SharedWorker('shared.worker.ts')

const sharedServicesConnector = Comlink.wrap<SharedServicesConnector>(sharedWorker.port)

const { calculator } = wrapSharedServices<{ calculator: MyCalculator }>(sharedServicesConnector)

calculator.square(2).then(console.log) // Prints "4"
```
