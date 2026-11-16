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

The sync job uses the repository's short-lived `GITHUB_TOKEN`. The repository
must permit Actions to create pull requests. It explicitly dispatches `Fork
checks` for the integration head, so automation-created pull requests do not
depend on approving an implicit pull-request workflow run.

`fork-checks` is the required check on `main`, including administrators. It
validates the exact pull request merge. Source or dependency updates run package
builds, type checks, unit tests, and lint with repository guardrails. Changes only
to these fork automation files run the synchronization safety tests instead.
Browser, visual, accessibility audit, native Swift, and publication checks remain
separate; passing this gate is not visual acceptance or a product release.

Inherited publishing, deployment, and scheduled housekeeping workflows stay
disabled in this fork. The upstream workflow source files are retained. New
upstream workflows must be reviewed before activation.

To retry checks after editing the integration branch, run `Fork checks` from that
branch and provide its open pull request number. To refresh it from upstream,
run `Fork upstream sync` from `main`. A rejected or conflicting update never
authorizes a force-push or a merge without passing checks.
