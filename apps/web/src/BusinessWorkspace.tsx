import { useEffect, useState } from "react";
import { Button, Tag, TextArea, TextInput } from "@carbon/react";
import { freshPosition, type FieldVisit, type Master, type Progress, type TerrevoWebApi } from "./terrevo-api";

export type BusinessArea = "trade" | "inventory" | "workforce" | "approvals" | "reports";

type Props = {
  mode: BusinessArea;
  api: TerrevoWebApi;
  connected: boolean;
  manager: boolean;
  busy: boolean;
  visit: FieldVisit | null;
  progress: Progress | null;
  masters: Record<string, Master[]>;
  perform: (fn: () => Promise<unknown>, title: string) => Promise<void>;
};
type Dcr = { id: string; doctorName: string; doctorCode: string; callOutcome: string; submittedAt: string; doctorId: string };
type Balance = { id: string; employeeId: string; itemType: "sample" | "gift"; itemId: string; quantity: number };
type Dist = { id: string; itemType: "sample" | "gift"; itemId: string; quantity: number };
type Day = { id: string; workDate: string; totalMinutes: number; visitMinutes: number; status: string; callCount: number };
type Week = { id: string; weekStart: string; status: string; totalMinutes: number; dailyCount: number };
type Leave = { id: string; leaveType: string; startDate: string; endDate: string; reason: string; status: string };
type Expense = { id: string; workDate: string; totalAmount: number; currencyCode: string; status: string; executionId: string };
type Joint = { id: string; workDate: string; status: string; targetEmployeeId: string; selfRole: string | null };
type Approval = { id: string; status: string; employeeId: string; weekStart?: string; leaveType?: string; startDate?: string; endDate?: string; totalAmount?: number; currencyCode?: string };
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="tr-panel"><span className="tr-section-kicker">SERVER-BACKED WORKFLOW</span><h2>{title}</h2>{children}</section>;
}
function Entry({ heading, detail, status, children }: { heading: string; detail: string; status?: string; children?: React.ReactNode }) {
  return <div className="tr-history-row"><div className="tr-record-detail"><strong>{heading}</strong><p>{detail}</p>{children}</div>{status && <Tag type={["APPROVED","SUBMITTED","COMPLETED","REVIEWED","PRESENT"].includes(status)?"green":"blue"}>{status}</Tag>}</div>;
}
const thisMonday = () => { const d = new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10); };
const thisDate = () => new Date().toISOString().slice(0,10);
const empty = <p className="tr-detail">No authorized records were returned for this workspace.</p>;

export function BusinessWorkspace({ mode, api, connected, manager, busy, visit, progress, masters, perform }: Props) {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [dcrs, setDcrs] = useState<Dcr[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [distributions, setDistributions] = useState<Dist[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [joint, setJoint] = useState<Joint[]>([]);
  const [approvals, setApprovals] = useState<{leaves:Approval[];expenses:Approval[];timesheets:Approval[]}>({leaves:[],expenses:[],timesheets:[]});
  const [currentRcpa, setCurrentRcpa] = useState<string>("");
  const [currentOrder, setCurrentOrder] = useState<string>("");
  const [productId, setProductId] = useState("");
  const [competitorBrand, setCompetitorBrand] = useState("");
  const [prescriptions, setPrescriptions] = useState(0);
  const [stock, setStock] = useState(0);
  const [sales, setSales] = useState(0);
  const [orderQty, setOrderQty] = useState(1);
  const [itemType, setItemType] = useState<"sample"|"gift">("sample");
  const [itemId, setItemId] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [week, setWeek] = useState(thisMonday());
  const [leaveType, setLeaveType] = useState<"FULL_DAY"|"HALF_DAY">("FULL_DAY");
  const [from, setFrom] = useState(thisDate());
  const [to, setTo] = useState(thisDate());
  const [reason, setReason] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<"TRAVEL"|"MEAL"|"LODGING"|"LOCAL_CONVEYANCE"|"OTHER">("TRAVEL");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseCurrency, setExpenseCurrency] = useState("INR");
  const [comment, setComment] = useState("");

  const activeStop = progress?.stops.find(s=>s.planStopId === visit?.planStopId);
  const tradeVisit = Boolean(visit && (activeStop?.type==="chemist" || activeStop?.type==="stockist"));
  const doctorVisit = Boolean(visit && activeStop?.type==="doctor");
  const canAct = connected&&!busy;

  useEffect(() => {
    if (!connected) {
      setDcrs([]);setBalances([]);setDistributions([]);setDays([]);setWeeks([]);
      setLeaves([]);setExpenses([]);setJoint([]);setApprovals({leaves:[],expenses:[],timesheets:[]});
      return;
    }
    let live = true;
    setMessage("");
    void (async () => {
      try {
        if (mode==="trade" || mode==="reports") {
          const data = await api.dcrs();if(live)setDcrs(data);
          if (mode==="trade" && tradeVisit && visit) {
            const [rcpa, order] = await Promise.all([api.rcpa(visit.id),api.order(visit.id)]);
            if(live){setCurrentRcpa(rcpa ? String(rcpa.lines.length)+" line(s) recorded" : "No RCPA recorded");setCurrentOrder(order ? String(order.lines.length)+" order line(s) recorded" : "No order recorded");}
          }
        }
        if(mode==="inventory") {
          const data=await api.inventory();if(live)setBalances(data);
          if(visit){const dist=await api.distributions(visit.id);if(live)setDistributions(dist);}else if(live)setDistributions([]);
        }
        if(mode==="workforce") {
          const all=await Promise.allSettled([api.dailyTimesheets(),api.weeklyTimesheets(),api.leaves(),api.expenses(),api.jointWork()]);
          if(!live)return;
          if(all[0].status==="fulfilled")setDays(all[0].value);
          if(all[1].status==="fulfilled")setWeeks(all[1].value);
          if(all[2].status==="fulfilled")setLeaves(all[2].value);
          if(all[3].status==="fulfilled")setExpenses(all[3].value);
          if(all[4].status==="fulfilled")setJoint(all[4].value);
          const failed=all.filter(x=>x.status==="rejected").length;
          if(failed)setMessage(String(failed)+" workforce APIs were unavailable for this account.");
        }
        if(mode==="approvals"&&manager) {
          const all=await Promise.allSettled([api.pendingLeaveApprovals(),api.pendingExpenseApprovals(),api.pendingWeeklyTimesheets()]);
          if(!live)return;
          setApprovals({
            leaves:all[0].status==="fulfilled"?all[0].value:[],
            expenses:all[1].status==="fulfilled"?all[1].value:[],
            timesheets:all[2].status==="fulfilled"?all[2].value:[],
          });
          if(all.some(x=>x.status==="rejected"))setMessage("Some approval queues could not be loaded for this account.");
        }
      } catch (error) {
        if(live)setMessage(error instanceof Error?error.message:"Unable to retrieve workspace records");
      }
    })();
    return () => { live=false; };
  }, [api, connected, mode, manager, visit?.id, revision, tradeVisit]);

  async function act(fn: () => Promise<unknown>, label: string) {
    await perform(fn,label);
    setRevision(v=>v+1);
  }
  const productOptions=(masters.products??[]).filter(x=>x.status==="active");
  const stockItems=(masters[itemType==="sample"?"samples":"gifts"]??[]).filter(x=>x.status==="active");
  const itemName=(type:string,id:string)=>masters[type==="sample"?"samples":"gifts"]?.find(x=>x.id===id)?.name??id.slice(0,8);

  if (!connected) return <Box title="Connect to view real business activity"><p className="tr-detail">This module uses Terrevo server data and does not create local demonstration records. Connect an existing authorized organization to transact.</p></Box>;
  return <div className="tr-business">
    {message && <p className="tr-business-error" role="status">{message}</p>}

    {mode==="trade"&&<div className="tr-grid-wide">
      <Box title="RCPA & prescription intelligence">
        <p className="tr-detail">Record actual chemist prescription movement while checked in. {currentRcpa}</p>
        <div className="tr-form">
          <label className="tr-select-label" htmlFor="rcpa-product">Product (or competitor below)</label>
          <select id="rcpa-product" className="tr-select" value={productId} onChange={e=>setProductId(e.target.value)}>
            <option value="">Competitor / choose brand below</option>{productOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <TextInput id="rcpa-competitor" labelText="Competitor brand (leave empty when product selected)" value={competitorBrand} onChange={e=>setCompetitorBrand(e.target.value)} maxLength={160}/>
          <div className="tr-form-three"><TextInput id="rcpa-rx" type="number" labelText="Prescriptions" value={String(prescriptions)} onChange={e=>setPrescriptions(Number(e.target.value))}/><TextInput id="rcpa-stock" type="number" labelText="Stock" value={String(stock)} onChange={e=>setStock(Number(e.target.value))}/><TextInput id="rcpa-sales" type="number" labelText="Sales" value={String(sales)} onChange={e=>setSales(Number(e.target.value))}/></div>
          <Button disabled={!canAct||!tradeVisit||Boolean(productId)===Boolean(competitorBrand.trim())||prescriptions+stock+sales<=0} onClick={()=>visit&&void act(()=>api.saveRcpa(visit.id,[{sequence:1,productId:productId||null,competitorBrand:competitorBrand.trim()||null,prescriptionCount:prescriptions,stockQuantity:stock,salesQuantity:sales}]),"RCPA saved")}>Save RCPA</Button>
        </div>
        {!tradeVisit&&<p className="tr-detail">Check in to a planned chemist or stockist visit first.</p>}
      </Box>
      <Box title="Stockist / chemist orders">
        <p className="tr-detail">Book server-side orders against the checked-in trade account. {currentOrder}</p>
        <div className="tr-form"><label className="tr-select-label" htmlFor="order-product">Product</label>
          <select id="order-product" className="tr-select" value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Choose product</option>{productOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <TextInput id="order-quantity" type="number" labelText="Order quantity" value={String(orderQty)} onChange={e=>setOrderQty(Number(e.target.value))}/>
          <Button disabled={!canAct||!tradeVisit||!productId||!Number.isInteger(orderQty)||orderQty<1} onClick={()=>visit&&void act(()=>api.saveOrder(visit.id,[{sequence:1,productId,quantity:orderQty,remarks:null}]),"Order recorded")}>Book order</Button>
        </div>
      </Box>
    </div>}

    {mode==="inventory"&&<div className="tr-grid-wide">
      <Box title="Sample and gift allocation">
        <p className="tr-detail">Actual allotted balances from the authorized inventory service.</p>
        {balances.length?balances.map(b=><Entry key={b.id} heading={itemName(b.itemType,b.itemId)} detail={b.itemType+" · allocated quantity "+b.quantity}/>):empty}
      </Box>
      <Box title="Distribute during a visit">
        <p className="tr-detail">Distributions are recorded against an actual checked-in field visit.</p>
        <div className="tr-form"><label className="tr-select-label" htmlFor="allocation-type">Item type</label>
          <select id="allocation-type" className="tr-select" value={itemType} onChange={e=>{setItemType(e.target.value as "sample"|"gift");setItemId("");}}><option value="sample">Sample</option><option value="gift">Gift</option></select>
          <label className="tr-select-label" htmlFor="allocation-item">Item</label>
          <select id="allocation-item" className="tr-select" value={itemId} onChange={e=>setItemId(e.target.value)}><option value="">Select allotted item</option>{stockItems.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <TextInput id="allocation-qty" type="number" labelText="Quantity" value={String(itemQty)} onChange={e=>setItemQty(Number(e.target.value))}/>
          <Button disabled={!canAct||!visit||!itemId||!Number.isInteger(itemQty)||itemQty<1} onClick={()=>visit&&void act(()=>api.distribute(visit.id,[{itemType,itemId,quantity:itemQty}]),"Distribution recorded")}>Record distribution</Button>
        </div>
        <h3>Recorded for active visit</h3>{distributions.length?distributions.map(x=><Entry key={x.id} heading={itemName(x.itemType,x.itemId)} detail={x.itemType+" · "+x.quantity}/>):empty}
      </Box>
    </div>}

    {mode==="workforce"&&<div className="tr-grid-wide">
      <Box title="Daily & weekly timesheets">
        <h3>Daily work</h3>{days.length?days.map(d=><Entry key={d.id} heading={d.workDate} detail={d.totalMinutes+" minutes · "+d.callCount+" calls"} status={d.status}/>):empty}
        <h3>Weekly records</h3>{weeks.length?weeks.map(w=><Entry key={w.id} heading={"Week of "+w.weekStart} detail={w.totalMinutes+" minutes · "+w.dailyCount+" days"} status={w.status}>
          {["DRAFT","RETURNED"].includes(w.status)&&<Button kind="ghost" size="sm" disabled={!canAct} onClick={()=>void act(()=>api.submitWeeklyTimesheet(w.id,null),"Weekly timesheet submitted")}>Submit timesheet ↗</Button>}</Entry>):empty}
        <div className="tr-form"><label htmlFor="week-start" className="tr-select-label">Week start</label><input id="week-start" className="tr-select" type="date" value={week} onChange={e=>setWeek(e.target.value)}/>
          <Button kind="secondary" disabled={!canAct} onClick={()=>void act(()=>api.generateWeeklyTimesheet(week),"Weekly timesheet generated")}>Generate weekly timesheet</Button></div>
      </Box>
      <Box title="Leave requests & expenses">
        <h3>Leave history</h3>{leaves.length?leaves.map(l=><Entry key={l.id} heading={l.leaveType.replace("_"," ")} detail={l.startDate+" — "+l.endDate} status={l.status}/>):empty}
        <div className="tr-form"><label className="tr-select-label" htmlFor="leave-type">Leave type</label><select id="leave-type" className="tr-select" value={leaveType} onChange={e=>setLeaveType(e.target.value as "FULL_DAY"|"HALF_DAY")}><option value="FULL_DAY">Full day</option><option value="HALF_DAY">Half day</option></select>
          <label className="tr-select-label" htmlFor="leave-from">From</label><input id="leave-from" type="date" className="tr-select" value={from} onChange={e=>setFrom(e.target.value)}/>
          <label className="tr-select-label" htmlFor="leave-to">To</label><input id="leave-to" type="date" className="tr-select" value={to} onChange={e=>setTo(e.target.value)}/>
          <TextArea id="leave-reason" labelText="Leave reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/>
          <Button disabled={!canAct||!reason.trim()||from>to} onClick={()=>void act(()=>api.requestLeave(leaveType,from,to,reason),"Leave submitted")}>Request leave</Button></div>
        <h3>Expense claims</h3>{expenses.length?expenses.map(x=><Entry key={x.id} heading={x.currencyCode+" "+x.totalAmount.toFixed(2)} detail={x.workDate} status={x.status}>
          {["DRAFT","RETURNED"].includes(x.status)&&<Button kind="ghost" size="sm" disabled={!canAct} onClick={()=>void act(()=>api.submitExpense(x.id,null),"Expense claim submitted")}>Submit claim ↗</Button>}</Entry>):empty}
        <div className="tr-form"><label className="tr-select-label" htmlFor="expense-category">Category</label>
          <select id="expense-category" className="tr-select" value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value as typeof expenseCategory)}>
            {["TRAVEL","MEAL","LODGING","LOCAL_CONVEYANCE","OTHER"].map(x=><option key={x} value={x}>{x.replace("_"," ")}</option>)}</select>
          <TextInput id="expense-amount" type="number" labelText="Amount" value={String(expenseAmount)} onChange={e=>setExpenseAmount(Number(e.target.value))}/>
          <TextInput id="expense-currency" labelText="Currency (ISO 4217)" value={expenseCurrency} maxLength={3} onChange={e=>setExpenseCurrency(e.target.value.toUpperCase())}/>
          <Button disabled={!canAct||!progress||!(expenseAmount>0)||!/^[A-Z]{3}$/.test(expenseCurrency)} onClick={()=>progress&&void act(()=>api.saveExpense(progress.executionId,expenseCurrency,expenseAmount,expenseCategory,null),"Expense claim saved")}>Save expense</Button></div>
      </Box>
      <Box title="Joint fieldwork">
        {joint.length?joint.map(x=><Entry key={x.id} heading={x.workDate} detail={"Assigned employee "+x.targetEmployeeId.slice(0,8)+" · "+(x.selfRole??"Participant")} status={x.status}>
          {x.status==="PLANNED"&&<Button kind="ghost" disabled={!canAct} size="sm" onClick={()=>void act(async()=>api.joinJointWork(x.id,await freshPosition()),"Joint work joined")}>Join with GPS</Button>}
          {x.status==="ACTIVE"&&<Button kind="ghost" disabled={!canAct} size="sm" onClick={()=>void act(async()=>api.leaveJointWork(x.id,await freshPosition()),"Joint work completed")}>Leave with GPS</Button>}</Entry>):empty}
      </Box>
    </div>}

    {mode==="approvals"&&(manager?<div className="tr-grid-wide">
      {(["leaves","expenses","timesheets"] as const).map(kind=><Box key={kind} title={"Pending "+kind}>
        {approvals[kind].length?approvals[kind].map(row=><Entry key={row.id} heading={"Employee "+row.employeeId.slice(0,8)} detail={kind==="expenses"?String(row.currencyCode)+" "+String(row.totalAmount):kind==="timesheets"?"Week "+row.weekStart:row.startDate+" — "+row.endDate} status={row.status}>
          <div className="tr-button-row">
            <Button size="sm" disabled={!canAct} onClick={()=>void act(()=>kind==="leaves"?api.decideLeave(row.id,"APPROVE",null):kind==="expenses"?api.decideExpense(row.id,"APPROVE",null):api.decideWeeklyTimesheet(row.id,"APPROVE",null),"Approved "+kind)}>Approve</Button>
            <Button size="sm" kind="secondary" disabled={!canAct||!comment.trim()} onClick={()=>void act(()=>kind==="leaves"?api.decideLeave(row.id,"REJECT",comment):kind==="expenses"?api.decideExpense(row.id,"RETURN",comment):api.decideWeeklyTimesheet(row.id,"RETURN",comment),"Returned "+kind)}>Return / reject</Button>
          </div>
        </Entry>):empty}
      </Box>)}
      <Box title="Review notes"><TextArea id="review-comment" labelText="Required for return or rejection" value={comment} onChange={e=>setComment(e.target.value)} maxLength={1000}/></Box>
    </div>:<Box title="Manager approval access required"><p className="tr-detail">The server enforces scoped approval permissions. A field user cannot approve another employee's records.</p></Box>)}

    {mode==="reports"&&<div className="tr-grid-wide">
      <Box title="Daily call reports (DCR)">
        <p className="tr-detail">These reports are returned by the existing validated DCR projection endpoint.</p>
        {dcrs.length?dcrs.map(d=><Entry key={d.id} heading={d.doctorName} detail={d.doctorCode+" · "+d.callOutcome+" · "+new Date(d.submittedAt).toLocaleString()} status="SUBMITTED"/>):empty}
      </Box>
      <Box title="Report availability">
        <p className="tr-detail">This report shows only the call records that the current organization permits you to view. Product detailing and sample quantities remain backed by their existing record APIs, rather than a generated demonstration dataset.</p>
        <Tag type="blue">Live data projection</Tag>
      </Box>
    </div>}
  </div>;
}
