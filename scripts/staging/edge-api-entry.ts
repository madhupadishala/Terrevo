// Staging transport only: the same reviewed API/domain/provider implementation.
import {createVercelApiHandler} from '../../apps/api/src/vercel-runtime.ts';
const url=Deno.env.get('SUPABASE_URL');
const api=url==='https://eirlubfbjexjilvskqxq.supabase.co' ? createVercelApiHandler({
 SUPABASE_URL:url,SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY'),
 SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),TERREVO_ENVIRONMENT:'staging'
}) : null;
Deno.serve(async(request:Request)=>{
 if(!api)return Response.json({error:'Isolated staging configuration required'},{status:503});
 const target=new URL(request.url);
 const marker='/terrevo-staging-api';const index=target.pathname.indexOf(marker);
 if(index<0)return new Response(null,{status:404});
 target.pathname=target.pathname.slice(index+marker.length)||'/health';
 target.searchParams.delete('__terrevo_path');
 return api.fetch(new Request(target,request));
});
