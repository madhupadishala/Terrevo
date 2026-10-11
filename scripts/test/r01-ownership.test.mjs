import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChangedPaths, parseNameStatus } from '../r01-ownership.mjs';
test('engineer 1 cannot modify delegated files', () => {
 assert.deepEqual(validateChangedPaths(['apps/api/src/handler.ts','apps/web/src/features/clm-library/model.ts'],'engineer1'),['apps/web/src/features/clm-library/model.ts']);
});
test('engineer 2 cannot modify core or another shared feature', () => {
 assert.deepEqual(validateChangedPaths(['apps/web/src/features/clm-library/model.ts','apps/api/src/handler.ts','apps/web/src/App.tsx'],'engineer2'),['apps/api/src/handler.ts','apps/web/src/App.tsx']);
});
test('renames check both old and new paths', () => {
 assert.deepEqual(parseNameStatus('R100\tapps/api/a.ts\tapps/web/src/features/clm-library/a.ts\n'),['apps/api/a.ts','apps/web/src/features/clm-library/a.ts']);
});
test('reject invalid file paths and status', () => {
 assert.deepEqual(validateChangedPaths(['../other/repo','/etc/passwd'],'engineer1'),['../other/repo','/etc/passwd']);
 assert.throws(()=>parseNameStatus('UNKNOWN\ta'),/Unrecognized/);
});
