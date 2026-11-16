// Copyright (c) Meta Platforms, Inc. and affiliates.

import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {git, mergeCandidate} from './fork-upstream-sync.mjs';
import {checkForkCoverage} from './fork-sync-coverage.mjs';

const {parseFiles, changedFilesAt} = createRequire(import.meta.url)(
  './fork-git-files.cjs',
);

test('complete inventory preserves renames, unusual paths and more than 3000 files', () => {
  const text =
    'R100\0apps/sandbox/safe.ts\0packages/core/unsafe.ts\0M\0space and\ttab.ts\0' +
    Array.from({length: 3500}, (_, i) => `A\0docs/${i}.md\0`).join('');
  const files = parseFiles(text);
  assert.equal(files.length, 3502);
  assert.deepEqual(files[0], {
    filename: 'packages/core/unsafe.ts',
    previous_filename: 'apps/sandbox/safe.ts',
    status: 'renamed',
  });
  assert.equal(files[1].filename, 'space and\ttab.ts');
  assert.throws(() => parseFiles('A\0truncated'), /Incomplete/);
});

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'fork-coverage-'));
  t.after(() => rmSync(cwd, {recursive: true, force: true}));
  const g = (...args) => git(args, cwd);
  g('init', '-b', 'main');
  g('config', 'user.name', 'Test');
  g('config', 'user.email', 'test@example.com');
  const write = (path, value) => {
    mkdirSync(dirname(join(cwd, path)), {recursive: true});
    writeFileSync(join(cwd, path), value);
  };
  const commit = () => {
    g('add', '.');
    g('commit', '-m', 'Fixture');
    return g('rev-parse', 'HEAD');
  };
  write('package.json', '{"name":"fixture","private":true}');
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  write(
    '.changeset/config.json',
    '{"fixed":[["@astryxdesign/core"]],"ignore":[]}',
  );
  write(
    'packages/core/package.json',
    '{"name":"@astryxdesign/core","version":"1.0.0","files":["src"]}',
  );
  write('packages/core/src/value.ts', 'export const value = 0;\n');
  const released = commit();
  g('branch', 'upstream');
  write('fork.md', 'retained customization');
  const base = commit();
  g('checkout', 'upstream');
  write('packages/core/src/value.ts', 'export const value = 1;\n');
  const upstream = commit();
  const head = mergeCandidate({base, upstream, cwd});
  return {cwd, g, write, commit, base, upstream, head, released};
}

test('vendor changes use the verified merge baseline; new fork source still needs a Changeset', t => {
  const f = fixture(t);
  assert.deepEqual(checkForkCoverage(f).problems, []);
  f.write('packages/core/src/value.ts', 'export const value = 2;\n');
  const changed = f.commit();
  assert.ok(
    checkForkCoverage({...f, head: changed}).problems.some(p =>
      p.includes('without a Changeset'),
    ),
  );
  f.write(
    '.changeset/fork-fix.md',
    '---\n"@astryxdesign/core": patch\n---\n\n[fix] Adjust the fork value.\n',
  );
  const covered = f.commit();
  assert.deepEqual(checkForkCoverage({...f, head: covered}).problems, []);
});

test('inventory count and missing fork ancestry fail closed', t => {
  const f = fixture(t);
  assert.throws(
    () =>
      changedFilesAt({cwd: f.cwd, base: f.base, head: f.head, expected: 999}),
    /Git returned/,
  );
  assert.throws(
    () => checkForkCoverage({...f, head: f.upstream}),
    /retain both/,
  );
});
