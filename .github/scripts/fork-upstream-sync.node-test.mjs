import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {git, isAncestor, mergeCandidate} from './fork-upstream-sync.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'fork-sync-test-'));
  t.after(() => rmSync(cwd, {recursive: true, force: true}));
  const g = (...args) => git(args, cwd);
  g('init', '-b', 'main');
  g('config', 'user.name', 'Test');
  g('config', 'user.email', 'test@example.com');
  const commit = (path, content) => {
    writeFileSync(join(cwd, path), content);
    g('add', path);
    g('commit', '-m', `Update ${path}`);
    return g('rev-parse', 'HEAD');
  };
  commit('shared.txt', 'baseline\n');
  g('branch', 'upstream');
  return {cwd, g, commit};
}

test('merges upstream and preserves fork changes and both histories', t => {
  const {cwd, g, commit} = fixture(t);
  const base = commit('fork.txt', 'fork customization\n');
  g('checkout', 'upstream');
  const upstream = commit('upstream.txt', 'upstream update\n');
  const candidate = mergeCandidate({base, upstream, cwd});
  assert.ok(isAncestor(base, candidate, cwd));
  assert.ok(isAncestor(upstream, candidate, cwd));
  assert.equal(g('show', `${candidate}:fork.txt`), 'fork customization');
  assert.equal(g('show', `${candidate}:upstream.txt`), 'upstream update');
  assert.equal(
    mergeCandidate({base, upstream, previous: candidate, cwd}),
    candidate,
  );
});

test('preserves edits on an existing integration branch and newer main', t => {
  const {cwd, g, commit} = fixture(t);
  const base = commit('fork.txt', 'first customization\n');
  g('checkout', 'upstream');
  const upstream = commit('upstream.txt', 'first update\n');
  mergeCandidate({base, upstream, cwd});
  const previous = commit('review-fix.txt', 'review correction\n');
  g('checkout', 'main');
  const newerBase = commit('new-fork.txt', 'new customization\n');
  const candidate = mergeCandidate({base: newerBase, upstream, previous, cwd});
  assert.ok(isAncestor(previous, candidate, cwd));
  assert.ok(isAncestor(newerBase, candidate, cwd));
  assert.equal(g('show', `${candidate}:review-fix.txt`), 'review correction');
});

test('conflicts leave the original branch tips and a clean worktree', t => {
  const {cwd, g, commit} = fixture(t);
  const base = commit('shared.txt', 'fork choice\n');
  g('checkout', 'upstream');
  const upstream = commit('shared.txt', 'upstream choice\n');
  assert.throws(() => mergeCandidate({base, upstream, cwd}), /conflicts/);
  assert.equal(g('rev-parse', 'main'), base);
  assert.equal(g('rev-parse', 'upstream'), upstream);
  assert.equal(g('status', '--porcelain'), '');
});
