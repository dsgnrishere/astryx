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
pull requests. The built-in `GITHUB_TOKEN` only reads source and dispatches
`Fork checks`, with no content-writing or pull-request approval rights.

The synchronization workflow stays disabled until the credential is installed
and a maintainer enables it. Then run it manually once and inspect its pull
request and checks before relying on the daily schedule.

`fork-checks` is the required check on `main`, including administrators. It
validates the exact pull request merge. Source or dependency updates run package
builds, type checks, unit tests, and lint with repository guardrails. Changes only
to these fork automation files run the synchronization safety tests instead.
Browser, visual, accessibility audit, native Swift, and publication checks remain
separate; passing this gate is not visual acceptance or a product release.

Inherited CI, lint, main-validation, and review workflows remain enabled. Their
upstream service assumptions can require separate fork configuration; for
example, the inherited lint workflow expects release tags in this repository.
The separate `Main heavy lanes` scheduler is disabled to avoid automatic
preparation of original releases. Synchronization does not activate publishing
or deployment workflows. Review those separately before use.

To retry checks after editing the integration branch, run `Fork checks` from that
branch and provide its open pull request number. To refresh it from upstream,
run `Fork upstream sync` from `main`. A rejected or conflicting update never
authorizes a force-push or a merge without passing checks.
