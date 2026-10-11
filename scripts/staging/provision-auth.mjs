// Bounded, short-lived staging-only Auth admin operation. Never returns provider keys.
import {readBoundedJsonObject} from '../../modules/security/src/index.ts';
export function createAuthProvisioner(config, env, fetcher = fetch, now = Date.now) {
  return async request => {
    const denied = () => Response.json({error:'Provisioning unavailable'}, {status:403});
    if (config.projectRef !== 'eirlubfbjexjilvskqxq'
        || env.url !== `https://${config.projectRef}.supabase.co`
        || !env.serverKey || request.method !== 'POST' || now() >= config.expiresAt) return denied();
    const nonce = request.headers.get('x-qualification-nonce') ?? '';
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce));
    const hash = [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    if (hash !== config.nonceHash) return denied();
    let body; try {body=await readBoundedJsonObject(request,2048);} catch {return denied();}
    if (typeof body.password !== 'string' || body.password.length < 24 || body.password.length > 128) return denied();
    const users=[];
    for (const identity of config.identities) {
      const response=await fetcher(`${env.url}/auth/v1/admin/users`,{
        method:'POST', redirect:'error', headers:{apikey:env.serverKey,authorization:`Bearer ${env.serverKey}`,'content-type':'application/json'},
        body:JSON.stringify({email:identity.email,password:body.password,email_confirm:true,
          app_metadata:{qualification_run:config.runId,qualification_role:identity.role}})
      });
      if (!response.ok) return Response.json({error:'Auth provisioning failed',created:users},{status:502});
      const user=await response.json();
      if (typeof user.id !== 'string') return Response.json({error:'Invalid Auth response'},{status:502});
      users.push({id:user.id,email:identity.email,role:identity.role});
    }
    return Response.json({runId:config.runId,users},{headers:{'cache-control':'no-store'}});
  };
}
