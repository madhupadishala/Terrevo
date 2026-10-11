#!/usr/bin/env node
// R01: fail-closed path ownership check. No external packages or network access.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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
// NUL-delimited git output preserves tabs, newlines and quoted names verbatim.
export function parseNameStatusZ(text) {
  if (!text) return [];
  const fields = text.split('\0');
  if (fields.pop() !== '') throw new Error('Unterminated git diff output');
  const paths = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (!/^[ACDMRTUXB][0-9]*$/.test(status)) throw new Error('Unrecognized git diff status: ' + status);
    const count = /^[RC]/.test(status) ? 2 : 1;
    for (let n = 0; n < count; n++) {
      if (!fields[i]) throw new Error('Missing git diff path');
      paths.push(fields[i++]);
    }
  }
  return paths;
}
export function ownerForBranch(branch) {
  return /^feature\/terrevo-s(09-customer-relations|11-clm-library|13-workforce-evidence|14-manager-reporting)-ui$/.test(branch)
    ? 'engineer2' : 'engineer1';
}
function main() {
  const owner = process.env.TERREVO_OWNER ?? ownerForBranch(process.env.TERREVO_HEAD_BRANCH ?? '');
  const base = process.env.TERREVO_DIFF_BASE;
  if (!base || !/^[a-zA-Z0-9._\/-]+$/.test(base) || base.startsWith('-')) {
    throw new Error('TERREVO_DIFF_BASE must be an explicit trusted git ref');
  }
  execFileSync('git', ['rev-parse', '--verify', base + '^{commit}'], {stdio:'pipe'});
  const output = execFileSync('git', ['diff', '--name-status', '-z', '--find-renames', base + '...HEAD'], {encoding:'utf8'});
  const paths = parseNameStatusZ(output);
  const violations = validateChangedPaths(paths, owner);
  if (violations.length) {
    process.stderr.write('R01 OWNERSHIP VIOLATION for ' + owner + ':\n' + violations.join('\n') + '\n');
    process.exitCode = 1;
  } else {
    console.log('R01 path ownership PASS (' + owner + '): ' + paths.length + ' paths checked');
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(); } catch (err) { console.error('R01 check failed:', err.message); process.exitCode = 1; }
}
