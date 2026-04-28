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

## Setup

**types.d.ts** - Define types for

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
import { exposeToSharedWorker } from '@repliql/conduit/dedicated'

import type { Computations } from './types.d.ts'

const computations: Computations = {
  initialize() {
    console.log('Initializing dedicated tab...')
  },
  square(value: number) {
    return value * value
  }
  abs(value: number) {
    return Math.abs(value)
  }
}

exposeToSharedWorker(computations)
```

**shared-worker.ts** - The shared worker

```ts
import { consumeFromDedicatedWorker, exposeToTab } from '@repliql/conduit/shared'

import type { Computations, Service } from './types.d.ts'

const computations = consumeFromDedicatedWorker<Computations>({
  onLeaderElected() {
    console.log('New leader elected!')
    computations.initialize()
  },
  onLeaderResigned() {
    console.log('Leader resigned, waiting for new leader')
  },
})

let i = 0

const service: Service = {
  add(offset: number) {
    i += offset
  },
  getSquare() {
    return await computations.square(i)
  },
  getAbs() {
    return await computations.abs(i)
  },
}

exposeToTab(service)
```

**tab.ts** - The web app

```ts
import { createConduit } from '@repliql/conduit/tab'

import type { Service } from './types.d.ts'

const { consumeFromSharedWorker } = createConduit({
  dedicated: new Worker('worker.ts'),
  shared: new SharedWorker('shared-worker.ts'),
})

const service = consumeFromSharedWorker<Service>()

Promise.resolve().then(async () => {
  await service.increment(6)
  console.log(await service.getSquare()) // prints "36"
  await service.increment(-10)
  console.log(await service.getAbs()) // prints "4"
})
```
