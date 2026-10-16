import {useState,type ReactNode} from "react";
import {Button,InlineNotification,TextInput} from "@carbon/react";
import {useTerrevoData} from "./TerrevoDataProvider";

export function LiveAccessShell({children}:{children:ReactNode}){
 const data=useTerrevoData();const auth=data.auth;
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
 if(data.mode!=="LIVE_API"||!auth)return <>{children}</>;
 if(!auth.session)return <main className="tr-main" style={{marginLeft:0}} data-testid="live-login">
  <div className="tr-page"><section className="tr-panel" style={{maxWidth:520,margin:"8vh auto"}}>
   <span className="tr-section-kicker">TERREVO SECURE ACCESS</span><h1>Sign in</h1>
   <p className="tr-detail">Use an authorized organization account. Functional QA remains available only through the explicit QA mode.</p>
   {data.error&&<InlineNotification kind="error" title="Authentication failed" subtitle={data.error}/>}
   {message&&<p role="status">{message}</p>}
   <div className="tr-form">
    <TextInput id="live-email" data-testid="live-email" labelText="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/>
    <TextInput id="live-password" data-testid="live-password" type="password" labelText="Password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
    <Button data-testid="live-login-submit" disabled={data.loading||!email.trim()||!password} onClick={()=>void auth.login(email,password).catch(e=>setMessage(e instanceof Error?e.message:"Login failed"))}>{data.loading?"Signing in…":"Sign in"}</Button>
   </div>
  </section></div>
 </main>;
 return <><div className="tr-live-session-bar" data-testid="live-session-bar">
  <strong>{auth.session.user.email??auth.session.user.id}</strong>
  {auth.tenants.length>0&&<select data-testid="live-tenant-select" className="tr-select" value={auth.tenantId??""} onChange={e=>void auth.selectTenant(e.target.value)}>
   {auth.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
  </select>}
  {data.loading&&<span>Refreshing…</span>}
  <Button size="sm" kind="ghost" data-testid="live-refresh" onClick={()=>void data.refresh()}>Refresh</Button>
  <Button size="sm" kind="ghost" data-testid="live-logout" onClick={()=>void auth.logout()}>Logout</Button>
 </div>{children}</>;
}
