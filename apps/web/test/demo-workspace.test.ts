import test from "node:test";
import assert from "node:assert/strict";
import {initialDemoState,validateDemo,addDemoCompany,addDemoItem,addDemoTour,changeDemoTour,demoCompany} from "../src/demo/demo-data.ts";
test("synthetic company data is connected, isolated, and validates",()=>{
 const s=initialDemoState();
 assert.equal(s.companies.length,2);
 assert.deepEqual(validateDemo(s),[]);
 assert.equal(s.companies[0].employees.filter(x=>x.managerId).length,2);
 assert.notEqual(s.companies[0].doctors[0].id,s.companies[1].doctors[0].id);
});
test("superuser can create clients, territories and scoped records but field role cannot",()=>{
 let s=addDemoCompany(initialDemoState(),"Another Pharma");
 s=addDemoItem(s,"territories","Western District","WEST");
 const t=demoCompany(s).territories[0].id;
 s=addDemoItem(s,"employees","Manager Example","MGR_02",t);
 s=addDemoItem(s,"employees","Representative Example","MR_02",t,demoCompany(s).employees[0].id);
 s=addDemoItem(s,"doctors","Doctor Example","DR_02",t);
 assert.deepEqual(validateDemo(s),[]);
 assert.throws(()=>addDemoItem({...s,role:"EMPLOYEE"},"products","Forbidden","P001"),/Superuser/);
 assert.throws(()=>addDemoItem(s,"doctors","Outside territory","DR_03","foreign-territory"),/territory/);
});
test("employee submit -> reporting manager approve -> employee complete; unauthorized transitions denied",()=>{
 let s=initialDemoState(),c=demoCompany(s),rep=c.employees.find(x=>x.managerId)!,manager=c.employees.find(x=>x.id===rep.managerId)!;
 const customer=c.doctors.find(x=>x.territoryId===rep.territoryId)!;
 s={...s,role:"EMPLOYEE",actorId:rep.id};
 s=addDemoTour(s,rep.id,customer.id);
 const id=demoCompany(s).tours.at(-1)!.id;
 assert.throws(()=>changeDemoTour(s,id,"APPROVED"),/Reporting manager/);
 s=changeDemoTour(s,id,"SUBMITTED");
 assert.throws(()=>changeDemoTour(s,id,"COMPLETED"),/Invalid workflow/);
 s={...s,role:"MANAGER",actorId:manager.id};
 s=changeDemoTour(s,id,"APPROVED");
 s={...s,role:"EMPLOYEE",actorId:rep.id};
 s=changeDemoTour(s,id,"COMPLETED");
 assert.equal(demoCompany(s).tours.at(-1)?.status,"COMPLETED");
 assert.deepEqual(validateDemo(s),[]);
});
test("no cross-client tour data",()=>{
 let s=initialDemoState();
 const c=s.companies[0],rep=c.employees.find(e=>!!e.managerId)!;
 s={...s,role:"EMPLOYEE",actorId:rep.id};
 assert.throws(()=>addDemoTour(s,rep.id,s.companies[1].doctors[0].id),/territory/);
 assert.equal(s.companies[1].tours.length,0);
});
