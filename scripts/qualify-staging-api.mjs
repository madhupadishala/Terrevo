import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { verifyStagingTarget } from "./verify-staging-target.mjs";

// Read-only live-contract qualification. All traffic uses GET. No credentials,
// response bodies, patient/customer data, identifiers or authorization tokens
// are logged. This is NOT a substitute for actual field/device acceptance.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const names = ["MR","MANAGER","TENANT_ADMIN"];
const required = ["TERREVO_UAT_TENANT_ID","TERREVO_MR_ACCESS_TOKEN","TERREVO_MANAGER_ACCESS_TOKEN","TERREVO_ADMIN_ACCESS_TOKEN"];

export function validateUatEnvironment(env) {
  const target = verifyStagingTarget(env);
  for (const key of required) {
    if (typeof env[key] !== "string" || !env[key].trim()) throw new Error(`Missing ${key}; do not use production credentials.`);
  }
  if (!UUID.test(env.TERREVO_UAT_TENANT_ID)) throw new Error("Invalid TERREVO_UAT_TENANT_ID.");
  const tokens = names.map(n => env[`TERREVO_${n === "TENANT_ADMIN" ? "ADMIN" : n}_ACCESS_TOKEN`]);
  if (new Set(tokens).size !== tokens.length) throw new Error("Use distinct MR, Manager and Tenant Admin sessions.");
  const raw = env.TERREVO_STAGING_API_ORIGIN;
  let url;
  try { url = new URL(raw); } catch { throw new Error("TERREVO_STAGING_API_ORIGIN must be a valid staging URL."); }
  const local = url.protocol === "http:" && ["127.0.0.1","localhost","[::1]"].includes(url.hostname);
  const preview = url.protocol === "https:" && url.hostname.endsWith(".vercel.app") && url.hostname !== "terrevo.vercel.app";
  if (!local && !preview) throw new Error("Read-only UAT accepts local API or a non-production Vercel preview URL only.");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Staging API URL must be an origin without credentials, query or path.");
  if (url.hostname.includes(target.projectRef)) {
    throw new Error("Use the separate web/API origin, not the Supabase PostgREST endpoint.");
  }
  if (env.TERREVO_UAT_FOREIGN_TENANT_ID && (!UUID.test(env.TERREVO_UAT_FOREIGN_TENANT_ID) ||
    env.TERREVO_UAT_FOREIGN_TENANT_ID === env.TERREVO_UAT_TENANT_ID)) {
    throw new Error("Foreign tenant must be a distinct verified UUID.");
  }
  return { origin: url.origin, tenantId: env.TERREVO_UAT_TENANT_ID, foreignTenantId: env.TERREVO_UAT_FOREIGN_TENANT_ID || null,
    tokens: { MR: tokens[0], MANAGER: tokens[1], TENANT_ADMIN: tokens[2] } };
}

export async function auditStagingApi(env, fetcher = fetch) {
  const cfg = validateUatEnvironment(env);
  const evidence = [];
  async function request(label, role, endpoint, tenant=cfg.tenantId, authenticated=true) {
    const headers = { "accept": "application/json", ...(tenant ? { "x-tenant-id": tenant } : {}) };
    if (authenticated) headers.authorization = "Bearer " + cfg.tokens[role];
    const res = await fetcher(cfg.origin + "/api" + endpoint, { method:"GET", headers, cache:"no-store", signal:AbortSignal.timeout(15000) });
    const payload = await res.json().catch(() => null);
    evidence.push({ check:label, role, status:res.status, ok:res.ok });
    return {res,payload};
  }
  const failures = [];
  function check(cond, label) {if(!cond)failures.push(label);}
  // This verifies real authorization through the web backend, not a DB superuser.
  for (const role of names) {
    const a=await request("tenant membership",role,"/v1/tenants",null);
    check(a.res.status===200 && Array.isArray(a.payload?.tenants) &&
      a.payload.tenants.some(t=>t.id===cfg.tenantId),"Active "+role+" must have authorized tenant membership.");
    const b=await request("RBAC scope",role,"/v1/access-context");
    check(b.res.status===200 && Array.isArray(b.payload?.context?.permissions),"Active "+role+" RBAC scope unavailable.");
    if (b.res.status===200 && Array.isArray(b.payload?.context?.permissions)) {
      if (role==="MANAGER")check(b.payload.context.permissions.includes("TOUR_APPROVE"),"Manager is missing TOUR_APPROVE.");
      if (role==="TENANT_ADMIN")check(b.payload.context.permissions.includes("MASTER_MANAGE"),"Tenant Admin is missing MASTER_MANAGE.");
    }
    const c=await request("cross-platform privilege denial",role,"/v1/platform/tenants",null);
    check(c.res.status===403,"Tenant account must not enumerate platform tenants: "+role);
  }
  const own=await request("MR own unplanned calls","MR","/v1/unplanned-calls/own");
  check(own.res.status===200 && Array.isArray(own.payload?.calls),"MR own unplanned calls read contract unavailable.");
  const nc=await request("MR controlled NCA options","MR","/v1/nca/options");
  check(nc.res.status===200 && Array.isArray(nc.payload?.options?.categories) &&
    Array.isArray(nc.payload?.options?.towns),"MR controlled NCA options contract unavailable.");
  const queue=await request("manager unplanned approval queue","MANAGER","/v1/unplanned-approvals");
  check(queue.res.status===200 && Array.isArray(queue.payload?.calls),"Manager approval queue unavailable.");
  const anon=await request("anonymous tenant rejection","MR","/v1/tenants",null,false);
  check(anon.res.status===401 || anon.res.status===403,"Anonymous users must not enumerate tenants.");
  if (cfg.foreignTenantId) {
    for (const role of names){
      const other=await request("foreign-tenant rejection",role,"/v1/access-context",cfg.foreignTenantId);
      check([401,403,404].includes(other.res.status),"Foreign tenant access unexpectedly allowed: "+role);
    }
  }
  return {passed:failures.length===0 && Boolean(cfg.foreignTenantId), checks:evidence, failures,
    missingEvidence:cfg.foreignTenantId?[]:["Cross-tenant denial not evaluated: supply a verified distinct TERREVO_UAT_FOREIGN_TENANT_ID."],
    note:"GET-only staging contract test; real device GPS and full write/persistence UAT remain separate gates."};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const outcome=await auditStagingApi(process.env);
    for(const evidence of outcome.checks){
      console.log(`${evidence.ok ? "OK" : "CHECK"} ${evidence.role} ${evidence.check}: HTTP ${evidence.status}`);
    }
    for(const reason of [...outcome.failures,...outcome.missingEvidence])console.error("INCOMPLETE:",reason);
    console.log(outcome.note);
    if(!outcome.passed)process.exitCode=1;
  }catch(error){
    console.error("STAGING READ-ONLY QUALIFICATION BLOCKED:",error instanceof Error?error.message:"Unknown error");
    process.exitCode=1;
  }
}
