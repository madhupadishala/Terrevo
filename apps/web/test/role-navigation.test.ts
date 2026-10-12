import assert from "node:assert/strict";
import test from "node:test";
import { allowedWorkspaceIds } from "../src/role-navigation.ts";

test("unauthenticated users see only the connection overview", () => {
  assert.deepEqual([...allowedWorkspaceIds({authenticated:false,connected:false,isPlatformAdmin:false,roles:[]})],["overview"]);
});

test("MR navigation excludes manager, tenant admin and platform controls", () => {
  const ids=allowedWorkspaceIds({authenticated:true,connected:true,isPlatformAdmin:false,roles:["MR"]});
  assert.equal(ids.has("field"),true);assert.equal(ids.has("manager"),false);assert.equal(ids.has("admin"),false);assert.equal(ids.has("platform"),false);
});

test("manager navigation adds team command and approvals but not tenant administration", () => {
  const ids=allowedWorkspaceIds({authenticated:true,connected:true,isPlatformAdmin:false,roles:["MANAGER"]});
  assert.equal(ids.has("manager"),true);assert.equal(ids.has("approvals"),true);assert.equal(ids.has("admin"),false);
});

test("tenant admin inherits manager workspaces and receives organization administration", () => {
  const ids=allowedWorkspaceIds({authenticated:true,connected:true,isPlatformAdmin:false,roles:["TENANT_ADMIN"]});
  assert.equal(ids.has("manager"),true);assert.equal(ids.has("admin"),true);assert.equal(ids.has("platform"),false);
});

test("platform control is independently authorized", () => {
  const disconnected=allowedWorkspaceIds({authenticated:true,connected:false,isPlatformAdmin:true,roles:[]});
  assert.deepEqual([...disconnected],["overview","platform"]);
  const connected=allowedWorkspaceIds({authenticated:true,connected:true,isPlatformAdmin:true,roles:["MR"]});
  assert.equal(connected.has("platform"),true);assert.equal(connected.has("admin"),false);
});
