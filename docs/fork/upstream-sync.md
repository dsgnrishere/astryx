# Fork upstream synchronization

This fork tracks `meta/astryx` without replacing its own changes.

- `main` owns the fork's maintained changes.
- `upstream/main` follows the original `main` with fast-forward updates only.
- `sync/upstream-main` merges the fork's `main`, the upstream tip, and any
  existing integration changes. No branch is force-pushed.
- One open pull request proposes that integration into `main`. It is never
  merged automatically. Use a merge commit to retain upstream ancestry.

`Fork upstream sync` runs daily at 05:17 UTC (08:17 Europe/Moscow), or manually
from the Actions page. GitHub schedules can be delayed and can be disabled after
60 days without activity in a public repository. The workflow reports a conflict
or rewritten upstream history as a failure; it does not choose a resolution.

The sync job requires the repository secret `UPSTREAM_SYNC_TOKEN`: a
fine-grained token limited to `dsgnrishere/astryx`, with Contents, Workflows,
and Pull requests set to read and write. Set an expiration and rotate it before
expiry. Add it directly under repository Settings > Secrets and variables >
Actions; never put the value in a pull request, chat, or source file.

The built-in token cannot transfer upstream changes to workflow files. The
repository-wide setting that lets Actions create and approve pull requests is
not needed and stays off. The scoped credential pushes branches and opens
pull requests, which trigger the normal pull-request checks. The sync job gives
its built-in `GITHUB_TOKEN` no permissions. Read-only check jobs receive no sync
credential. Manual diagnostic runs have a separate concurrency group, so they
cannot cancel the pull-request check required by branch protection.

The synchronization workflow stays disabled until the credential is installed
and a maintainer enables it. Then run it manually once and inspect its pull
request and checks before relying on the daily schedule.

`fork-checks` validates the exact pull-request merge and runs dependency-free
synchronization safety proofs. The original `test`, `build`, `docsite-test`,
and `lint` checks remain the single owners of source validation. All five
contexts are required on `main`, including administrators. The fork workflow
does not duplicate the original package builds, type checks or test suites.
Browser, visual, accessibility audit, native Swift, and publication checks remain
separate; passing this gate is not visual acceptance or a product release.

Inherited CI, lint, main-validation, and review workflows remain enabled.
Repository variables `ENGOWNERS` and `DESIGNOWNERS` identify `dsgnrishere`,
the existing maintainer. Until this fork has releases of its own, lint uses
the original repository's latest stable release as its API baseline.

For the dedicated upstream PR, lint reproduces the automatic merge of the fork
base and the verified upstream ancestor. The existing Changeset validator then
checks any fork-authored delta against that tree. Previously released vendor
changes do not need invented fork release notes; new fork source changes still
need their own Changeset. Missing ancestry or merge conflicts fail the check.

When GitHub truncates a large upstream PR's file list, review reads the complete
Git diff from immutable commits in a temporary bare clone. It verifies the file
count, preserves rename paths, and executes no PR-controlled code. The helper
comes from the trusted workflow commit. Other PRs keep the original API path.

Dependency-free safety proofs use `*.node-test.mjs` and run explicitly with
Node in the fork workflows. They do not enter the separate Vitest suite.
The separate `Main heavy lanes` scheduler is disabled to avoid automatic
preparation of original releases. Synchronization does not activate publishing
or deployment workflows. Review those separately before use.

To retry a failed pull-request check, use Re-run all jobs on that pull request's
`Fork checks` run. A manual workflow dispatch is diagnostic and does not replace
a failed check on the pull-request merge commit. To refresh the integration
from upstream, run `Fork upstream sync` from `main`. A rejected or conflicting
update never authorizes a force-push or a merge without passing checks.

The public fork has no Meta-specific `4-core-ubuntu` pool. Its planned release
specs use standard `ubuntu-latest` and fail unless at least four CPUs are
available. The same specs, one-worker execution, timing thresholds and timing
gate remain enabled. The original repository retains its dedicated pool.
