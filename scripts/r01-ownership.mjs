#!/usr/bin/env node
// R01: fail-closed path ownership check. No external packages or network access.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const engine2Paths = [
  /^apps\/web\/src\/features\/(customer-relations|clm-library|workforce-evidence|manager-reporting)\//,
  /^apps\/web\/test\/(customer-relations|clm-library|workforce-evidence|manager-reporting)[^/]*\.test\.ts$/
];
export function validateChangedPaths(paths, owner) {
  if (!['engineer1', 'engineer2'].includes(owner)) throw new Error('Owner must be engineer1 or engineer2');
  const violations = [];
  for (const path of paths) {
    if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\')) {
      violations.push(path); continue;
    }
    const delegated = engine2Paths.some(re => re.test(path));
    if ((owner === 'engineer1' && delegated) || (owner === 'engineer2' && !delegated)) violations.push(path);
  }
  return violations;
}
export function parseNameStatus(text) {
  const paths = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cols = line.split('\t');
    const status = cols[0];
    if (!/^[ACDMRTUXB][0-9]*$/.test(status)) throw new Error('Unrecognized git diff status: ' + status);
    if (status.startsWith('R') || status.startsWith('C')) paths.push(cols[1], cols[2]);
    else paths.push(cols[1]);
  }
  return paths;
}
function main() {
  const owner = process.env.TERREVO_OWNER ?? 'engineer1';
  const base = process.env.TERREVO_DIFF_BASE;
  if (!base || !/^[a-zA-Z0-9._\/-]+$/.test(base) || base.startsWith('-')) {
    throw new Error('TERREVO_DIFF_BASE must be an explicit trusted git ref');
  }
  execFileSync('git', ['rev-parse', '--verify', base + '^{commit}'], {stdio:'pipe'});
  const output = execFileSync('git', ['diff', '--name-status', '--find-renames', base + '...HEAD'], {encoding:'utf8'});
  const paths = parseNameStatus(output);
  const violations = validateChangedPaths(paths, owner);
  if (violations.length) {
    process.stderr.write('R01 OWNERSHIP VIOLATION for ' + owner + ':\n' + violations.join('\n') + '\n');
    process.exitCode = 1;
  } else {
    console.log('R01 path ownership PASS (' + owner + '): ' + paths.length + ' paths checked');
  }
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try { main(); } catch (err) { console.error('R01 check failed:', err.message); process.exitCode = 1; }
}
