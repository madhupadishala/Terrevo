import { useEffect, useState } from "react";
import { Button, Tag, TextInput } from "@carbon/react";
import type { Tenant, TerrevoWebApi } from "./terrevo-api";

type Audit = { id:number;action:string;tenant_id:string;occurred_at:string;actor_user_id:string };
type Props = {
  api: TerrevoWebApi; authenticated: boolean; isSuperAdmin:boolean;
  busy:boolean; perform:(task:()=>Promise<unknown>, title:string)=>Promise<void>;
};
export function PlatformConsole({api,authenticated,isSuperAdmin,busy,perform}:Props) {
  const [tenants,setTenants]=useState<Tenant[]>([]);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [name,setName]=useState("");
  const [slug,setSlug]=useState("");
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!authenticated||!isSuperAdmin){setTenants([]);setAudit([]);return;}
    let current=true; setError("");
    void Promise.allSettled([api.platformTenants(),api.platformAudit()]).then(results=>{
      if(!current)return;
      if(results[0].status==="fulfilled")setTenants(results[0].value);
      if(results[1].status==="fulfilled")setAudit(results[1].value);
      if(results.some(x=>x.status==="rejected"))setError("One or more platform read requests failed. Check server migration and authorization.");
    });
    return ()=>{current=false;};
  },[api,authenticated,isSuperAdmin,revision]);
  async function update(fn:()=>Promise<unknown>,title:string) {
    await perform(fn,title);
    setRevision(x=>x+1);
  }
  if (!authenticated) return <section className="tr-panel"><span className="tr-section-kicker">PLATFORM ACCESS</span>
    <h2>Connect an existing authorized account</h2><p className="tr-detail">No platform administrator is preconfigured. The platform control plane requires a verified session and an active platform grant.</p></section>;
  if (!isSuperAdmin) return <section className="tr-panel"><span className="tr-section-kicker">PLATFORM ACCESS</span>
    <h2>Platform permissions required</h2><p className="tr-detail">Organization admins and managers do not automatically receive cross-tenant authority. No initial Super Admin needs to be selected for UI development.</p></section>;
  return <div className="tr-grid-wide">
    <section className="tr-panel"><span className="tr-section-kicker">AUTHORIZED CONTROL PLANE</span><h2>Organizations</h2>
      <p className="tr-detail">Only server-authorized Super Admins can create or activate organizations. Each mutation is written with an audit record.</p>
      {error&&<p role="alert" className="tr-business-error">{error}</p>}
      <div className="tr-form"><TextInput id="platform-tenant-name" labelText="Organization name" value={name} maxLength={160} onChange={e=>setName(e.target.value)}/>
        <TextInput id="platform-tenant-slug" labelText="Unique organization code" value={slug} maxLength={50} onChange={e=>setSlug(e.target.value.toLowerCase())}/>
        <Button disabled={busy||name.trim().length<2||!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)} onClick={()=>void update(()=>api.createPlatformTenant(name,slug),"Platform tenant created")}>Create organization</Button></div>
      <div className="tr-list-sm">{tenants.length?tenants.map(t=><div className="tr-history-row" key={t.id}><div><strong>{t.name}</strong><p>{t.slug} · {t.id.slice(0,8)}</p>
        <Button size="sm" kind="ghost" disabled={busy} onClick={()=>void update(()=>api.changePlatformTenantStatus(t.id,t.status==="active"?"inactive":"active"),"Organization status updated")}>{t.status==="active"?"Deactivate":"Activate"} organization</Button>
      </div><Tag type={t.status==="active"?"green":"gray"}>{t.status}</Tag></div>):<p className="tr-detail">No organizations returned.</p>}</div>
    </section>
    <section className="tr-panel"><span className="tr-section-kicker">IMMUTABLE PLATFORM RECORD</span><h2>Administration audit</h2>
      <p className="tr-detail">Recent actions are read from the restricted platform audit table; there is no client-side audit editing.</p>
      <div className="tr-list-sm">{audit.length?audit.map(x=><div className="tr-history-row" key={x.id}><div><strong>{x.action.replace(/_/g," ")}</strong>
        <p>{new Date(x.occurred_at).toLocaleString()} · Organization {x.tenant_id.slice(0,8)}</p><p>Actor {x.actor_user_id.slice(0,8)}</p>
      </div></div>):<p className="tr-detail">No platform actions recorded yet.</p>}</div>
      <div className="tr-check-row"><span>Cross-tenant access</span><Tag type="green">Platform-grant only</Tag></div>
      <div className="tr-check-row"><span>Audit trail</span><Tag type="green">Server recorded</Tag></div>
      <div className="tr-check-row"><span>User provisioning</span><Tag type="gray">Not enabled</Tag></div>
    </section>
  </div>;
}
