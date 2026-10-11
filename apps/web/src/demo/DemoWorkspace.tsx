import {useState} from "react";
import {Button,InlineNotification,TextInput,Tag} from "@carbon/react";
import {addDemoCompany,addDemoItem,addDemoTour,changeDemoTour,demoCompany,initialDemoState,validateDemo,type DemoKind,type DemoRole} from "./demo-data";
export default function DemoWorkspace(){
 const [state,setState]=useState(initialDemoState);
 const [notice,setNotice]=useState("");
 const [clientName,setClientName]=useState("");
 const [kind,setKind]=useState<DemoKind|"territories">("employees");
 const [code,setCode]=useState("");const [name,setName]=useState("");
 const [territory,setTerritory]=useState("");const [manager,setManager]=useState("");
 const [employee,setEmployee]=useState("");const [customer,setCustomer]=useState("");
 const c=demoCompany(state);
 function apply(fn:()=>ReturnType<typeof initialDemoState>){try{const next=fn();const errors=validateDemo(next);if(errors.length)throw Error(errors.join("; "));setState(next);setNotice("Saved to isolated in-memory demo only");}catch(e){setNotice(e instanceof Error?e.message:"Operation failed");}}
 function switchCompany(id:string){setState(s=>({...s,activeCompanyId:id,actorId:"demo-superuser",role:"SUPERUSER"}));setNotice("");}
 function switchRole(role:DemoRole){const actorId=role==="SUPERUSER"?"demo-superuser":role==="MANAGER"?(c.employees.find(e=>!e.managerId)?.id??""):(c.employees.find(e=>!!e.managerId)?.id??"");setState(s=>({...s,role,actorId}));}
 const customers=[...c.doctors,...c.chemists,...c.stockists];
 return <main style={{maxWidth:1150,margin:"0 auto",padding:24,display:"grid",gap:20}}>
  <header><p style={{letterSpacing:3}}>TERREVO · LOCAL PRODUCT DEMO</p><h1>Synthetic field-force workspace</h1>
   <Tag type="purple">DEVELOPMENT ONLY · NO SERVER OR LOGIN</Tag>
   <p>This workspace runs entirely in browser memory on the local development server. It never contacts Supabase, impersonates a real account, or stores data. Refresh resets the demonstration.</p></header>
  {notice&&<InlineNotification kind={notice.startsWith("Saved")?"success":"warning"} title={notice} onCloseButtonClick={()=>setNotice("")}/>}
  <section className="tr-panel"><h2>Company and role</h2>
   <label htmlFor="demo-client">Synthetic client</label>
   <select id="demo-client" value={c.id} onChange={e=>switchCompany(e.target.value)}>{state.companies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   <label htmlFor="demo-role">Demonstration role</label>
   <select id="demo-role" value={state.role} onChange={e=>switchRole(e.target.value as DemoRole)}>
    <option value="SUPERUSER">Superuser (configuration)</option><option value="MANAGER">Manager (team approvals)</option><option value="EMPLOYEE">Employee (field execution)</option>
   </select>
   {state.role!=="SUPERUSER"&&<><label htmlFor="demo-actor">Acting synthetic user</label>
    <select id="demo-actor" value={state.actorId} onChange={e=>setState(s=>({...s,actorId:e.target.value}))}>
     {c.employees.filter(x=>state.role==="MANAGER"?!x.managerId:!!x.managerId).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
    </select></>}
  </section>
  {state.role==="SUPERUSER"&&<section className="tr-panel"><h2>Admin → Company and master configuration</h2>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
      <TextInput id="demo-new-client" labelText="New synthetic client organization" value={clientName} onChange={e=>setClientName(e.target.value)}/>
      <Button onClick={()=>{apply(()=>addDemoCompany(state,clientName));setClientName("");}}>Create client</Button>
    </div>
    <p>Set up territory first, then employees, managers, doctors, chemists, stockists and products. Existing IDs are preserved and the demo enforces valid references.</p>
    <label htmlFor="demo-kind">Configuration category</label>
    <select id="demo-kind" value={kind} onChange={e=>setKind(e.target.value as DemoKind|"territories")}>
      {["territories","employees","doctors","chemists","stockists","products"].map(x=><option key={x} value={x}>{x}</option>)}
    </select>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <TextInput id="demo-code" labelText="Code" value={code} onChange={e=>setCode(e.target.value)}/>
      <TextInput id="demo-name" labelText="Name" value={name} onChange={e=>setName(e.target.value)}/>
    </div>
    {kind!=="territories"&&kind!=="products"&&<><label htmlFor="demo-territory">Territory</label>
      <select id="demo-territory" value={territory} onChange={e=>setTerritory(e.target.value)}><option value="">Select territory</option>{c.territories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
    {kind==="employees"&&<><label htmlFor="demo-manager">Reporting manager (blank for a manager)</label>
      <select id="demo-manager" value={manager} onChange={e=>setManager(e.target.value)}><option value="">Manager / no supervisor</option>{c.employees.filter(x=>!x.managerId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
    <Button onClick={()=>{apply(()=>addDemoItem(state,kind,name,code,territory||undefined,manager||undefined));setName("");setCode("");}}>Create {kind.slice(0,-1)}</Button>
    <h3>Current master data</h3>
    <p>{c.territories.length} territories · {c.employees.length} staff · {c.doctors.length} doctors · {c.chemists.length} chemists · {c.stockists.length} stockists · {c.products.length} products</p>
    <ul>{c[kind].map(x=><li key={x.id}>{x.code} · {x.name}</li>)}</ul>
  </section>}
  {state.role!=="SUPERUSER"&&<section className="tr-panel"><h2>Field journey</h2>
    <p>Plan a customer visit, submit it as the assigned employee, obtain the reporting manager's approval, then complete the visit as the employee.</p>
    <label htmlFor="demo-employee">Employee</label><select id="demo-employee" value={employee} onChange={e=>setEmployee(e.target.value)}>
      <option value="">Choose employee</option>{c.employees.filter(e=>!!e.managerId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <label htmlFor="demo-customer">Customer</label><select id="demo-customer" value={customer} onChange={e=>setCustomer(e.target.value)}>
      <option value="">Choose customer</option>{customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <Button disabled={!employee||!customer} onClick={()=>apply(()=>addDemoTour(state,employee,customer))}>Plan visit</Button>
    <h3>Journeys and manager queue</h3>
    {c.tours.map(t=><div key={t.id} style={{padding:12,borderBottom:"1px solid #888"}}>
      <strong>{c.employees.find(x=>x.id===t.employeeId)?.name}</strong> → {customers.find(x=>x.id===t.customerId)?.name} · <Tag type="blue">{t.status}</Tag>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        {state.role==="EMPLOYEE"&&state.actorId===t.employeeId&&t.status==="PLANNED"&&<Button size="sm" onClick={()=>apply(()=>changeDemoTour(state,t.id,"SUBMITTED"))}>Submit visit</Button>}
        {state.role==="MANAGER"&&t.status==="SUBMITTED"&&c.employees.find(x=>x.id===t.employeeId)?.managerId===state.actorId&&<>
          <Button size="sm" onClick={()=>apply(()=>changeDemoTour(state,t.id,"APPROVED"))}>Approve</Button>
          <Button size="sm" kind="danger--tertiary" onClick={()=>apply(()=>changeDemoTour(state,t.id,"REJECTED"))}>Reject</Button>
        </>}
        {state.role==="EMPLOYEE"&&state.actorId===t.employeeId&&t.status==="APPROVED"&&<Button size="sm" onClick={()=>apply(()=>changeDemoTour(state,t.id,"COMPLETED"))}>Complete visit</Button>}
      </div></div>)}
  </section>}
  <footer><strong>IN-MEMORY SYNTHETIC SIMULATION</strong> · This is not a connected backend UAT or a substitute for final login/RLS qualification.</footer>
 </main>;
}
