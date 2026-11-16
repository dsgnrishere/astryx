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

`fork-checks` is the required check on `main`, including administrators. It
validates the exact pull request merge. Source or dependency updates run package
builds, type checks, unit tests, and lint with repository guardrails. Changes only
to these fork automation files run the synchronization safety tests instead.
Browser, visual, accessibility audit, native Swift, and publication checks remain
separate; passing this gate is not visual acceptance or a product release.

Inherited CI, lint, main-validation, and review workflows remain enabled.
Repository variables `ENGOWNERS` and `DESIGNOWNERS` identify `dsgnrishere`,
the existing maintainer. Until this fork has stable release tags of its own,
lint reads the original repository's latest stable release as its API baseline.
The compatibility and Changeset checks still run; no release is created here.
The separate `Main heavy lanes` scheduler is disabled to avoid automatic
preparation of original releases. Synchronization does not activate publishing
or deployment workflows. Review those separately before use.

To retry a failed pull-request check, use Re-run all jobs on that pull request's
`Fork checks` run. A manual workflow dispatch is diagnostic and does not replace
a failed check on the pull-request merge commit. To refresh the integration
from upstream, run `Fork upstream sync` from `main`. A rejected or conflicting
update never authorizes a force-push or a merge without passing checks.
