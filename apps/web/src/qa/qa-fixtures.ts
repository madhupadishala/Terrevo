import type {QaState} from "./types";
export const QA_DATE="2026-10-16";
export const IDS={
 org:"qa-org",division:"qa-division",territory:"qa-hyd-central",manager:"mgr-hyd-01",
 reps:["rep-hyd-01","rep-hyd-02","rep-hyd-03","rep-hyd-04","rep-hyd-05"],
 doctors:["doc-01","doc-02","doc-03","doc-04","doc-05"],chemists:["chem-01","chem-02","chem-03","chem-04"],
 stockists:["stock-01","stock-02","stock-03"],products:["prod-01","prod-02","prod-03","prod-04","prod-05"],
 visits:["visit-doc-01","visit-chem-01","visit-stock-01"],
};
export function createBaseQaState():QaState{
 const reps=IDS.reps.map((id,i)=>({id,name:i===0?"Arjun Rao":`QA Rep ${i+1}`,territoryId:IDS.territory,managerId:IDS.manager}));
 return {
  scenario:"NORMAL_DAY",
  organization:{id:IDS.org,name:"QA Pharma"},division:{id:IDS.division,name:"Hyderabad Division"},
  territory:{id:IDS.territory,name:"Hyderabad Central Territory"},manager:{id:IDS.manager,name:"Meera Sharma"},reps,
  doctors:[
   {id:"doc-01",code:"DR001",name:"Dr. Ananya Rao",specialty:"Cardiology",qualification:"MD",territoryId:IDS.territory,category:"A",status:"ACTIVE"},
   {id:"doc-02",code:"DR002",name:"Dr. Vikram Reddy",specialty:"Diabetology",qualification:"MD",territoryId:IDS.territory,category:"A",status:"ACTIVE"},
   {id:"doc-03",code:"DR003",name:"Dr. Nisha Kumar",specialty:"General Medicine",qualification:"MD",territoryId:IDS.territory,category:"B",status:"ACTIVE"},
   {id:"doc-04",code:"DR004",name:"Dr. Farhan Ali",specialty:"Pulmonology",qualification:"MD",territoryId:IDS.territory,category:"B",status:"ACTIVE"},
   {id:"doc-05",code:"DR005",name:"Dr. Sneha Iyer",specialty:"Pediatrics",qualification:"DCH",territoryId:IDS.territory,category:"C",status:"ACTIVE"},
  ],
  chemists:[
   {id:"chem-01",code:"CH001",name:"Central Care Pharmacy",territoryId:IDS.territory,status:"ACTIVE"},
   {id:"chem-02",code:"CH002",name:"Apollo Corner Pharmacy",territoryId:IDS.territory,status:"ACTIVE"},
   {id:"chem-03",code:"CH003",name:"Banjara Medicals",territoryId:IDS.territory,status:"ACTIVE"},
   {id:"chem-04",code:"CH004",name:"Madhapur Wellness",territoryId:IDS.territory,status:"ACTIVE"},
  ],
  stockists:[
   {id:"stock-01",code:"ST001",name:"Metro Pharma Distributors",territoryId:IDS.territory,status:"ACTIVE"},
   {id:"stock-02",code:"ST002",name:"Deccan Drug House",territoryId:IDS.territory,status:"ACTIVE"},
   {id:"stock-03",code:"ST003",name:"Hyderabad Medical Agencies",territoryId:IDS.territory,status:"ACTIVE"},
  ],
  products:IDS.products.map((id,i)=>({id,code:`PR00${i+1}`,name:["Terrevo Test Brand","Brand-B","Cardio Plus","Glyco Safe","Respira"][i],divisionId:IDS.division,status:"ACTIVE"})),
  links:[
   {id:"link-dc-01",doctorId:"doc-01",chemistId:"chem-01",type:"DOCTOR_CHEMIST"},
   {id:"link-dc-02",doctorId:"doc-02",chemistId:"chem-02",type:"DOCTOR_CHEMIST"},
   {id:"link-cs-01",chemistId:"chem-01",stockistId:"stock-01",type:"CHEMIST_STOCKIST"},
   {id:"link-cs-02",chemistId:"chem-02",stockistId:"stock-02",type:"CHEMIST_STOCKIST"},
  ],
  clmAssets:[
   {id:"CLM-001",code:"CLM-001",title:"Core Brand Aid",version:"3.0",productIds:["prod-01"],category:"Brand Aid",status:"APPROVED",effectiveFrom:"2026-01-01",expiresAt:"2027-12-31",slides:Array.from({length:6},(_,i)=>({id:`CLM-001-S${i+1}`,title:`Core Brand Slide ${i+1}`,body:`Approved scientific message ${i+1}`}))},
   {id:"CLM-002",code:"CLM-002",title:"Patient Education Deck",version:"1.0",productIds:["prod-01","prod-02"],category:"Patient Education",status:"APPROVED",effectiveFrom:"2026-01-01",expiresAt:"2027-12-31",slides:Array.from({length:3},(_,i)=>({id:`CLM-002-S${i+1}`,title:`Patient Education ${i+1}`,body:`Approved patient education content ${i+1}`}))},
   {id:"CLM-003",code:"CLM-003",title:"Legacy Aid",version:"1.4",productIds:["prod-03"],category:"Brand Aid",status:"EXPIRED",effectiveFrom:"2024-01-01",expiresAt:"2025-12-31",slides:[{id:"CLM-003-S1",title:"Legacy",body:"Expired content"}]},
   {id:"CLM-004",code:"CLM-004",title:"Safety Alert",version:"2.0",productIds:["prod-04"],category:"Safety",status:"WITHDRAWN",effectiveFrom:"2026-01-01",slides:[{id:"CLM-004-S1",title:"Withdrawn safety communication",body:"Withdrawn content"}]},
  ],
  clmSessions:[],
  inventory:[
   {id:"SMP-01",code:"SMP-01",name:"Test Sample",kind:"SAMPLE",productId:"prod-01",allocatedQty:100,distributedQty:22,availableQty:78,lot:"LOT-A",expiresAt:"2027-06-30"},
   {id:"SMP-02",code:"SMP-02",name:"Brand-B Sample",kind:"SAMPLE",productId:"prod-02",allocatedQty:50,distributedQty:10,availableQty:40,lot:"LOT-B",expiresAt:"2027-03-31"},
   {id:"KIT-01",code:"KIT-01",name:"Education Kit",kind:"INPUT",allocatedQty:20,distributedQty:4,availableQty:16},
   {id:"PAD-01",code:"PAD-01",name:"Reminder Pad",kind:"GIFT",allocatedQty:30,distributedQty:12,availableQty:18},
  ],
  distributions:[],
  visits:[
   {id:"visit-doc-01",repId:"rep-hyd-01",customerType:"DOCTOR",customerId:"doc-01",territoryId:IDS.territory,plannedAt:QA_DATE+"T09:00:00+05:30",status:"PLANNED",clmSessionIds:[],sampleDistributionIds:[],rcpaIds:[],pobIds:[]},
   {id:"visit-chem-01",repId:"rep-hyd-01",customerType:"CHEMIST",customerId:"chem-01",territoryId:IDS.territory,plannedAt:QA_DATE+"T11:00:00+05:30",status:"PLANNED",clmSessionIds:[],sampleDistributionIds:[],rcpaIds:[],pobIds:[]},
   {id:"visit-stock-01",repId:"rep-hyd-01",customerType:"STOCKIST",customerId:"stock-01",territoryId:IDS.territory,plannedAt:QA_DATE+"T14:00:00+05:30",status:"PLANNED",clmSessionIds:[],sampleDistributionIds:[],rcpaIds:[],pobIds:[]},
  ],
  rcpa:[],pob:[],
  nca:[
   {id:"nca-01",repId:"rep-hyd-01",category:"MEETING",town:"Hyderabad",date:"2026-10-10",durationMinutes:60,reason:"Monthly review",remarks:"Team review",status:"APPROVED"},
   {id:"nca-02",repId:"rep-hyd-02",category:"TRAINING",town:"Madhapur",date:QA_DATE,durationMinutes:90,reason:"Product training",remarks:"Awaiting manager",status:"SUBMITTED"},
  ],
  attendance:[
   ...Array.from({length:12},(_,i)=>({id:`att-hist-${i+1}`,repId:"rep-hyd-01",date:`2026-10-${String(i+1).padStart(2,"0")}`,status:(i===4?"SHORT_DAY":i===8?"FIELD_DAY":"PRESENT") as "PRESENT"|"SHORT_DAY"|"FIELD_DAY",workedMinutes:i===4?360:i===8?420:480+(i%3)*10,requiredMinutes:480})),
   {id:"att-14",repId:"rep-hyd-01",date:"2026-10-14",status:"PRESENT",workedMinutes:490,requiredMinutes:480},
   {id:"att-15",repId:"rep-hyd-01",date:"2026-10-15",status:"SHORT_DAY",workedMinutes:360,requiredMinutes:480},
   {id:"att-16",repId:"rep-hyd-01",date:QA_DATE,status:"FIELD_DAY",workedMinutes:120,requiredMinutes:480},
  ],
  leaves:[
   {id:"leave-01",repId:"rep-hyd-03",from:"2026-10-20",to:"2026-10-20",type:"FULL_DAY",reason:"Personal",status:"SUBMITTED"},
   {id:"leave-02",repId:"rep-hyd-01",from:"2026-10-03",to:"2026-10-03",type:"HALF_DAY",reason:"Appointment",status:"APPROVED"},
   {id:"leave-03",repId:"rep-hyd-04",from:"2026-10-07",to:"2026-10-07",type:"FULL_DAY",reason:"Personal",status:"REJECTED"},
  ],
  expenses:[
   {id:"exp-01",repId:"rep-hyd-01",date:QA_DATE,category:"TRAVEL",amount:450,currency:"INR",status:"DRAFT"},
   {id:"exp-02",repId:"rep-hyd-02",date:"2026-10-15",category:"FOOD",amount:300,currency:"INR",status:"SUBMITTED"},
   {id:"exp-03",repId:"rep-hyd-03",date:"2026-10-14",category:"LODGING",amount:2200,currency:"INR",status:"APPROVED"},
   {id:"exp-04",repId:"rep-hyd-01",date:"2026-10-05",category:"FOOD",amount:280,currency:"INR",status:"APPROVED"},
   {id:"exp-05",repId:"rep-hyd-01",date:"2026-10-06",category:"LOCAL_CONVEYANCE",amount:190,currency:"INR",status:"APPROVED"},
   {id:"exp-06",repId:"rep-hyd-01",date:"2026-10-08",category:"TRAVEL",amount:510,currency:"INR",status:"SUBMITTED"},
   {id:"exp-07",repId:"rep-hyd-01",date:"2026-10-09",category:"FOOD",amount:325,currency:"INR",status:"APPROVED"},
   {id:"exp-08",repId:"rep-hyd-01",date:"2026-10-12",category:"LOCAL_CONVEYANCE",amount:220,currency:"INR",status:"APPROVED"},
  ],
  timesheets:[
   {id:"ts-01",repId:"rep-hyd-01",weekStart:"2026-10-12",days:[{date:"2026-10-12",hours:8},{date:"2026-10-13",hours:8},{date:"2026-10-14",hours:8},{date:"2026-10-15",hours:6},{date:QA_DATE,hours:2}],status:"DRAFT"},
   {id:"ts-02",repId:"rep-hyd-02",weekStart:"2026-10-12",days:[{date:"2026-10-12",hours:8}],status:"SUBMITTED"},
   {id:"ts-03",repId:"rep-hyd-01",weekStart:"2026-10-05",days:[{date:"2026-10-05",hours:8},{date:"2026-10-06",hours:8},{date:"2026-10-07",hours:8},{date:"2026-10-08",hours:8},{date:"2026-10-09",hours:8}],status:"APPROVED"},
   {id:"ts-04",repId:"rep-hyd-01",weekStart:"2026-09-28",days:[{date:"2026-10-01",hours:8},{date:"2026-10-02",hours:8}],status:"APPROVED"},
  ],
  tourPlans:reps.map((r,i)=>({id:`tour-${i+1}`,repId:r.id,date:QA_DATE,status:i===4?"SUBMITTED":"APPROVED",plannedVisitIds:i===0?[...IDS.visits]:[]})),
  gpsExceptions:[{id:"gps-01",repId:"rep-hyd-04",visitId:"visit-doc-01",distanceMeters:412,reason:"Clinic relocated",status:"SUBMITTED"}],
  dcrs:[],
 };
}
