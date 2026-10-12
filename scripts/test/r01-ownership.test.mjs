import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChangedPaths, parseNameStatusZ, ownerForBranch, validateAssignment, loadIntegrationScope } from '../r01-ownership.mjs';
import integrationScope from '../terrevo-v32-integration-scope.json' with {type:'json'};
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
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
 for(const branch of ['chore/r01-repository-consolidation','feature/ui-live-role-workspaces','chore/terrevo-trusted-scope-policy'])
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
 assert.deepEqual(parseNameStatusZ('R100\0apps/api/a.ts\0apps/web/src/features/clm-library/a.ts\0'),['apps/api/a.ts','apps/web/src/features/clm-library/a.ts']);
});
test('reject invalid file paths and status', () => {
 assert.deepEqual(validateChangedPaths(['../other/repo','/etc/passwd'],'engineer1'),['../other/repo','/etc/passwd']);
 assert.throws(()=>parseNameStatusZ('UNKNOWN\0a\0'),/Unrecognized/);
});

test('integration mandate is limited to trusted integration branches and recorded file paths',()=>{
 assert.equal(ownerForBranch('feature/terrevo-v32-reference-integration','integrator',integrationScope),'integrator');
 assert.equal(ownerForBranch('feature/terrevo-v32-ponytail-execution','integrator',integrationScope),'integrator');
 assert.throws(()=>ownerForBranch('feature/terrevo-v32-reference-integration-copy','integrator',integrationScope),/Unregistered/);
 assert.throws(()=>ownerForBranch('feature/terrevo-v32-reference-integration','engineer1',integrationScope),/mismatch/);
 assert.deepEqual(validateChangedPaths(['apps/api/src/handler.ts','apps/web/src/features/clm-library/model.ts'],'integrator',integrationScope),[]);
 const denied=['AGENTS.md','vercel.json','../secret','apps/api/src/unassigned.ts','apps/web/src/App.tsx'];
 assert.deepEqual(validateChangedPaths(denied,'integrator',integrationScope),denied);
 assert.throws(()=>validateChangedPaths(['apps/api/src/handler.ts'],'integrator'),/Trusted integration policy/);
 for(const base of [undefined,'HEAD','main','--help'])assert.throws(()=>loadIntegrationScope(base),/full commit SHA/);
});

test('a HEAD checker and allowlist cannot authorize an out-of-scope file',()=>{
 const dir=mkdtempSync(join(tmpdir(),'terrevo-ownership-'));
 const script=readFileSync(new URL('../r01-ownership.mjs',import.meta.url),'utf8');
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
 try{
  git('init','-q');git('config','user.name','Synthetic Test');git('config','user.email','test@example.invalid');
  // Git paths mirror the real policy lookup; no reliance on PR-controlled imports.
  execFileSync(process.execPath,['-e',"require('fs').mkdirSync('scripts')"],{cwd:dir});
  const policy={branch:integrationScope.branch,allowedPaths:['scripts/r01-ownership.mjs','scripts/terrevo-v32-integration-scope.json']};
  writeFileSync(join(dir,'scripts/r01-ownership.mjs'),script);
  writeFileSync(join(dir,'scripts/terrevo-v32-integration-scope.json'),JSON.stringify(policy));
  git('add','.');git('commit','-qm','Trusted test baseline');const base=git('rev-parse','HEAD');
  writeFileSync(join(dir,'scripts/terrevo-v32-integration-scope.json'),JSON.stringify({...policy,allowedPaths:[...policy.allowedPaths,'outside.ts']}));
  writeFileSync(join(dir,'scripts/r01-ownership.mjs'),"process.exit(0);");
  writeFileSync(join(dir,'outside.ts'),'// forbidden change');
  git('add','.');git('commit','-qm','Untrusted scope expansion');
  const trusted=join(dir,'trusted-checker.mjs');writeFileSync(trusted,git('show',base+':scripts/r01-ownership.mjs'));
  const result=spawnSync(process.execPath,[trusted],{cwd:dir,encoding:'utf8',env:{...process.env,TERREVO_DIFF_BASE:base,TERREVO_DIFF_HEAD:git('rev-parse','HEAD'),TERREVO_HEAD_BRANCH:policy.branch,TERREVO_OWNER:'integrator',TERREVO_PR_AUTHOR:'owner',TERREVO_ASSIGNED_AUTHOR:'owner',TERREVO_REPOSITORY:'owner/repo',TERREVO_HEAD_REPOSITORY:'owner/repo'}});
  assert.equal(result.status,1);assert.match(result.stderr,/OWNERSHIP VIOLATION[\s\S]*outside\.ts/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
