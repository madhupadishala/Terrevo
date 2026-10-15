/** LOCAL DEVELOPMENT DEMO ONLY. No network, credentials, storage or Supabase service role. */
export type DemoRole = "SUPERUSER"|"MANAGER"|"EMPLOYEE";
export type DemoKind = "employees"|"doctors"|"chemists"|"stockists"|"products";
export type DemoItem = {id:string; code:string; name:string; territoryId?:string; managerId?:string; specialty?:string; price?:number};
export type DemoTour = {id:string; employeeId:string; customerId:string; status:"PLANNED"|"SUBMITTED"|"APPROVED"|"REJECTED"|"COMPLETED"; notes:string};
export type DemoCompany = {id:string;name:string; clientCode:string; territories:DemoItem[]; employees:DemoItem[]; doctors:DemoItem[];chemists:DemoItem[];stockists:DemoItem[];products:DemoItem[];tours:DemoTour[]};
export type DemoState={companies:DemoCompany[]; activeCompanyId:string; role:DemoRole; actorId:string};
const item=(id:string,code:string,name:string,territoryId?:string,managerId?:string):DemoItem=>({id,code,name,territoryId,managerId});
export function initialDemoState():DemoState {
  const t1="demo-territory-north",t2="demo-territory-south", manager="demo-manager",rep="demo-rep";
  return {activeCompanyId:"demo-client-a",role:"SUPERUSER",actorId:"demo-superuser",companies:[{
   id:"demo-client-a",name:"AsterCare Pharma (SYNTHETIC)",clientCode:"DEMO_A",
   territories:[item(t1,"NORTH","North Hyderabad"),item(t2,"SOUTH","South Hyderabad")],
   employees:[item(manager,"AM001","Anika (Synthetic Manager)",t1),item(rep,"MR001","Ravi (Synthetic MR)",t1,manager),item("demo-rep-2","MR002","Meera (Synthetic MR)",t2,manager)],
   doctors:[item("demo-doctor-1","DR001","Dr. Kiran (Synthetic)",t1),item("demo-doctor-2","DR002","Dr. Tara (Synthetic)",t2)],
   chemists:[item("demo-chemist-1","CH001","North Care Pharmacy (Synthetic)",t1),item("demo-chemist-2","CH002","South Care Pharmacy (Synthetic)",t2)],
   stockists:[item("demo-stockist-1","ST001","Metro Distributor (Synthetic)",t1)],
   products:[item("demo-product-1","PR001","Demo Product A"),item("demo-product-2","PR002","Demo Product B")],
   tours:[{id:"demo-tour-1",employeeId:rep,customerId:"demo-doctor-1",status:"PLANNED",notes:"Synthetic doctor visit"}]
  },{
   id:"demo-client-b",name:"Blueleaf Therapeutics (SYNTHETIC)",clientCode:"DEMO_B",
   territories:[item("demo-b-territory","EAST","East Territory")],
   employees:[item("demo-b-manager","AM101","Sameer (Synthetic Manager)","demo-b-territory"),item("demo-b-rep","MR101","Leena (Synthetic MR)","demo-b-territory","demo-b-manager")],
   doctors:[item("demo-b-doctor","DR101","Dr. Neha (Synthetic)","demo-b-territory")],
   chemists:[item("demo-b-chemist","CH101","Blueleaf Pharmacy (Synthetic)","demo-b-territory")],
   stockists:[],products:[item("demo-b-product","PR101","Demo Product C")],tours:[]
  }]};
}
export function demoCompany(state:DemoState):DemoCompany {
 const c=state.companies.find(x=>x.id===state.activeCompanyId);
 if(!c)throw Error("Unknown demo company");return c;
}
export function validateDemo(state:DemoState):string[] {
 const errors:string[]=[];
 for(const c of state.companies){
  const territoryIds=new Set(c.territories.map(x=>x.id)),employees=new Set(c.employees.map(x=>x.id));
  const customers=new Set([...c.doctors,...c.chemists,...c.stockists].map(x=>x.id));
  for(const e of c.employees){if(!territoryIds.has(e.territoryId??""))errors.push(c.id+": employee territory");if(e.managerId&&!employees.has(e.managerId))errors.push(c.id+": manager reference");}
  for(const x of [...c.doctors,...c.chemists,...c.stockists])if(!territoryIds.has(x.territoryId??""))errors.push(c.id+": customer territory");
  for(const t of c.tours)if(!employees.has(t.employeeId)||!customers.has(t.customerId))errors.push(c.id+": tour reference");
 }
 return errors;
}
export function addDemoCompany(state:DemoState,name:string):DemoState {
 if(state.role!=="SUPERUSER")throw Error("Superuser permission required");
 const clean=name.trim();if(clean.length<3||clean.length>80)throw Error("Company name must have 3-80 characters");
 const id="demo-client-"+(state.companies.length+1);
 return {...state,activeCompanyId:id,companies:[...state.companies,{id,name:clean+" (SYNTHETIC)",clientCode:"DEMO_"+(state.companies.length+1),territories:[],employees:[],doctors:[],chemists:[],stockists:[],products:[],tours:[]}]};
}
export function addDemoItem(state:DemoState,kind:DemoKind|"territories",name:string,code:string,territoryId?:string,managerId?:string):DemoState {
 if(state.role!=="SUPERUSER")throw Error("Superuser permission required");
 const company=demoCompany(state);const clean=name.trim(),c=code.trim().toUpperCase();
 if(clean.length<2||clean.length>120||!/^[A-Z0-9_-]{2,20}$/.test(c))throw Error("Invalid name or code");
 if(company[kind].some(x=>x.code===c))throw Error("Duplicate code");
 if(["employees","doctors","chemists","stockists"].includes(kind) && !company.territories.some(t=>t.id===territoryId))throw Error("Select an existing territory");
 if(kind==="employees"&&managerId&&!company.employees.some(e=>e.id===managerId))throw Error("Unknown reporting manager");
 const id="demo-"+kind+"-"+(company[kind].length+1)+"-"+company.id;
 const next={...company,[kind]:[...company[kind],item(id,c,clean,territoryId,managerId)]};
 return {...state,companies:state.companies.map(x=>x.id===company.id?next:x)};
}
export function addDemoTour(state:DemoState,employeeId:string,customerId:string):DemoState{
 if(state.role==="SUPERUSER")throw Error("Select Manager or Employee to create tours");
 const company=demoCompany(state),emp=company.employees.find(x=>x.id===employeeId);
 const customer=[...company.doctors,...company.chemists,...company.stockists].find(x=>x.id===customerId);
 if(!emp||!customer||emp.territoryId!==customer.territoryId)throw Error("Employee and customer must share a territory");
 if(state.role==="EMPLOYEE"&&state.actorId!==employeeId)throw Error("Can only plan your own visits");
 if(state.role==="MANAGER"&&emp.managerId!==state.actorId&&emp.id!==state.actorId)throw Error("Employee outside your reporting team");
 const id="demo-tour-"+(company.tours.length+1)+"-"+company.id;
 return {...state,companies:state.companies.map(x=>x.id===company.id?{...company,tours:[...company.tours,{id,employeeId,customerId,status:"PLANNED",notes:"Synthetic field visit"}]}:x)};
}
export function changeDemoTour(state:DemoState,tourId:string,action:"SUBMITTED"|"APPROVED"|"REJECTED"|"COMPLETED"):DemoState{
 const company=demoCompany(state),tour=company.tours.find(x=>x.id===tourId);
 if(!tour)throw Error("Unknown tour");
 const employee=company.employees.find(e=>e.id===tour.employeeId)!;
 if(action==="SUBMITTED"||action==="COMPLETED"){
  if(state.role!=="EMPLOYEE"||state.actorId!==tour.employeeId)throw Error("Assigned employee required");
  if(tour.status!==(action==="SUBMITTED"?"PLANNED":"APPROVED"))throw Error("Invalid workflow transition");
 }else{
  if(state.role!=="MANAGER"||employee.managerId!==state.actorId)throw Error("Reporting manager required");
  if(tour.status!=="SUBMITTED")throw Error("Only submitted visits can be reviewed");
 }
 return {...state,companies:state.companies.map(c=>c.id===company.id?{...c,tours:c.tours.map(t=>t.id===tourId?{...t,status:action}:t)}:c)};
}
