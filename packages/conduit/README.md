# @repliql/conduit

> SharedWorker, with dedicated Worker powers

`@repliql/conduit` enables architecture where tabs share a SharedWorker and spin up dedicated Workers, with SharedWorker accessing dedicated workers through election.
It is useful to give a SharedWorker capabilities of dedicated Workers, with automatic leader election.

Main application is to access OPFS from dedicated Worker transparently from SharedWorker.

## Installation

```bash
npm install @repliql/conduit
```

## How It Works

[Comlink](https://www.npmjs.com/package/comlink) is used for inter-process communication.
Leader election and tab close detection is done with [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

To access the dedicated worker capabilities, the shared worker communicates through the elected tab. Only one tab/dedicated worker is elected leader at any given time.

## Example

**types.d.ts** - Define types of shared interfaces

```ts
export interface Computations {
  square: (v: number) => number
  abs: (v: number) => number
}

export interface Service {
  increment: (v: number) => void
  getSquare: () => number
  getAbs: () => number
}
```

**worker.ts** - The dedicated worker

```ts
import { conduit } from '@repliql/conduit/dedicated'
import * as Comlink from 'comlink'

import type { Computations } from './types.d.ts'

const computations: Computations = {
  square(value: number) {
    return value * value
  },
  abs(value: number) {
    return Math.abs(value)
  },
}

conduit({
  onElectedLeader(port) {
    Comlink.expose(computations, port)
  },
})
```

**shared-worker.ts** - The shared worker

```ts
import { conduit } from '@repliql/conduit/shared'
import * as Comlink from 'comlink'

import type { Computations, Service } from './types.d.ts'

const { wrapDedicatedWorker, onConnectTab, events } = conduit()

events
  .on('leaderElected', ({ leaderId }) => {
    console.log('New leader elected:', leaderId)
  })
  .on('leaderResigned', ({ leaderId }) => {
    console.log('Leader resigned:', leaderId)
  })

const computations = wrapDedicatedWorker<Computations>()

let i = 0

const service: Service = {
  increment(offset: number) {
    i += offset
  },
  async getSquare() {
    return await computations.square(i)
  },
  async getAbs() {
    return await computations.abs(i)
  },
}

// Use instead of `self.onconnect = ...`
onConnectTab(port => {
  Comlink.expose(service, port)
})
```

**tab.ts** - The web app

```ts
import { conduit } from '@repliql/conduit/tab'
import * as Comlink from 'comlink'

import type { Service } from './types.d.ts'

const { sharedWorker } = conduit({
  loadWorker: () => new Worker('worker.ts'),
  loadSharedWorker: () => new SharedWorker('shared-worker.ts'),
})

const service = Comlink.wrap<Service>(sharedWorker.port)

Promise.resolve().then(async () => {
  await service.increment(6)
  console.log(await service.getSquare()) // prints "36"
  await service.increment(-10)
  console.log(await service.getAbs()) // prints "4"
})
```
