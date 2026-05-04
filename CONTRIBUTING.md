# Contributing

## Releasing

Versioning and publishing are driven by [Changesets](https://github.com/changesets/changesets). Releases happen from CI via npm [Trusted Publishers](https://docs.npmjs.com/trusted-publishers) — no long-lived tokens.

### Authoring a change

1. Make your code change on a branch.
2. Run `bun run changeset` and follow the prompts to pick the affected packages and the semver bump.
3. Commit the generated `.changeset/*.md` file alongside your code and open a PR.

### Cutting a release

1. When PRs containing changesets land on `main`, the [Release workflow](.github/workflows/release.yml) opens (or updates) a "Version Packages" PR that bumps versions and writes CHANGELOGs.
2. Merging that PR triggers the publish step, which for each changed package runs `bun pm pack` then `bunx npm publish <tgz> --access public --provenance`.
3. Already-published `name@version` pairs are skipped, so re-runs are safe.

### Initial setup per package

- Configure a Trusted Publisher on npmjs.com pointing at this repo and the `release.yml` workflow.
- Trusted Publishers can only be added to packages that already exist on npm, so the very first publish of a new package name needs a one-time `npm publish` from a local machine (or a temporary granular `NPM_TOKEN`).
