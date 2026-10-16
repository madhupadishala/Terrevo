import {readFile,writeFile,chmod} from "node:fs/promises";
import {randomBytes} from "node:crypto";

const args=process.argv.slice(2);
const configPath=args.find(x=>!x.startsWith("--"));
const preflightOnly=args.includes("--preflight");
if(!configPath)throw new Error("Usage: node scripts/pilot-provision.mjs <config.json> [--preflight]");

const SUPABASE_URL=process.env.SUPABASE_URL?.replace(/\/+$/,"");
const SECRET=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTOR=process.env.PILOT_PLATFORM_ADMIN_USER_ID;
const OUT=process.env.PILOT_CREDENTIALS_OUT||"pilot-credentials.json";
if(!SUPABASE_URL||!SECRET||!ACTOR)throw new Error("SUPABASE_URL, SUPABASE_SECRET_KEY and PILOT_PLATFORM_ADMIN_USER_ID are required");

const cfg=JSON.parse(await readFile(configPath,"utf8"));
const roles=["tenantAdmin","manager","mr"];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(!UUID.test(ACTOR))throw new Error("PILOT_PLATFORM_ADMIN_USER_ID must be a UUID");

function reqText(v,name,min=1,max=160){if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)throw new Error(name+" invalid");return v.trim()}
function reqEmail(v,name){const e=reqText(v,name,3,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw new Error(name+" invalid");return e}
function reqCode(v,name){const c=reqText(v,name,2,64).toUpperCase();if(!/^[A-Z0-9][A-Z0-9_-]*$/.test(c))throw new Error(name+" invalid");return c}
function assertConfig(){
  reqText(cfg.tenant?.name,"tenant.name",2,160);
  const slug=reqText(cfg.tenant?.slug,"tenant.slug",3,50).toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug))throw new Error("tenant.slug invalid");
  for(const level of ["company","division","zone","region","area","territory"]){
    reqCode(cfg.hierarchy?.[level]?.code,"hierarchy."+level+".code");
    reqText(cfg.hierarchy?.[level]?.name,"hierarchy."+level+".name",1,160);
  }
  const emails=roles.map(r=>reqEmail(cfg.users?.[r]?.email,"users."+r+".email"));
  if(new Set(emails).size!==3)throw new Error("Pilot emails must be distinct");
  reqText(cfg.users?.tenantAdmin?.name,"users.tenantAdmin.name",2,160);
  reqText(cfg.users?.manager?.name,"users.manager.name",2,160);
  reqText(cfg.users?.mr?.name,"users.mr.name",2,160);
  reqCode(cfg.users?.manager?.employeeCode,"users.manager.employeeCode");
  reqCode(cfg.users?.mr?.employeeCode,"users.mr.employeeCode");
  const p=cfg.passwordPolicy||{};
  if(!Number.isInteger(p.minLength)||p.minLength<12||p.minLength>64)throw new Error("passwordPolicy.minLength must be 12..64");
  return{emails};
}
const validated=assertConfig();

const headers={apikey:SECRET,authorization:"Bearer "+SECRET,"content-type":"application/json"};
async function supabase(path,init={}){
  const r=await fetch(SUPABASE_URL+path,{...init,headers:{...headers,...(init.headers||{})}});
  const raw=await r.text();let body=null;try{body=raw?JSON.parse(raw):null}catch{body=raw}
  if(!r.ok){const e=new Error("Supabase "+r.status+" "+path);e.status=r.status;e.body=body;throw e}
  return body;
}
async function listAuthUsers(){
  const out=[];for(let page=1;page<=100;page++){
    const body=await supabase("/auth/v1/admin/users?page="+page+"&per_page=1000");
    const rows=Array.isArray(body)?body:(body?.users||[]);out.push(...rows);if(rows.length<1000)break;
  }return out;
}
async function activeMemberships(userId){
  const q=new URLSearchParams({select:"tenant_id,status",user_id:"eq."+userId,status:"eq.active"});
  return await supabase("/rest/v1/tenant_memberships?"+q);
}
async function tenantBySlug(slug){
  const q=new URLSearchParams({select:"id,slug,status",slug:"eq."+slug,limit:"1"});
  return await supabase("/rest/v1/tenants?"+q);
}
function generatePassword(policy){
  const symbols="!@#$%^&*()_+-=";const upper="ABCDEFGHJKLMNPQRSTUVWXYZ",lower="abcdefghijkmnopqrstuvwxyz",digits="23456789";
  let chars="";if(policy.requireUppercase)chars+=upper[0];if(policy.requireLowercase)chars+=lower[0];if(policy.requireDigit)chars+=digits[0];if(policy.requireSymbol)chars+=symbols[0];
  const pool=upper+lower+digits+symbols;while(chars.length<policy.minLength)chars+=pool[randomBytes(1)[0]%pool.length];
  return [...chars].sort(()=>Math.random()-.5).join("");
}
function validatePassword(pw,policy){
  if(pw.length<policy.minLength)return false;
  if(policy.requireUppercase&&!/[A-Z]/.test(pw))return false;
  if(policy.requireLowercase&&!/[a-z]/.test(pw))return false;
  if(policy.requireDigit&&!/\d/.test(pw))return false;
  if(policy.requireSymbol&&!/[^A-Za-z0-9]/.test(pw))return false;
  return true;
}

const authUsers=await listAuthUsers();
const slug=cfg.tenant.slug.toLowerCase();
if((await tenantBySlug(slug)).length)throw new Error("Tenant slug already exists: "+slug);

const resolved={};const conflicts=[];
for(const role of roles){
  const u=cfg.users[role];const email=reqEmail(u.email,"email");
  const existing=authUsers.find(x=>String(x.email||"").toLowerCase()===email);
  if(existing){
    const memberships=await activeMemberships(existing.id);
    if(memberships.length)conflicts.push({role,email,userId:existing.id,memberships});
    if(!u.reuseExistingAuthUser)conflicts.push({role,email,userId:existing.id,reason:"Existing Auth identity; set reuseExistingAuthUser=true only after review"});
    resolved[role]={existing:true,userId:existing.id,email,password:null};
  }else resolved[role]={existing:false,userId:null,email,password:null};
}
if(conflicts.length){console.error(JSON.stringify({status:"BLOCKED",conflicts},null,2));process.exit(2)}

console.log(JSON.stringify({status:"PREFLIGHT_OK",tenant:cfg.tenant,emails:validated.emails,existingUsers:Object.fromEntries(roles.map(r=>[r,resolved[r].existing]))},null,2));
if(preflightOnly)process.exit(0);

const created=[];
try{
  for(const role of roles){
    if(resolved[role].existing)continue;
    const pw=generatePassword(cfg.passwordPolicy);
    if(!validatePassword(pw,cfg.passwordPolicy))throw new Error("Generated password failed configured policy");
    const body=await supabase("/auth/v1/admin/users",{method:"POST",body:JSON.stringify({
      email:resolved[role].email,password:pw,email_confirm:true,user_metadata:{name:cfg.users[role].name,pilotRole:role}
    })});
    resolved[role].userId=body.id;resolved[role].password=pw;created.push(body.id);
  }
  const rpc=await supabase("/rest/v1/rpc/pilot_initialize_tenant",{method:"POST",body:JSON.stringify({
    p_actor_user_id:ACTOR,p_tenant_name:cfg.tenant.name,p_tenant_slug:slug,
    p_tenant_admin_user_id:resolved.tenantAdmin.userId,
    p_manager_user_id:resolved.manager.userId,p_mr_user_id:resolved.mr.userId,
    p_hierarchy:cfg.hierarchy,
    p_manager:{name:cfg.users.manager.name,employeeCode:cfg.users.manager.employeeCode},
    p_mr:{name:cfg.users.mr.name,employeeCode:cfg.users.mr.employeeCode}
  })});
  const output={createdAt:new Date().toISOString(),tenant:rpc,users:Object.fromEntries(roles.map(r=>[r,{email:resolved[r].email,userId:resolved[r].userId,temporaryPassword:resolved[r].password,existingAuthUser:resolved[r].existing}]))};
  await writeFile(OUT,JSON.stringify(output,null,2),{mode:0o600});await chmod(OUT,0o600).catch(()=>{});
  console.log(JSON.stringify({status:"PROVISIONED",tenant:rpc,credentialsFile:OUT},null,2));
}catch(error){
  for(const id of created.reverse())await fetch(SUPABASE_URL+"/auth/v1/admin/users/"+encodeURIComponent(id),{method:"DELETE",headers}).catch(()=>undefined);
  throw error;
}
