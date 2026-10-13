// Staging-only helper for a temporary synthetic Platform Super Admin grant.
// Requires an existing qualification identity; never creates Auth users.
import {readFile} from "node:fs/promises";
import {stat} from "node:fs/promises";

const [manifestPath,action="status"]=process.argv.slice(2);
if(!manifestPath)throw Error("Private identity manifest required");
if((await stat(manifestPath)).mode&0o077)throw Error("Private identity manifest must have mode 0600");
const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
const actor=manifest.users?.find((u)=>u.role==="UNSCOPED");
if(!actor?.id||!actor?.email)throw Error("UNSCOPED qualification identity required");
const url=process.env.SUPABASE_URL??"";
const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY??"";
const ref=/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1];
if(ref!=="eirlubfbjexjilvskqxq"||!key||process.env.TERREVO_ENVIRONMENT!=="staging"||process.env.VERCEL_ENV==="production")throw Error("Refusing non-staging platform grant operation");
const headers={apikey:key,authorization:"Bearer "+key,"content-type":"application/json",accept:"application/json",prefer:"return=representation"};
const endpoint=url.replace(/\/+$/,"")+"/rest/v1/platform_admin_grants";
const query="?user_id=eq."+encodeURIComponent(actor.id);
async function request(path,init={}){
 const response=await fetch(endpoint+path,{...init,headers,redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("Platform grant provider operation failed: "+response.status);
 return response.status===204?null:response.json();
}
const current=async()=>await request(query+"&select=user_id,active");
if(action==="grant"){
 const rows=await current();
 if(rows.some((row)=>row.user_id===actor.id&&row.active===true)){console.log(JSON.stringify({actorUserId:actor.id,active:true,reused:true}));process.exit(0);}
 await request("",{method:"POST",headers:{...headers,prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({user_id:actor.id,active:true})});
 console.log(JSON.stringify({actorUserId:actor.id,active:true,reused:false}));
}else if(action==="revoke"){
 const response=await fetch(endpoint+query,{method:"PATCH",headers,body:JSON.stringify({active:false}),redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("Platform grant revoke failed: "+response.status);
 console.log(JSON.stringify({actorUserId:actor.id,active:false}));
}else if(action==="status"){
 const rows=await current();console.log(JSON.stringify({actorUserId:actor.id,active:rows.some((row)=>row.user_id===actor.id&&row.active===true)}));
}else throw Error("Action must be grant, revoke, or status");
