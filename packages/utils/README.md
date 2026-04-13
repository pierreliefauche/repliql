# @repliql/utils

Small shared utilities for the repliql monorepo. Tree-shakable — each export lives in its own module and the package is marked `"sideEffects": false`, so bundlers drop whatever you don't import.

## Install

```bash
bun add @repliql/utils
```

## Exports

### `stableStringify(value)`

Deterministic `JSON.stringify` — object keys are emitted in a stable order, so equal values always produce equal strings. Useful for hashing, caching, and set/map keys where structural equality matters.

Re-exports the default export of [`@solana/fast-stable-stringify`](https://www.npmjs.com/package/@solana/fast-stable-stringify).

```ts
import { stableStringify } from '@repliql/utils'

stableStringify({ b: 1, a: 2 }) // => '{"a":2,"b":1}'
stableStringify({ a: 2, b: 1 }) // => '{"a":2,"b":1}'
```

## Scripts

- `bun run build` — ESM + CJS bundles and type declarations into `dist/`
- `bun run test` — run test files under `src/`
- `bun run fmt` / `bun run lint` — format / lint `src/`
