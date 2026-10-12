import {verifyStagingTarget} from "./verify-staging-target.mjs";
const IDS={a:"10000000-0000-4000-8000-000000000101",b:"10000000-0000-4000-8000-000000000102",source:"40000000-0000-4000-8000-000000000401"};
const required=["TERREVO_R04B_ALPHA_EMAIL","TERREVO_R04B_ALPHA_PASSWORD","TERREVO_R04B_BETA_EMAIL","TERREVO_R04B_BETA_PASSWORD","SUPABASE_PUBLISHABLE_KEY","TERREVO_STAGING_API_ORIGIN"];
export function validateR04BEnv(env){
 const {projectRef}=verifyStagingTarget(env);
 for(const name of required)if(!env[name])throw Error("Missing staging-only secret/config: "+name);
 const url=new URL(env.TERREVO_STAGING_API_ORIGIN);
 if(url.username||url.password||url.search||url.hash||url.pathname!=="/")throw Error("Staging API origin must have no credentials/path");
 if(!(url.hostname==="localhost"&&url.protocol==="http:")&&!(url.protocol==="https:"&&url.hostname.endsWith(".vercel.app")&&url.hostname!=="terrevo.vercel.app"))throw Error("Only local or staging preview API is permitted");
 if(env.TERREVO_R04B_ALPHA_EMAIL===env.TERREVO_R04B_BETA_EMAIL)throw Error("Distinct test identities required");
 return {projectRef,base:new URL(env.SUPABASE_URL).origin,api:url.origin};
}
export async function qualifyR04B(env,fetcher=fetch){
 const cfg=validateR04BEnv(env),key=env.SUPABASE_PUBLISHABLE_KEY;
 const auth=async(endpoint,body,token)=>{
  const r=await fetcher(cfg.base+"/auth/v1/"+endpoint,{method:"POST",headers:{apikey:key,"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{})},body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error("Staging Auth "+endpoint+" HTTP "+r.status);
  const v=await r.json();if(typeof v.access_token!=="string"||typeof v.refresh_token!=="string"||typeof v.user?.id!=="string")throw Error("Invalid Auth session contract");
  return v;
 };
 const login=async(email,password)=>auth("token?grant_type=password",{email,password});
 const a=await login(env.TERREVO_R04B_ALPHA_EMAIL,env.TERREVO_R04B_ALPHA_PASSWORD);
 const b=await login(env.TERREVO_R04B_BETA_EMAIL,env.TERREVO_R04B_BETA_PASSWORD);
 if(a.user.id===b.user.id)throw Error("Identity collision");
 async function check(token,tenant,expectedCode,expectedIds){
  const r=await fetcher(cfg.api+"/api/v1/business/customer-links/"+IDS.source,{headers:{authorization:"Bearer "+token,"x-tenant-id":tenant},redirect:"error",signal:AbortSignal.timeout(15000)});
  if(r.status!==expectedCode)throw Error("Access status mismatch: expected "+expectedCode+" observed "+r.status);
  if(expectedCode===200){const data=await r.json();if(!Array.isArray(data.links)||JSON.stringify(data.links.map(x=>x.id).sort())!==JSON.stringify(expectedIds))throw Error("Wrong tenant/territory evidence set");}
  return r.status;
 }
 const evidence=[];
 evidence.push(["alpha permitted",await check(a.access_token,IDS.a,200,["30000000-0000-4000-8000-000000000301"])]);
 evidence.push(["beta permitted",await check(b.access_token,IDS.b,200,["30000000-0000-4000-8000-000000000304"])]);
 evidence.push(["alpha forbidden beta",await check(a.access_token,IDS.b,403,[])]);
 evidence.push(["beta forbidden alpha",await check(b.access_token,IDS.a,403,[])]);
 const aRefresh=await auth("token?grant_type=refresh_token",{refresh_token:a.refresh_token});
 evidence.push(["refresh persisted",await check(aRefresh.access_token,IDS.a,200,["30000000-0000-4000-8000-000000000301"])]);
 const again=await login(env.TERREVO_R04B_ALPHA_EMAIL,env.TERREVO_R04B_ALPHA_PASSWORD);
 evidence.push(["relogin persisted",await check(again.access_token,IDS.a,200,["30000000-0000-4000-8000-000000000301"])]);
 return {passed:true,checks:evidence,projectRef:cfg.projectRef};
}
if(process.argv[1]?.endsWith("/qualify-r04b-auth.mjs")){
 try{const r=await qualifyR04B(process.env);for(const [name,status] of r.checks)console.log("PASS",name,"HTTP",status);}
 catch(error){console.error("R04B STAGING AUTH QUALIFICATION BLOCKED:",error instanceof Error?error.message:"Unknown error");process.exitCode=1;}
}
