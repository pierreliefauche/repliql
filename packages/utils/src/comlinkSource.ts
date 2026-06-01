import { proxy, type Remote } from 'comlink'
import type { Signal, Sink, Source } from 'wonka'

type TalkbackKind = 0 | 1

type StartSignal<T> = Extract<Signal<T>, { tag: 0 }>

function isStartSignal<T>(signal: Signal<T>): signal is StartSignal<T> {
  return signal !== 0 && signal.tag === 0
}

function withProxiedTalkback<T>(signal: Signal<T>): Signal<T> {
  if (!isStartSignal(signal)) return signal

  return {
    ...signal,
    0: proxy(signal[0]),
  }
}

/**
 * Marks a Wonka Source as Comlink-proxied and ensures nested talkback
 * functions in Start signals are proxied as well.
 */
export function exposeComlinkSource<T>(source: Source<T>): Source<T> {
  return proxy((sink: Sink<T>) => {
    source(signal => {
      sink(withProxiedTalkback(signal))
    })
  })
}

/**
 * Adapts a Comlink-remote Source back to a local Wonka Source.
 *
 * The only bridge logic needed is to wrap the remote talkback so downstream
 * Wonka sinks can call it like a normal function.
 */
export function sourceFromComlink<T>(remoteSource: Remote<Source<T>> | Source<T>): Source<T> {
  return sink => {
    void remoteSource(
      proxy((signal: Signal<T>) => {
        if (!isStartSignal(signal)) {
          sink(signal)
          return
        }

        const remoteTalkback = signal[0]
        sink({
          ...signal,
          0: (kind: TalkbackKind) => {
            void remoteTalkback(kind)
          },
        })
      }),
    )
  }
}
