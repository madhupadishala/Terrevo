import {useEffect,useMemo,useState} from "react";
import {Button,Tag,TextArea,TextInput} from "@carbon/react";
import {useDcr,useInventory,useManagerCommand,useTerrevoData,useTrade,useVisit,useWorkforce} from "./TerrevoDataProvider";
import type {ExpenseRecord} from "./types";

type Mode="trade"|"inventory"|"workforce"|"approvals"|"reports";
function Box({title,children}:{title:string;children:React.ReactNode}){return <section className="tr-panel"><span className="tr-section-kicker">FUNCTIONAL QA</span><h2>{title}</h2>{children}</section>}
function Empty({children}:{children:React.ReactNode}){return <p className="tr-detail">{children}</p>}
export function FunctionalQaBusinessWorkspace({mode}:{mode:Mode}){
 const data=useTerrevoData();const visit=useVisit();const inventory=useInventory();const trade=useTrade();const workforce=useWorkforce();const dcr=useDcr();const manager=useManagerCommand();
 const [productId,setProductId]=useState(data.state.products[0]?.id??"");
 const [competitor,setCompetitor]=useState("");const [brandQty,setBrandQty]=useState(0);const [competitorQty,setCompetitorQty]=useState(0);const [rx,setRx]=useState(0);const [orderQty,setOrderQty]=useState(1);
 const [inventoryId,setInventoryId]=useState(data.state.inventory[0]?.id??"");const [inventoryQty,setInventoryQty]=useState(1);
 const [leaveReason,setLeaveReason]=useState("");const [leaveFrom,setLeaveFrom]=useState("2026-10-20");const [leaveTo,setLeaveTo]=useState("2026-10-20");
 const [expenseAmount,setExpenseAmount]=useState(0);const [expenseCategory,setExpenseCategory]=useState<ExpenseRecord["category"]>("TRAVEL");
 const [comment,setComment]=useState("");const [message,setMessage]=useState("");
 useEffect(()=>{
  setProductId(data.state.products[0]?.id??"");setCompetitor("");setBrandQty(0);setCompetitorQty(0);setRx(0);setOrderQty(1);
  setInventoryId(data.state.inventory[0]?.id??"");setInventoryQty(1);setLeaveReason("");setExpenseAmount(0);setComment("");setMessage("");
 },[data.scenario]);
 const act=(fn:()=>void,ok:string)=>{setMessage("");try{fn();setMessage(ok)}catch(e){setMessage(e instanceof Error?e.message:"Operation failed")}};
 const active=visit.activeVisit;
 const activeName=active?active.customerType==="DOCTOR"?data.state.doctors.find(x=>x.id===active.customerId)?.name:active.customerType==="CHEMIST"?data.state.chemists.find(x=>x.id===active.customerId)?.name:data.state.stockists.find(x=>x.id===active.customerId)?.name:null;
 const hasLockedDay=Boolean(data.state.lockedDate);
 const reportPreview=dcr.preview;
 const reportVisitDetails=useMemo(()=>reportPreview.visitIds.map(id=>data.state.visits.find(v=>v.id===id)).filter(Boolean),[reportPreview,data.state.visits]);

 if(mode==="trade")return <div className="tr-business tr-grid-wide" data-testid="qa-trade-workspace">
  <Box title="Outlet relationship prerequisites">
   {active?<><strong>{activeName}</strong><p>{active.customerType} · {active.status}</p></>:<Empty>Check in to a chemist or stockist visit to enable trade actions.</Empty>}
   <div className="tr-check-row"><span>RCPA eligibility</span><Tag type={trade.rcpaEligibility.enabled?"green":"red"}>{trade.rcpaEligibility.enabled?"READY":"BLOCKED"}</Tag></div>
   {!trade.rcpaEligibility.enabled&&<p data-testid="rcpa-disabled-reason" className="tr-detail">{trade.rcpaEligibility.reason}</p>}
   <div className="tr-check-row"><span>POB eligibility</span><Tag type={trade.pobEligibility.enabled?"green":"red"}>{trade.pobEligibility.enabled?"READY":"BLOCKED"}</Tag></div>
   {!trade.pobEligibility.enabled&&<p data-testid="pob-disabled-reason" className="tr-detail">{trade.pobEligibility.reason}</p>}
  </Box>
  <Box title="RCPA & prescription intelligence">
   <div className="tr-form">
    <label htmlFor="rcpa-product">Own product</label><select id="rcpa-product" data-testid="rcpa-product" className="tr-select" value={productId} onChange={e=>setProductId(e.target.value)}><option value="">None</option>{data.state.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <TextInput id="rcpa-competitor" data-testid="rcpa-competitor" labelText="Competitor brand" value={competitor} onChange={e=>setCompetitor(e.target.value)}/>
    <TextInput id="rcpa-brand-qty" data-testid="rcpa-brand-qty" type="number" labelText="Brand quantity" value={String(brandQty)} onChange={e=>setBrandQty(Number(e.target.value))}/>
    <TextInput id="rcpa-competitor-qty" data-testid="rcpa-competitor-qty" type="number" labelText="Competitor quantity" value={String(competitorQty)} onChange={e=>setCompetitorQty(Number(e.target.value))}/>
    <TextInput id="rcpa-rx" data-testid="rcpa-rx" type="number" labelText="Rx count" value={String(rx)} onChange={e=>setRx(Number(e.target.value))}/>
    <p className="tr-detail">Projected market share: {brandQty+competitorQty?Math.round(brandQty/(brandQty+competitorQty)*10000)/100:0}%</p>
    <Button data-testid="rcpa-save" disabled={!trade.rcpaEligibility.enabled||hasLockedDay} title={trade.rcpaEligibility.reason} onClick={()=>act(()=>trade.save({productId:productId||undefined,competitorBrand:competitor||undefined,brandQty,competitorQty,rxCount:rx}),"RCPA saved")}>Save RCPA</Button>
   </div>
  </Box>
  <Box title="POB / product order booking">
   <div className="tr-form"><label htmlFor="order-product">Product</label><select id="order-product" data-testid="pob-product" className="tr-select" value={productId} onChange={e=>setProductId(e.target.value)}>{data.state.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <TextInput id="order-quantity" data-testid="pob-quantity" type="number" labelText="Order quantity" value={String(orderQty)} onChange={e=>setOrderQty(Number(e.target.value))}/>
    <Button data-testid="pob-book" disabled={!trade.pobEligibility.enabled||!productId||orderQty<=0||hasLockedDay} title={trade.pobEligibility.reason} onClick={()=>act(()=>trade.book([{productId,quantity:orderQty}],`qa-pob-${active?.id??"none"}-${productId}`),"POB booked")}>Book POB</Button>
   </div>
   {trade.orders.map(o=><div className="tr-history-row" key={o.id}><strong>{o.id}</strong><Tag type="green">{o.status}</Tag></div>)}
  </Box>{message&&<p role="status">{message}</p>}
 </div>;

 if(mode==="inventory")return <div className="tr-business tr-grid-wide" data-testid="qa-inventory-workspace">
  <Box title="Representative inventory balances">{inventory.balances.length?inventory.balances.map(i=><div className="tr-history-row" key={i.id} data-testid={"inventory-row-"+i.id}><div><strong>{i.code} · {i.name}</strong><p>Allocated {i.allocatedQty} · Distributed {i.distributedQty} · Available {i.availableQty}</p></div><Tag type={i.availableQty?"green":"red"}>{i.availableQty?"AVAILABLE":"ZERO"}</Tag></div>):<Empty>No inventory allocated.</Empty>}</Box>
  <Box title="Distribute during doctor visit"><div className="tr-form">
   <label htmlFor="allocation-item">Item</label><select id="allocation-item" data-testid="inventory-item" className="tr-select" value={inventoryId} onChange={e=>setInventoryId(e.target.value)}><option value="">Select item</option>{inventory.balances.map(i=><option key={i.id} value={i.id}>{i.name} · {i.availableQty} available</option>)}</select>
   <TextInput id="allocation-qty" data-testid="inventory-qty" type="number" labelText="Quantity" value={String(inventoryQty)} onChange={e=>setInventoryQty(Number(e.target.value))}/>
   <Button data-testid="inventory-distribute" disabled={!active||active.customerType!=="DOCTOR"||inventoryQty<=0||hasLockedDay} onClick={()=>act(()=>inventory.distribute(inventoryId,inventoryQty),"Distribution recorded")}>Record distribution</Button>
   {(!active||active.customerType!=="DOCTOR")&&<p className="tr-detail">Distribution requires an active checked-in doctor visit.</p>}
  </div></Box>{message&&<p role="status">{message}</p>}
 </div>;

 if(mode==="workforce")return <div className="tr-business tr-grid-wide" data-testid="qa-workforce-workspace">
  <Box title="Attendance & timesheets">{workforce.attendance.map(a=><div className="tr-history-row" key={a.id}><strong>{a.date}</strong><p>{a.status} · {a.workedMinutes}/{a.requiredMinutes} minutes</p></div>)}{workforce.timesheets.map(t=><div className="tr-history-row" key={t.id}><div><strong>Week {t.weekStart}</strong><p>{t.days.reduce((n,d)=>n+d.hours,0)} hours</p></div><Tag>{t.status}</Tag>{["DRAFT","RETURNED"].includes(t.status)&&<Button data-testid={"timesheet-submit-"+t.id} size="sm" onClick={()=>act(()=>workforce.submitTimesheet(t.id),"Timesheet submitted")}>Submit</Button>}</div>)}</Box>
  <Box title="Leave requests"><div className="tr-form">
   <label htmlFor="leave-from">From</label><input id="leave-from" data-testid="leave-from" className="tr-select" type="date" value={leaveFrom} onChange={e=>setLeaveFrom(e.target.value)}/>
   <label htmlFor="leave-to">To</label><input id="leave-to" data-testid="leave-to" className="tr-select" type="date" value={leaveTo} onChange={e=>setLeaveTo(e.target.value)}/>
   <TextArea id="leave-reason" data-testid="leave-reason" labelText="Reason" value={leaveReason} onChange={e=>setLeaveReason(e.target.value)}/>
   <Button data-testid="leave-submit" disabled={!leaveReason.trim()} onClick={()=>act(()=>workforce.requestLeave({repId:"rep-hyd-01",from:leaveFrom,to:leaveTo,type:"FULL_DAY",reason:leaveReason}),"Leave submitted")}>Request leave</Button>
  </div>{workforce.leaves.map(l=><div className="tr-history-row" key={l.id}><strong>{l.from} — {l.to}</strong><Tag>{l.status}</Tag></div>)}</Box>
  <Box title="Expense claims"><div className="tr-form">
   <label htmlFor="expense-category">Category</label><select id="expense-category" data-testid="expense-category" className="tr-select" value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value as ExpenseRecord["category"])}>{["TRAVEL","FOOD","LODGING","LOCAL_CONVEYANCE","OTHER"].map(x=><option key={x}>{x}</option>)}</select>
   <TextInput id="expense-amount" data-testid="expense-amount" type="number" labelText="Amount (INR)" value={String(expenseAmount)} onChange={e=>setExpenseAmount(Number(e.target.value))}/>
   <Button data-testid="expense-save" disabled={expenseAmount<=0} onClick={()=>act(()=>workforce.saveExpense({repId:"rep-hyd-01",date:"2026-10-16",category:expenseCategory,amount:expenseAmount,currency:"INR"}),"Expense draft saved")}>Save expense</Button>
  </div>{workforce.expenses.map(e=><div className="tr-history-row" key={e.id}><strong>{e.category} · INR {e.amount}</strong><Tag>{e.status}</Tag>{["DRAFT","RETURNED"].includes(e.status)&&<Button size="sm" data-testid={"expense-submit-"+e.id} onClick={()=>act(()=>workforce.submitExpense(e.id),"Expense submitted")}>Submit</Button>}</div>)}</Box>
  {message&&<p role="status">{message}</p>}
 </div>;

 if(mode==="reports")return <div className="tr-business tr-grid-wide" data-testid="qa-dcr-workspace">
  <Box title="Deterministic DCR rollup"><p className="tr-detail">DCR is derived from completed visits and approved NCAs; no disconnected rows can be created.</p>
   <p>Completed visits: {reportPreview.visitIds.length} · Approved NCAs: {reportPreview.ncaIds.length}</p>
   {reportVisitDetails.map(v=><div className="tr-history-row" key={v!.id}><strong>{v!.customerType} · {v!.customerId}</strong><Tag type="green">COMPLETED</Tag></div>)}
   <Button data-testid="dcr-submit" disabled={Boolean(data.state.lockedDate)||data.state.visits.some(v=>v.repId==="rep-hyd-01"&&v.status!=="COMPLETED")} onClick={()=>act(()=>dcr.submit(),"DCR submitted and day locked")}>Submit DCR & lock day</Button>
  </Box>
  <Box title="Submitted DCRs">{dcr.records.length?dcr.records.map(d=><div className="tr-history-row" key={d.id}><strong>{d.date}</strong><Tag type="green">{d.status}</Tag></div>):<Empty>No submitted DCR yet.</Empty>}</Box>{message&&<p role="status">{message}</p>}
 </div>;

 return <div className="tr-business tr-grid-wide" data-testid="qa-manager-approvals">
  <Box title="Manager approval queues">{manager.queue.length?manager.queue.map(q=><div className="tr-history-row" key={q.kind+q.id}><div><strong>{q.kind}</strong><p>{q.label}</p></div><Tag type="blue">{q.status}</Tag><div className="tr-button-row"><Button size="sm" data-testid={"approve-"+q.kind.toLowerCase()+"-"+q.id} onClick={()=>act(()=>manager.decide(q,true),"Approved")}>Approve</Button><Button kind="secondary" size="sm" data-testid={"return-"+q.kind.toLowerCase()+"-"+q.id} disabled={!comment.trim()} onClick={()=>act(()=>manager.decide(q,false,comment),"Returned / rejected")}>Return / reject</Button></div></div>):<Empty>No pending approvals.</Empty>}
   <TextArea id="review-comment" data-testid="manager-review-comment" labelText="Required for return or rejection" value={comment} onChange={e=>setComment(e.target.value)}/>
  </Box>
 </div>;
}
