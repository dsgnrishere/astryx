import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const upstreamRepository = 'meta/astryx';
export const mirrorBranch = 'upstream/main';
export const updateBranch = 'sync/upstream-main';

export function git(args, cwd = process.cwd()) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function isAncestor(base, head, cwd = process.cwd()) {
  try {
    git(['merge-base', '--is-ancestor', base, head], cwd);
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

export function mergeCandidate({
  base,
  upstream,
  previous,
  cwd = process.cwd(),
}) {
  git(['checkout', '--detach', previous || base], cwd);
  try {
    git(['merge', '--no-edit', base], cwd);
    git(['merge', '--no-edit', upstream], cwd);
  } catch (error) {
    try {
      git(['merge', '--abort'], cwd);
    } catch {}
    throw new Error(
      'Upstream integration conflicts. No integration branch was pushed.',
      {
        cause: error,
      },
    );
  }
  const sha = git(['rev-parse', 'HEAD'], cwd);
  for (const ancestor of [base, upstream, previous].filter(Boolean)) {
    if (!isAncestor(ancestor, sha, cwd)) {
      throw new Error(`Candidate lost history: ${ancestor}`);
    }
  }
  return sha;
}

export function isConfigurationOnly(paths) {
  return (
    paths.length > 0 &&
    paths.every(
      path =>
        path === '.github/workflows/fork-upstream-sync.yml' ||
        path === '.github/workflows/fork-checks.yml' ||
        path === '.github/scripts/fork-upstream-sync.mjs' ||
        path === '.github/scripts/fork-upstream-sync.test.mjs' ||
        path.startsWith('docs/fork/'),
    )
  );
}

function gh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function remoteBranch(branch) {
  return (
    git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]).split(
      /\s/,
    )[0] || null
  );
}

export function sync() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== 'dsgnrishere/astryx')
    throw new Error('This workflow only updates dsgnrishere/astryx.');
  git(['config', 'user.name', 'github-actions[bot]']);
  git([
    'config',
    'user.email',
    '41898282+github-actions[bot]@users.noreply.github.com',
  ]);
  git(['fetch', '--no-tags', 'origin', 'main']);
  const base = git(['rev-parse', 'FETCH_HEAD']);
  git([
    'fetch',
    '--no-tags',
    `https://github.com/${upstreamRepository}.git`,
    'main',
  ]);
  const upstream = git(['rev-parse', 'FETCH_HEAD']);
  const mirror = remoteBranch(mirrorBranch);
  if (mirror) {
    git(['fetch', '--no-tags', 'origin', mirrorBranch]);
    if (!isAncestor(mirror, upstream))
      throw new Error(
        'Upstream history changed. Refusing to rewrite the mirror.',
      );
  }
  git(['push', 'origin', `${upstream}:refs/heads/${mirrorBranch}`]);
  if (isAncestor(upstream, base)) {
    console.log('main already contains upstream/main.');
    return {upstream, base, changed: false};
  }
  const previous = remoteBranch(updateBranch);
  if (previous) git(['fetch', '--no-tags', 'origin', updateBranch]);
  const candidate = mergeCandidate({base, upstream, previous});
  git(['push', 'origin', `${candidate}:refs/heads/${updateBranch}`]);
  const prs = JSON.parse(
    gh([
      'api',
      `repos/${repository}/pulls?state=open&base=main&head=dsgnrishere:${updateBranch}`,
    ]),
  );
  const body = [
    '## Maintainer impact',
    'Integrate upstream changes while retaining the fork history.',
    '',
    '## Change',
    `Upstream: https://github.com/${upstreamRepository}/commit/${upstream}`,
    `Fork base: ${base}`,
    `Candidate: ${candidate}`,
    '',
    'No automatic merge. Required fork checks validate the candidate before merging.',
    'Resolve conflicts explicitly. Do not squash, rebase, or force-push this branch.',
    'This pull request does not publish packages or update consuming applications.',
    '',
    '## Evidence',
    'The candidate contains the fork base, upstream tip, and previous integration tip as ancestors.',
    'Package validation is dispatched explicitly; its workflow run is linked on this pull request.',
  ].join('\n');
  const fields = [
    '-f',
    'title=chore: integrate upstream main',
    '-f',
    `body=${body}`,
  ];
  const pr = JSON.parse(
    prs.length
      ? gh([
          'api',
          '--method',
          'PATCH',
          `repos/${repository}/pulls/${prs[0].number}`,
          ...fields,
        ])
      : gh([
          'api',
          '--method',
          'POST',
          `repos/${repository}/pulls`,
          ...fields,
          '-f',
          `head=${updateBranch}`,
          '-f',
          'base=main',
        ]),
  );
  gh([
    'api',
    '--method',
    'POST',
    `repos/${repository}/actions/workflows/fork-checks.yml/dispatches`,
    '-f',
    `ref=${updateBranch}`,
    '-f',
    `inputs[pr_number]=${pr.number}`,
  ]);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Upstream: ${upstream}\n\nReview: ${pr.html_url}\n\nChecks dispatched for ${candidate}. No automatic merge.\n`,
    );
  }
  console.log(
    JSON.stringify({upstream, base, candidate, pullRequest: pr.html_url}),
  );
  return {upstream, base, candidate, changed: true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  sync();
