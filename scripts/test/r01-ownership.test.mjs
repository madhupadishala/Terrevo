import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChangedPaths, parseNameStatus, parseNameStatusZ, ownerForBranch, validateAssignment } from '../r01-ownership.mjs';
test('engineer 1 cannot modify delegated files', () => {
 assert.deepEqual(validateChangedPaths(['apps/api/src/handler.ts','apps/web/src/features/clm-library/model.ts'],'engineer1'),['apps/web/src/features/clm-library/model.ts']);
});
test('NUL-delimited paths preserve special characters and check both rename sides', () => {
 const delegated='apps/web/src/features/clm-library/line\nwith\ttab.ts';
 const paths=parseNameStatusZ('R100\0apps/api/old.ts\0'+delegated+'\0');
 assert.deepEqual(paths,['apps/api/old.ts',delegated]);
 assert.deepEqual(validateChangedPaths(paths,'engineer1'),[delegated]);
 for(const bad of ['M\0','R100\0old\0','M\0path','INVALID\0path\0'])assert.throws(()=>parseNameStatusZ(bad));
 assert.deepEqual(parseNameStatusZ(''),[]);
});
test('only the four exact delegated branches select Engineer 2 ownership', () => {
 for(const name of ['09-customer-relations','11-clm-library','13-workforce-evidence','14-manager-reporting'])
  assert.equal(ownerForBranch('feature/terrevo-s'+name+'-ui','engineer2'),'engineer2');
 for(const branch of ['chore/r01-repository-consolidation','feature/ui-live-role-workspaces'])
  assert.equal(ownerForBranch(branch,'engineer1'),'engineer1');
 assert.throws(()=>ownerForBranch('feature/terrevo-s09-customer-relations-ui-extra','engineer1'),/Unregistered/);
 assert.throws(()=>ownerForBranch('chore/r01-repository-consolidation'),/assignment mismatch/);
 assert.throws(()=>ownerForBranch('chore/r01-repository-consolidation','engineer2'),/assignment mismatch/);
 assert.throws(()=>ownerForBranch('feature/terrevo-s09-customer-relations-ui','engineer1'),/assignment mismatch/);
});
test('assignment requires the designated actor and same repository', () => {
 const assignment={author:'owner',assignedAuthor:'owner',repository:'owner/repo',headRepository:'owner/repo'};
 assert.doesNotThrow(()=>validateAssignment(assignment));
 for(const field of Object.keys(assignment))assert.throws(()=>validateAssignment({...assignment,[field]:undefined}),/untrusted/);
 assert.throws(()=>validateAssignment({...assignment,author:'other'}),/untrusted/);
 assert.throws(()=>validateAssignment({...assignment,headRepository:'other/repo'}),/untrusted/);
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

test('integration mandate is limited to one exact branch and recorded file paths',()=>{
 assert.equal(ownerForBranch('feature/terrevo-v32-reference-integration','integrator'),'integrator');
 assert.throws(()=>ownerForBranch('feature/terrevo-v32-reference-integration-copy','integrator'),/Unregistered/);
 assert.throws(()=>ownerForBranch('feature/terrevo-v32-reference-integration','engineer1'),/mismatch/);
 assert.deepEqual(validateChangedPaths(['apps/api/src/handler.ts','apps/web/src/features/clm-library/model.ts'],'integrator'),[]);
 assert.deepEqual(validateChangedPaths(['AGENTS.md','vercel.json','../secret','apps/api/src/unassigned.ts'],'integrator'),['AGENTS.md','vercel.json','../secret','apps/api/src/unassigned.ts']);
});
