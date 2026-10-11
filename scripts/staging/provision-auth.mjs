// Bounded, short-lived staging-only Auth admin operation. Never returns provider keys.
import {readBoundedJsonObject} from '../../modules/security/src/index.ts';
export function createAuthProvisioner(config, env, fetcher = fetch, now = Date.now) {
  return async request => {
    const users=[];
    const denied = () => Response.json({error:'Provisioning unavailable',created:users}, {status:403,headers:{'cache-control':'no-store'}});
    const failed=()=>Response.json({error:'Auth provisioning failed',created:users},{status:502,headers:{'cache-control':'no-store'}});
    if (config.projectRef !== 'eirlubfbjexjilvskqxq'
        || env.url !== `https://${config.projectRef}.supabase.co`
        || !env.serverKey || request.method !== 'POST' || now() >= config.expiresAt) return denied();
    const nonce = request.headers.get('x-qualification-nonce') ?? '';
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce));
    const hash = [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    if (hash !== config.nonceHash) return denied();
    let body; try {body=await readBoundedJsonObject(request,2048);} catch {return denied();}
    if (typeof body.password !== 'string' || body.password.length < 24 || body.password.length > 128) return denied();
    const headers={apikey:env.serverKey,authorization:`Bearer ${env.serverKey}`,'content-type':'application/json'};
    const deadline=AbortSignal.timeout(30000);
    const provider=(url,options={})=>fetcher(url,{...options,headers,redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(10000)])});
    const owned=(user,identity)=>typeof user?.id==='string'&&user.email===identity.email&&user.app_metadata?.qualification_run===config.runId&&user.app_metadata?.qualification_role===identity.role;
    async function findUser(email){
      for(let page=1;page<=10;page++){
        const response=await provider(`${env.url}/auth/v1/admin/users?page=${page}&per_page=100`);
        if(!response.ok)throw Error('Provider unavailable');
        const body=await response.json();if(!Array.isArray(body.users)||body.users.length>100)throw Error('Invalid user list');
        const matches=body.users.filter(user=>user.email===email);if(matches.length>1)throw Error('Ambiguous user');
        if(matches.length)return matches[0];if(body.users.length<100)return null;
      }
      throw Error('Bounded user lookup exceeded');
    }
    try{
      for (const identity of config.identities) {
        let existing;
        if(identity.id){
          const response=await provider(`${env.url}/auth/v1/admin/users/${encodeURIComponent(identity.id)}`);
          if(!response.ok)return failed();existing=await response.json();
          if(existing.id!==identity.id||!owned(existing,identity))return denied();
        }else{
          existing=await findUser(identity.email);
          if(existing&&!owned(existing,identity))return denied();
        }
        const update={email:identity.email,password:body.password,email_confirm:true,app_metadata:{qualification_run:config.runId,qualification_role:identity.role}};
        let response=await provider(`${env.url}/auth/v1/admin/users${existing?'/'+encodeURIComponent(existing.id):''}`,{method:existing?'PUT':'POST',body:JSON.stringify(update)});
        if(!response.ok&&!existing){
          // Concurrent create or a previous response loss may already have committed.
          const error=await response.json().catch(()=>null);
          if(['email_exists','user_already_exists'].includes(error?.code)){
            existing=await findUser(identity.email);if(!existing)return failed();if(!owned(existing,identity))return denied();
            response=await provider(`${env.url}/auth/v1/admin/users/${encodeURIComponent(existing.id)}`,{method:'PUT',body:JSON.stringify(update)});
          }
        }
        if(!response.ok)return failed();
        const user=await response.json();if(typeof user.id!=='string'||(existing&&user.id!==existing.id))return failed();
        users.push({id:user.id,email:identity.email,role:identity.role});
      }
    }catch{return failed();}
    return Response.json({runId:config.runId,users},{headers:{'cache-control':'no-store'}});
  };
}
