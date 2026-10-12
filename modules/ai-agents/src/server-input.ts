import type {AgentId,EvidenceRef} from "./index.ts";

export type AgentSnapshots={
  startOptions?:Array<Record<string,unknown>>;
  doctors?:Array<Record<string,unknown>>;
  doctorCall?:Record<string,unknown>|null;
  expenseClaims?:Array<Record<string,unknown>>;
  expensePolicies?:Array<Record<string,unknown>>;
  dcrs?:Array<Record<string,unknown>>;
  analytics?:Record<string,unknown>|null;
  rcpa?:Record<string,unknown>|null;
  clmAssets?:Array<Record<string,unknown>>;
  inventory?:Array<Record<string,unknown>>;
  masters?:Record<string,Array<Record<string,unknown>>>;
};

const text=(v:unknown)=>typeof v==="string"&&v.trim()?v.trim():null;
const num=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
const evidence=(source_type:string,source_id:string,field_paths?:string[]):EvidenceRef=>({source_type,source_id,...(field_paths?.length?{field_paths}:{})});
const rows=(v:unknown):Array<Record<string,unknown>>=>Array.isArray(v)?v.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)) as Array<Record<string,unknown>>:[];

export function buildDeterministicAgentInput(id:AgentId,s:AgentSnapshots):Record<string,unknown>{
 switch(id){
  case "AI-01":{
   const options=rows(s.startOptions);
   const ev=options.flatMap(o=>{const source=text(o.planDayId);return source?[evidence("approved_tour_day",source,["workDate","territoryId"])]:[]});
   return {evidence:ev,priorities:options.flatMap(o=>{const task_id=text(o.planDayId),date=text(o.workDate);return task_id&&date?[{task_id,reason:"Approved tour day is available for execution.",due_at:date+"T23:59:59+05:30",urgency:"normal",evidence_ids:[task_id]}]:[]}),missed_commitments:[],summary:options.length?String(options.length)+" approved tour day(s) available.":""};
  }
  case "AI-02":{
   const options=rows(s.startOptions),doctors=rows(s.doctors);
   const optionByTerritory=new Map(options.flatMap(o=>{const territory=text(o.territoryId),id=text(o.planDayId),date=text(o.workDate);return territory&&id&&date?[[territory,{id,date}]]:[]}));
   const proposed_visits=doctors.flatMap(d=>{const id=text(d.id),territory=text(d.territoryId),frequency=num(d.visitFrequency)??1,day=territory?optionByTerritory.get(territory):undefined;if(!id||!territory||!day)return[];return [{customer_id:id,customer_type:"doctor",territory_id:territory,proposed_work_date:day.date,visit_frequency:frequency,reason:"Controlled doctor master matches an approved tour-day territory.",evidence_ids:[id,day.id]}];});
   const ev=[...options.flatMap(o=>{const id=text(o.planDayId);return id?[evidence("approved_tour_day",id,["workDate","territoryId"])]:[]}),...doctors.flatMap(d=>{const id=text(d.id);return id?[evidence("doctor_master",id,["territoryId","visitFrequency"])]:[]})];
   return {evidence:ev,proposed_visits,constraint_violations:[],feasibility:proposed_visits.length?"requires_human_review":"unknown"};
  }
  case "AI-13":{
   const call=s.doctorCall&&typeof s.doctorCall==="object"?s.doctorCall:null;const id=call?text(call.id):null;const action=call?text(call.nextAction):null;
   return {evidence:id?[evidence("doctor_call",id,["nextAction","callOutcome","updatedAt"])]:[],draft_actions:id&&action?[{title:action,source_call_id:id,evidence_ids:[id]}]:[],ambiguous_items:id&&!action?["No explicit next action was recorded in the doctor call."]:[]};
  }
  case "AI-04":{
   const dcrs=rows(s.dcrs);
   const ev=dcrs.flatMap(d=>{const id=text(d.id);return id?[evidence("dcr",id,["callOutcome","submittedAt"])]:[]});
   return {evidence:ev,draft_sections:dcrs.flatMap(d=>{const id=text(d.id),outcome=text(d.callOutcome);return id&&outcome?[{section:"verified_doctor_call",text:outcome,evidence_ids:[id]}]:[]}),reconciliation:[],warnings:[],source_event_ids:ev.map(x=>x.source_id)};
  }
  case "AI-05":{
   const a=s.analytics&&typeof s.analytics==="object"?s.analytics:null;if(!a)return {evidence:[],insights:[],exceptions:[],recommended_reviews:[]};
   const tours=(a.tours&&typeof a.tours==="object"?a.tours:{}) as Record<string,unknown>;
   const coverage=(a.coverage&&typeof a.coverage==="object"?a.coverage:{}) as Record<string,unknown>;
   const source="manager-analytics";
   const metrics:[string,unknown][]=[["submitted_tours",tours.submitted],["planned_stops",coverage.plannedStops],["completed_visits",coverage.completedVisits],["doctor_calls",coverage.doctorCalls]];
   const insights=metrics.flatMap(([metric_id,value])=>num(value)!==null?[{metric_id,observed:value,baseline:null,explanation:"Server-computed scoped metric.",evidence_ids:[source]}]:[]);
   return {evidence:insights.length?[evidence("manager_analytics",source)]:[],insights,exceptions:[],recommended_reviews:[]};
  }
  case "AI-07":{
   const r=s.rcpa&&typeof s.rcpa==="object"?s.rcpa:null;const id=r?text(r.id):null;const lines=r?rows(r.lines):[];
   const trends=lines.flatMap(line=>{const brand=text(line.productId)??text(line.competitorBrand),value=num(line.prescriptionCount)??num(line.salesQuantity)??num(line.stockQuantity);return brand&&value!==null&&id?[{brand_id:brand,metric:"current_visit_observation",period:"current_visit",value,sample_size:1,evidence_ids:[id]}]:[]});
   return {evidence:id?[evidence("rcpa",id)]:[],trends,limitations:["Single-visit observations are not longitudinal trends."],suggested_checks:[]};
  }
  case "AI-09":{
   const assets=rows(s.clmAssets);const today=new Date().toISOString().slice(0,10);
   const approved=assets.filter(a=>{const effective=text(a.effectiveFrom),expires=text(a.expiresAt);return a.status==="APPROVED"&&(!effective||effective<=today)&&(!expires||expires>=today);});
   const ev=approved.flatMap(a=>{const id=text(a.id);return id?[evidence("approved_clm_asset",id,["version","productIds","regionCodes"])]:[]});
   const suggestions=approved.flatMap(a=>{const id=text(a.id),version=text(a.version);if(!id||!version)return[];const products=Array.isArray(a.productIds)?a.productIds.filter(x=>typeof x==="string") as string[]:[];const regions=Array.isArray(a.regionCodes)?a.regionCodes.filter(x=>typeof x==="string") as string[]:["GLOBAL"];return products.flatMap(product_id=>regions.map(region=>({asset_id:id,asset_version:version,product_id,region,reason:"Currently approved server-visible CLM asset.",evidence_ids:[id]})));});
   return {evidence:ev,suggestions,excluded_asset_reasons:[]};
  }
  case "AI-10":{
   const claims=rows(s.expenseClaims),policies=rows(s.expensePolicies);
   const ev:EvidenceRef[]=[];const flags:Array<Record<string,unknown>>=[];const possible_duplicates:Array<Record<string,unknown>>=[];const reviewer_questions:Array<Record<string,unknown>>=[];
   const policyFor=(category:string,currency:string,day:string)=>policies.find(p=>text(p.category)===category&&text(p.currency)===currency&&text(p.effectiveFrom)!<=day&&text(p.expiresAt)!>=day);
   const seen=new Map<string,string>();
   for(const claim of claims){const claimId=text(claim.id),owner=text(claim.ownerUserId),day=text(claim.workDate),currency=text(claim.currencyCode);if(!claimId||!owner||!day||!currency)continue;ev.push(evidence("expense_claim",claimId,["workDate","currencyCode","lines","status"]));
    for(const line of rows(claim.lines)){const category=text(line.category),amount=num(line.amount),sequence=num(line.sequence);if(!category||amount===null||sequence===null)continue;const policy=policyFor(category,currency,day);if(policy){const maxMinor=num(policy.maxMinor),policyId=text(policy.policyId);if(policyId)ev.push(evidence("expense_policy",policyId,["category","maxMinor","currency","effectiveFrom","expiresAt"]));if(maxMinor!==null&&Math.round(amount*100)>maxMinor)flags.push({claim_id:claimId,line_sequence:sequence,rule_id:"POLICY_LIMIT_EXCEEDED",observed_minor:Math.round(amount*100),limit_minor:maxMinor,evidence_ids:[claimId,...(policyId?[policyId]:[])]});}
      const key=[owner,day,currency,category,Math.round(amount*100)].join("|");const prior=seen.get(key);if(prior&&prior!==claimId)possible_duplicates.push({claim_ids:[prior,claimId],reason:"Same employee/date/category/amount",evidence_ids:[prior,claimId]});else seen.set(key,claimId);
    }
   }
   if(flags.length||possible_duplicates.length)reviewer_questions.push({question:"Review the flagged claims against receipts and travel evidence before deciding.",evidence_ids:[...new Set([...flags.flatMap(x=>x.evidence_ids as string[]),...possible_duplicates.flatMap(x=>x.evidence_ids as string[])])]});
   return {evidence:ev,flags,possible_duplicates,reviewer_questions};
  }
  case "AI-11":{
   const balances=rows(s.inventory);const ev=balances.flatMap(b=>{const id=text(b.id);return id?[evidence("inventory_balance",id,["itemType","itemId","quantity"])]:[]});
   return {evidence:ev,forecasts:[],exceptions:[],reorder_suggestions:[]};
  }
  case "AI-14":{
   const groups=s.masters??{};const ev:EvidenceRef[]=[];const issues:Array<Record<string,unknown>>=[];const merge_candidates:Array<Record<string,unknown>>=[];
   for(const [kind,items] of Object.entries(groups)){const byCode=new Map<string,Array<Record<string,unknown>>>();for(const item of rows(items)){const id=text(item.id),code=text(item.code)?.toLowerCase();if(id)ev.push(evidence("master_record",id,["code","name","status"]));if(code)byCode.set(code,[...(byCode.get(code)??[]),item]);}for(const [code,dupes]of byCode){if(dupes.length<2)continue;const ids=dupes.map(x=>text(x.id)).filter(Boolean) as string[];for(const id of ids)issues.push({record_id:id,rule_id:"DUPLICATE_MASTER_CODE",field_path:"code",severity:"warning",observed:code,suggested_fix:"Review duplicate master code; no automatic merge is permitted.",evidence_ids:ids});merge_candidates.push({kind,record_ids:ids,reason:"Duplicate normalized code",evidence_ids:ids});}}
   return {evidence:ev,issues,merge_candidates};
  }
  case "AI-15":{
   const a=s.analytics&&typeof s.analytics==="object"?s.analytics:null;if(!a)return {evidence:[],answer:"",metrics:[],data_as_of:new Date().toISOString(),limitations:["No authorized reporting data available."],chart_spec:null};
   const tours=(a.tours&&typeof a.tours==="object"?a.tours:{}) as Record<string,unknown>,coverage=(a.coverage&&typeof a.coverage==="object"?a.coverage:{}) as Record<string,unknown>;const source="manager-analytics";
   const metrics=[["submitted_tours",tours.submitted],["completed_visits",coverage.completedVisits],["doctor_calls",coverage.doctorCalls]].flatMap(([metric_id,value])=>num(value)!==null?[{metric_id,value,unit:"count",filters:{period:"7d"},evidence_ids:[source]}]:[]);
   return {evidence:metrics.length?[evidence("manager_analytics",source)]:[],answer:metrics.length?"Authorized 7-day operational metrics are available.":"",metrics,data_as_of:new Date().toISOString(),limitations:["Deterministic scoped metrics only; no free-form SQL is executed."],chart_spec:null};
  }
  default:return {evidence:[]};
 }
}
