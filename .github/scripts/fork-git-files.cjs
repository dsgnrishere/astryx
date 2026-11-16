// Copyright (c) Meta Platforms, Inc. and affiliates.

const {execFileSync} = require('node:child_process');
const {mkdtempSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');

function git(cwd, args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
    },
  });
}

function parseFiles(text) {
  const parts = text.split('\0');
  if (parts.pop() !== '') throw new Error('Incomplete Git file inventory');
  const files = [];
  const statuses = {A: 'added', D: 'removed', M: 'modified', T: 'changed'};
  while (parts.length) {
    const status = parts.shift();
    const first = parts.shift();
    if (!first) throw new Error('Missing Git path');
    if (/^[RC][0-9]+$/.test(status)) {
      const second = parts.shift();
      if (!second) throw new Error('Missing rename destination');
      files.push({
        filename: second,
        previous_filename: first,
        status: status[0] === 'R' ? 'renamed' : 'copied',
      });
    } else {
      if (!statuses[status])
        throw new Error(`Unknown Git file status: ${status}`);
      files.push({filename: first, status: statuses[status]});
    }
  }
  return files;
}

function changedFilesAt({cwd, base, head, expected}) {
  if (![base, head].every(sha => /^[0-9a-f]{40}$/.test(sha)))
    throw new Error('Expected immutable Git commits');
  const mergeBase = git(cwd, ['merge-base', base, head]).trim();
  const files = parseFiles(
    git(cwd, [
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      '--no-ext-diff',
      '--no-textconv',
      mergeBase,
      head,
    ]),
  );
  if (files.length !== expected)
    throw new Error(
      `Git returned ${files.length} of ${expected} changed files`,
    );
  return files;
}

function readGitFiles({repository, base, head, expected}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new Error('Invalid repository');
  const cwd = mkdtempSync(join(tmpdir(), 'fork-pr-files-'));
  try {
    git(cwd, [
      'clone',
      '--bare',
      '--filter=blob:none',
      '--single-branch',
      '--no-tags',
      `https://github.com/${repository}.git`,
      '.',
    ]);
    git(cwd, [
      'fetch',
      '--filter=blob:none',
      '--no-tags',
      'origin',
      base,
      head,
    ]);
    return changedFilesAt({cwd, base, head, expected});
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
}

module.exports = {parseFiles, changedFilesAt, readGitFiles};
