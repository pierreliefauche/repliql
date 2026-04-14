import type { Source } from 'wonka'

import type { HashValue } from './hash'

export class SourceMap<O, Key extends HashValue | string = HashValue> {
  private sourcesByKey = new Map<Key, WeakRef<Source<O>>>()

  public get(key: Key) {
    return this.sourcesByKey.get(key)?.deref()
  }

  public getOrCreate(key: Key, createSource: () => Source<O>) {
    let source = this.get(key)

    if (!source) {
      source = createSource()
      this.sourcesByKey.set(key, new WeakRef(source))
    }

    return source
  }
}
