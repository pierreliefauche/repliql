import { describe, expect, it } from 'bun:test'

import * as Comlink from 'comlink'
import { makeSubject, onEnd, pipe, subscribe, type Signal, type Source } from 'wonka'

import { exposeComlinkSource, sourceFromComlink } from './comlinkSource'

async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('comlinkSource', () => {
  it('delivers source values over a Comlink boundary', async () => {
    const subject = makeSubject<number>()
    const channel = new MessageChannel()

    Comlink.expose(exposeComlinkSource(subject.source), channel.port1)
    const remoteSource = Comlink.wrap<Source<number>>(channel.port2)

    const received: number[] = []
    const subscription = pipe(
      sourceFromComlink(remoteSource),
      subscribe(value => received.push(value)),
    )

    await flush()
    subject.next(1)
    subject.next(2)
    await flush()

    expect(received).toEqual([1, 2])

    subscription.unsubscribe()
    channel.port1.close()
    channel.port2.close()
  })

  it('stops forwarding values after downstream unsubscribe', async () => {
    const subject = makeSubject<number>()
    const channel = new MessageChannel()

    Comlink.expose(exposeComlinkSource(subject.source), channel.port1)
    const remoteSource = Comlink.wrap<Source<number>>(channel.port2)

    const received: number[] = []
    const subscription = pipe(
      sourceFromComlink(remoteSource),
      subscribe(value => received.push(value)),
    )

    await flush()
    subject.next(1)
    await flush()

    subscription.unsubscribe()
    await flush()

    subject.next(2)
    await flush()

    expect(received).toEqual([1])

    channel.port1.close()
    channel.port2.close()
  })

  it('propagates completion from the remote source', async () => {
    const subject = makeSubject<number>()
    const channel = new MessageChannel()

    Comlink.expose(exposeComlinkSource(subject.source), channel.port1)
    const remoteSource = Comlink.wrap<Source<number>>(channel.port2)

    let completed = false

    const subscription = pipe(
      sourceFromComlink(remoteSource),
      onEnd(() => {
        completed = true
      }),
      subscribe(() => {}),
    )

    await flush()
    subject.complete()
    await flush()

    expect(completed).toBe(true)

    subscription.unsubscribe()
    channel.port1.close()
    channel.port2.close()
  })

  it('forwards talkback signals so pull-based sources work remotely', async () => {
    const channel = new MessageChannel()

    let current = 0
    let closeSignals = 0

    const pullSource: Source<number> = sink => {
      let active = true

      sink({
        tag: 0,
        0: (kind: 0 | 1) => {
          if (!active) return

          if (kind === 1) {
            active = false
            closeSignals += 1
            return
          }

          sink({ tag: 1, 0: current++ } as Signal<number>)
        },
      } as Signal<number>)
    }

    Comlink.expose(exposeComlinkSource(pullSource), channel.port1)
    const remoteSource = Comlink.wrap<Source<number>>(channel.port2)

    const values: number[] = []
    const sub = pipe(
      sourceFromComlink<number>(remoteSource),
      subscribe(value => {
        values.push(value)

        if (values.length === 3) {
          sub.unsubscribe()
        }
      }),
    )

    await flush()
    await flush()

    expect(values).toEqual([0, 1, 2])
    expect(closeSignals).toBe(1)

    channel.port1.close()
    channel.port2.close()
  })
})
