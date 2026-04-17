# React + TypeScript + shadcn/ui

## Adding components

To add components to your app, run the following command:

```bash
bunx shadcn@latest add button
```

This will place the ui components in the `src/components/ui` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from '@/components/ui/button'
```

## GraphQL schema

The full Linear SDL dump lives at [src/graphql/schema.graphql](src/graphql/schema.graphql) (~10k lines). It is far too large to ship to the client, so [scripts/build-schema-subset.ts](scripts/build-schema-subset.ts) walks every `gql\`...\`` block in [src/graphql/queries.ts](src/graphql/queries.ts) and emits [src/graphql/schema.subset.graphql](src/graphql/schema.subset.graphql), keeping only the types and fields the queries actually use. [src/graphql/schema.ts](src/graphql/schema.ts) imports that subset via `?raw` and calls `buildSchema`.

Regenerate the subset after changing queries:

```bash
bun run scripts/build-schema-subset.ts
```

