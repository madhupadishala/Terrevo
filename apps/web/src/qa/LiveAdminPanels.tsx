import {useEffect,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {useTerrevoData} from "./TerrevoDataProvider";
import type {Tenant} from "../terrevo-api";

function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="tr-panel"><span className="tr-section-kicker">LIVE ADMINISTRATION</span><h2>{title}</h2>{children}</section>}
export function LiveOrganizationAdmin(){
 const data=useTerrevoData(),auth=data.auth,api=data.api;
 const [email,setEmail]=useState(""),[password,setPassword]=useState("TempPass!2026"),[name,setName]=useState(""),[code,setCode]=useState(""),[role,setRole]=useState<"MANAGER"|"MR">("MR"),[org,setOrg]=useState(""),[managerId,setManagerId]=useState(""),[message,setMessage]=useState("");
 const [unitType,setUnitType]=useState("territory"),[unitCode,setUnitCode]=useState(""),[unitName,setUnitName]=useState(""),[parentId,setParentId]=useState("");
 const canRbac=Boolean(data.access?.permissions.includes("RBAC_MANAGE")),canOrg=Boolean(data.access?.permissions.includes("ORG_MANAGE"));
 const territories=data.units.filter(x=>x.type==="territory"&&x.status==="active");
 const parentType:Record<string,string|undefined>={division:"company",zone:"division",region:"zone",area:"region",territory:"area"};
 const parentOptions=unitType==="company"?[]:data.units.filter(x=>x.type===parentType[unitType]&&x.status==="active");
 const managers=(data.masters.employees??[]).filter(x=>String((x as any).designation??"").toLowerCase().includes("manager")&&x.status==="active");
 useEffect(()=>{if(!org&&territories[0])setOrg(territories[0].id)},[org,territories]);
 if(!auth)return null;
 async function createUnit(){
  if(!api)throw new Error("Live API unavailable");
  setMessage("");
  try{
   await api.createOrgUnit({type:unitType,code:unitCode,name:unitName,parentId:unitType==="company"?null:(parentId||null)});
   await data.refresh();setUnitCode("");setUnitName("");setMessage("Organization unit created");
  }catch(e){setMessage(e instanceof Error?e.message:"Organization unit creation failed")}
 }
 return <div className="tr-grid-wide" data-testid="live-org-admin">
 <Panel title="Organization hierarchy">
  <p className="tr-detail">Build the reporting hierarchy before provisioning scoped Manager and MR users. Parent/child constraints remain server-enforced.</p>
  <div className="tr-form">
   <label htmlFor="live-unit-type">Unit type</label><select id="live-unit-type" data-testid="live-unit-type" className="tr-select" value={unitType} onChange={e=>setUnitType(e.target.value)}>
    {["company","division","zone","region","area","territory"].map(x=><option key={x} value={x}>{x}</option>)}
   </select>
   <label htmlFor="live-unit-parent">Parent unit</label><select id="live-unit-parent" data-testid="live-unit-parent" className="tr-select" value={parentId} disabled={unitType==="company"} onChange={e=>setParentId(e.target.value)}>
    <option value="">Select parent</option>{parentOptions.map(x=><option key={x.id} value={x.id}>{x.type} · {x.name}</option>)}
   </select>
   <TextInput id="live-unit-code" data-testid="live-unit-code" labelText="Unit code" value={unitCode} onChange={e=>setUnitCode(e.target.value)}/>
   <TextInput id="live-unit-name" data-testid="live-unit-name" labelText="Unit name" value={unitName} onChange={e=>setUnitName(e.target.value)}/>
   <Button data-testid="live-unit-create" disabled={!canOrg||!unitCode.trim()||!unitName.trim()||(unitType!=="company"&&!parentId)} onClick={()=>void createUnit()}>Create organization unit</Button>
  </div>
  <div className="tr-list-sm">{data.units.map(x=><div className="tr-history-row" key={x.id}><div><strong>{x.name}</strong><p>{x.type} · {x.code}</p></div><Tag>{x.status}</Tag></div>)}</div>
 </Panel>
 <Panel title="Real user provisioning">
  <p className="tr-detail">Creates the Supabase Auth identity, tenant membership, primary organization assignment, employee and role in one server-controlled workflow.</p>
  <div className="tr-form">
   <TextInput id="provision-name" data-testid="provision-name" labelText="Employee name" value={name} onChange={e=>setName(e.target.value)}/>
   <TextInput id="provision-email" data-testid="provision-email" labelText="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
   <TextInput id="provision-password" data-testid="provision-password" type="password" labelText="Temporary password" value={password} onChange={e=>setPassword(e.target.value)}/>
   <TextInput id="provision-code" data-testid="provision-code" labelText="Employee code" value={code} onChange={e=>setCode(e.target.value)}/>
   <label htmlFor="provision-role">Role</label><select id="provision-role" data-testid="provision-role" className="tr-select" value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="MR">Medical Representative</option><option value="MANAGER">Manager</option></select>
   <label htmlFor="provision-org">Territory scope</label><select id="provision-org" data-testid="provision-org" className="tr-select" value={org} onChange={e=>setOrg(e.target.value)}><option value="">Select territory</option>{territories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   <label htmlFor="provision-manager">Reporting manager</label><select id="provision-manager" data-testid="provision-manager" className="tr-select" value={managerId} disabled={role!=="MR"} onChange={e=>setManagerId(e.target.value)}><option value="">Select manager</option>{managers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   <Button data-testid="provision-user" disabled={!canRbac||!email||!password||!name||!code||!org||(role==="MR"&&!managerId)} onClick={()=>void auth.provisionTenantUser({email,temporaryPassword:password,name,employeeCode:code,role,orgUnitId:org,reportingManagerEmployeeId:role==="MR"?managerId:null}).then(()=>{setMessage("User provisioned");setEmail("");setName("");setCode("")}).catch(e=>setMessage(e instanceof Error?e.message:"Provisioning failed"))}>Provision user</Button>
  </div>{message&&<p role="status">{message}</p>}
 </Panel>
 <Panel title="Access boundary"><div className="tr-check-row"><span>Organization management</span><Tag type={canOrg?"green":"red"}>{canOrg?"AUTHORIZED":"DENIED"}</Tag></div><div className="tr-check-row"><span>RBAC management</span><Tag type={canRbac?"green":"red"}>{canRbac?"AUTHORIZED":"DENIED"}</Tag></div><p className="tr-detail">Tenant, role and organization scope remain server-enforced even if browser controls are manipulated.</p></Panel>
 </div>;
}

export function LivePlatformAdmin(){
 const data=useTerrevoData(),auth=data.auth,api=data.api;
 const [tenants,setTenants]=useState<Tenant[]>([]),[name,setName]=useState(""),[slug,setSlug]=useState(""),[selected,setSelected]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("TempPass!2026"),[adminName,setAdminName]=useState(""),[message,setMessage]=useState("");
 async function load(){if(auth?.platformAdmin&&api){const rows=await api.platformTenants();setTenants(rows);if(!selected&&rows[0])setSelected(rows[0].id)}}
 useEffect(()=>{void load().catch(()=>undefined)},[auth?.platformAdmin]);
 if(!auth?.platformAdmin)return <Panel title="Platform Super Admin"><p role="alert">This account is not a platform administrator.</p></Panel>;
 return <div className="tr-grid-wide" data-testid="live-platform-admin"><Panel title="Organization provisioning"><div className="tr-form">
  <TextInput id="live-tenant-name" data-testid="live-tenant-name" labelText="Organization name" value={name} onChange={e=>setName(e.target.value)}/>
  <TextInput id="live-tenant-slug" data-testid="live-tenant-slug" labelText="Organization code" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/>
  <Button data-testid="live-tenant-create" disabled={!name||slug.length<3} onClick={()=>void api!.createPlatformTenant(name,slug).then(async t=>{setMessage("Organization created");setSelected(t.id);await load()}).catch(e=>setMessage(e instanceof Error?e.message:"Create failed"))}>Create organization</Button>
  <label htmlFor="live-tenant-select-admin">Organization</label><select id="live-tenant-select-admin" data-testid="live-tenant-admin-select" className="tr-select" value={selected} onChange={e=>setSelected(e.target.value)}>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
 </div></Panel><Panel title="Initial Tenant Administrator"><div className="tr-form">
  <TextInput id="tenant-admin-name" data-testid="tenant-admin-name" labelText="Administrator name" value={adminName} onChange={e=>setAdminName(e.target.value)}/>
  <TextInput id="tenant-admin-email" data-testid="tenant-admin-email" labelText="Administrator email" value={email} onChange={e=>setEmail(e.target.value)}/>
  <TextInput id="tenant-admin-password" data-testid="tenant-admin-password" type="password" labelText="Temporary password" value={password} onChange={e=>setPassword(e.target.value)}/>
  <Button data-testid="tenant-admin-provision" disabled={!selected||!adminName||!email||password.length<10} onClick={()=>void auth.provisionTenantAdmin(selected,{email,temporaryPassword:password,name:adminName}).then(()=>setMessage("Tenant administrator provisioned")).catch(e=>setMessage(e instanceof Error?e.message:"Provisioning failed"))}>Provision Tenant Admin</Button>
 </div>{message&&<p role="status">{message}</p>}</Panel></div>;
}
