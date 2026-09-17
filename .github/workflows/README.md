# GitHub Actions workflows

Two workflows for the metrics dashboard.

## build-test.yml (Build and test)

Checks that a change builds and passes tests.

- When it runs: on a push to `integration` or `main`, on a pull request into `integration`, and on demand from the Actions tab.
- What it does: installs dependencies (`npm ci`), builds the app (`npm run build`), and runs the unit tests (`npm test`), on Node 20.
- Use it to confirm `integration` is healthy before a release.

## release.yml (Release)

Cuts a component release by hand. You start it from the Actions tab (or with `gh workflow run`); it never runs on its own.

Inputs:

- `version`: the base version, for example `1.0.0`.
- `kind`: `rc` for a release candidate, or `final` for a full release.

What it does, in order:

1. Builds and tests the app (built with base href `/metrics-dashboard/`).
2. Merges `integration` into `main`.
3. Works out the tag. For `rc` it picks the next free `1.0.0rc1`, `1.0.0rc2`, and so on. For `final` it uses `1.0.0`.
4. Creates the tag and pushes it.
5. Publishes a GitHub Release with the built app attached as a zip. A release candidate is marked as a pre-release.

Run it from the command line:

```bash
gh workflow run release.yml -f version=1.0.0 -f kind=rc
```

### Release notes

The release body comes from a markdown file you write: `docs/release-notes/<version>.md` (for example `docs/release-notes/1.0.0.md`). All release candidates and the final release for a version use the same file, so you refine one file across the RC rounds. Whatever you put there is what shows on the release page, and a `Released-by` line is added at the end.

If that file is missing, the workflow falls back to the auto-generated notes so the release still publishes.
