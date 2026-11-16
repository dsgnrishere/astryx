import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {
  evaluateChange,
  gitTree,
} from '../../scripts/release/changeset-coverage.mjs';
import {git, isAncestor} from './fork-upstream-sync.mjs';

const require = createRequire(import.meta.url);
const {parseNameStatus} = require('./change-scope.cjs');

export function checkForkCoverage({
  cwd = process.cwd(),
  base,
  upstream,
  head,
  released,
}) {
  const baseSha = git(['rev-parse', `${base}^{commit}`], cwd);
  const upstreamSha = git(['rev-parse', `${upstream}^{commit}`], cwd);
  const headSha = git(['rev-parse', `${head}^{commit}`], cwd);
  if (
    !isAncestor(baseSha, headSha, cwd) ||
    !isAncestor(upstreamSha, headSha, cwd)
  ) {
    throw new Error('Candidate must retain both fork and upstream history');
  }
  const expectedTree = git(
    ['merge-tree', '--write-tree', baseSha, upstreamSha],
    cwd,
  );
  if (!/^[0-9a-f]{40}$/.test(expectedTree))
    throw new Error('Could not establish the automatic merge baseline');
  const changes = parseNameStatus(
    git(
      ['diff', '--name-status', '--find-renames', expectedTree, headSha],
      cwd,
    ),
  );
  const result = evaluateChange({
    changes,
    base: gitTree(cwd, expectedTree),
    head: gitTree(cwd, headSha),
    released: gitTree(cwd, released),
  });
  return {
    ...result,
    base: baseSha,
    upstream: upstreamSha,
    head: headSha,
    expectedTree,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [base, upstream, head, released] = process.argv.slice(2);
  const result = checkForkCoverage({base, upstream, head, released});
  if (result.problems.length) {
    console.error(result.problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Fork changeset coverage PASS against verified merge of ${result.base} and ${result.upstream}; released API baseline ${released}`,
    );
  }
}
