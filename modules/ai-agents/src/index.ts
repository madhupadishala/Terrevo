/**
 * Terrevo V3.2 shared AI agent layer.
 *
 * This is the zero-cost deterministic baseline required by the handoff. It never
 * writes business data, never trusts tenant/actor/role scope from browser input,
 * and never fabricates facts. Server adapters must supply already-authorized
 * source records and evidence references.
 */
export type AgentId =
  | "AI-01" | "AI-02" | "AI-03" | "AI-04" | "AI-05"
  | "AI-06" | "AI-07" | "AI-08" | "AI-09" | "AI-10"
  | "AI-11" | "AI-12" | "AI-13" | "AI-14" | "AI-15";

export type AgentState = "completed" | "needs_review" | "insufficient_evidence" | "denied" | "failed";
export type AgentRole = "MR" | "MANAGER" | "TENANT_ADMIN" | "FINANCE";
export type EvidenceRef = {
  source_type: string;
  source_id: string;
  record_version?: string;
  observed_at?: string;
  field_paths?: string[];
};
export type AgentRequest = {
  contract_version: "1.0";
  agent_id: AgentId;
  request_id: string;
  input: Record<string, unknown>;
  subject?: { kind: string; id: string };
  requested_as_of?: string;
};
export type AgentError = {
  code:
    | "DENIED" | "INVALID_INPUT" | "NO_EVIDENCE" | "STALE_CONTEXT"
    | "TOOL_UNAVAILABLE" | "TIMEOUT" | "MODEL_UNAVAILABLE"
    | "POLICY_BLOCKED" | "INTERNAL_ERROR";
  recoverable: boolean;
  message: string;
};
export type AgentOutput<T = Record<string, unknown>> = {
  contract_version: "1.0";
  agent_id: AgentId;
  agent_version: string;
  request_id: string;
  run_id: string;
  state: AgentState;
  result: T | null;
  evidence: EvidenceRef[];
  warnings: string[];
  limitations: string[];
  requires_human_confirmation: boolean;
  audit: {
    ruleset_version: string;
    model_id?: string;
    prompt_hash?: string;
    execution_ms: number;
    tokens_in?: number;
    tokens_out?: number;
    tool_call_ids: string[];
    data_as_of: string;
  };
  error?: AgentError;
};

export type AgentContext = {
  tenantId: string;
  actorId: string;
  roles: AgentRole[];
  /** Optional strict evidence allowlist resolved by the server adapter. */
  allowedSourceIds?: ReadonlySet<string>;
  now?: string;
};

export type AgentDefinition = {
  id: AgentId;
  name: string;
  priority: "P1" | "P2";
  allowedRoles: readonly AgentRole[];
  authoritativeDatasets: readonly string[];
  resultKeys: readonly string[];
};

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {id:"AI-01",name:"Daily Briefing",priority:"P1",allowedRoles:["MR","MANAGER"],authoritativeDatasets:["tasks","approved_tours","activity_events","territory_calendar"],resultKeys:["priorities","missed_commitments","summary"]},
  {id:"AI-02",name:"Tour Planning",priority:"P1",allowedRoles:["MR","MANAGER"],authoritativeDatasets:["customer_master","frequency_rules","approved_availability","territory_assignments","travel_constraints"],resultKeys:["proposed_visits","constraint_violations","feasibility"]},
  {id:"AI-03",name:"Pre-Call Intelligence",priority:"P1",allowedRoles:["MR"],authoritativeDatasets:["customer_profile","authorized_history","open_commitments","approved_product_materials"],resultKeys:["briefing_sections","last_contact_at","open_actions","approved_material_ids","evidence_ids"]},
  {id:"AI-04",name:"Smart DCR",priority:"P1",allowedRoles:["MR"],authoritativeDatasets:["verified_visit_events","tour_plan","nca","inventory_movements","order_events","timesheet"],resultKeys:["draft_sections","reconciliation","warnings","source_event_ids"]},
  {id:"AI-05",name:"Manager Intelligence",priority:"P1",allowedRoles:["MANAGER"],authoritativeDatasets:["authorized_team_members","visit_aggregates","plans","approvals","targets"],resultKeys:["insights","exceptions","recommended_reviews"]},
  {id:"AI-06",name:"Compliance Guardian",priority:"P1",allowedRoles:["MANAGER","TENANT_ADMIN"],authoritativeDatasets:["policy_versions","permissions","geo_evidence","event_timestamps","claims","call_events"],resultKeys:["findings","manual_review_ids"]},
  {id:"AI-07",name:"RCPA Intelligence",priority:"P2",allowedRoles:["MR","MANAGER"],authoritativeDatasets:["submitted_rcpa","product_master","competitors","reporting_periods"],resultKeys:["trends","limitations","suggested_checks"]},
  {id:"AI-08",name:"Customer Relationship",priority:"P2",allowedRoles:["MR","MANAGER"],authoritativeDatasets:["customer_master","verified_visit_history","followup_tasks","authorized_links"],resultKeys:["engagement_gaps","followup_suggestions","link_warnings"]},
  {id:"AI-09",name:"CLM Intelligence",priority:"P2",allowedRoles:["MR"],authoritativeDatasets:["approved_clm_assets","product_master","region","channel","validity","audience"],resultKeys:["suggestions","excluded_asset_reasons"]},
  {id:"AI-10",name:"Expense Audit",priority:"P2",allowedRoles:["MANAGER","FINANCE"],authoritativeDatasets:["expense_claims","receipts_metadata","travel_policy_versions","previous_claims"],resultKeys:["flags","possible_duplicates","reviewer_questions"]},
  {id:"AI-11",name:"Inventory Intelligence",priority:"P2",allowedRoles:["MR","MANAGER","TENANT_ADMIN"],authoritativeDatasets:["sample_stock_movements","product_master","allocations","usage_history"],resultKeys:["forecasts","exceptions","reorder_suggestions"]},
  {id:"AI-12",name:"Sales Opportunity",priority:"P2",allowedRoles:["MANAGER"],authoritativeDatasets:["authorized_orders","products","territories","customer_coverage","historic_targets"],resultKeys:["opportunities","caveats"]},
  {id:"AI-13",name:"Follow-up Action",priority:"P2",allowedRoles:["MR"],authoritativeDatasets:["authorized_call_notes","visit_id","customer_id","timestamp"],resultKeys:["draft_actions","ambiguous_items"]},
  {id:"AI-14",name:"Field Data Quality",priority:"P1",allowedRoles:["TENANT_ADMIN","MANAGER"],authoritativeDatasets:["master_records","call_events","unique_constraints","territory_links"],resultKeys:["issues","merge_candidates"]},
  {id:"AI-15",name:"Analytics Assistant",priority:"P2",allowedRoles:["MR","MANAGER","TENANT_ADMIN"],authoritativeDatasets:["approved_metric_catalog","reporting_views","query","reporting_period"],resultKeys:["answer","metrics","data_as_of","limitations","chart_spec"]},
] as const;

const definitions = new Map(AGENT_REGISTRY.map(d => [d.id, d]));
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function validEvidence(value: unknown, allowed?: ReadonlySet<string>): EvidenceRef[] {
  return asArray(value).flatMap(item => {
    const row = asRecord(item);
    if (!row) return [];
    const source_type = asString(row.source_type);
    const source_id = asString(row.source_id);
    if (!source_type || !source_id || (allowed && !allowed.has(source_id))) return [];
    const ref: EvidenceRef = {source_type, source_id};
    const version = asString(row.record_version); if (version) ref.record_version = version;
    const observed = asString(row.observed_at); if (observed) ref.observed_at = observed;
    if (Array.isArray(row.field_paths) && row.field_paths.every(v => typeof v === "string")) ref.field_paths = row.field_paths as string[];
    return [ref];
  });
}

function selectResult(id: AgentId, input: Record<string, unknown>, dataAsOf: string): Record<string, unknown> {
  switch (id) {
    case "AI-01": return {priorities:asArray(input.priorities),missed_commitments:asArray(input.missed_commitments),summary:asString(input.summary)??""};
    case "AI-02": return {proposed_visits:asArray(input.proposed_visits),constraint_violations:asArray(input.constraint_violations),feasibility:asString(input.feasibility)??"unknown"};
    case "AI-03": return {briefing_sections:asArray(input.briefing_sections),last_contact_at:asString(input.last_contact_at),open_actions:asArray(input.open_actions),approved_material_ids:asArray(input.approved_material_ids).filter(v=>typeof v==="string"),evidence_ids:asArray(input.evidence_ids).filter(v=>typeof v==="string")};
    case "AI-04": return {draft_sections:asArray(input.draft_sections),reconciliation:asArray(input.reconciliation),warnings:asArray(input.warnings).filter(v=>typeof v==="string"),source_event_ids:asArray(input.source_event_ids).filter(v=>typeof v==="string")};
    case "AI-05": return {insights:asArray(input.insights),exceptions:asArray(input.exceptions),recommended_reviews:asArray(input.recommended_reviews)};
    case "AI-06": return {findings:asArray(input.findings),manual_review_ids:asArray(input.manual_review_ids).filter(v=>typeof v==="string")};
    case "AI-07": return {trends:asArray(input.trends),limitations:asArray(input.limitations).filter(v=>typeof v==="string"),suggested_checks:asArray(input.suggested_checks)};
    case "AI-08": return {engagement_gaps:asArray(input.engagement_gaps),followup_suggestions:asArray(input.followup_suggestions),link_warnings:asArray(input.link_warnings)};
    case "AI-09": return {suggestions:asArray(input.suggestions),excluded_asset_reasons:asArray(input.excluded_asset_reasons)};
    case "AI-10": return {flags:asArray(input.flags),possible_duplicates:asArray(input.possible_duplicates),reviewer_questions:asArray(input.reviewer_questions)};
    case "AI-11": return {forecasts:asArray(input.forecasts),exceptions:asArray(input.exceptions),reorder_suggestions:asArray(input.reorder_suggestions)};
    case "AI-12": return {opportunities:asArray(input.opportunities),caveats:asArray(input.caveats)};
    case "AI-13": return {draft_actions:asArray(input.draft_actions),ambiguous_items:asArray(input.ambiguous_items)};
    case "AI-14": return {issues:asArray(input.issues),merge_candidates:asArray(input.merge_candidates)};
    case "AI-15": return {answer:asString(input.answer)??"",metrics:asArray(input.metrics),data_as_of:asString(input.data_as_of)??dataAsOf,limitations:asArray(input.limitations).filter(v=>typeof v==="string"),chart_spec:asRecord(input.chart_spec)};
  }
}

function nonEmpty(result: Record<string, unknown>): boolean {
  return Object.values(result).some(value =>
    Array.isArray(value) ? value.length > 0 :
    typeof value === "string" ? value.trim().length > 0 && value !== "unknown" :
    value !== null && value !== undefined
  );
}

function baseOutput<T>(request: AgentRequest, started: number, dataAsOf: string, patch: Partial<AgentOutput<T>>): AgentOutput<T> {
  return {
    contract_version:"1.0",
    agent_id:request.agent_id,
    agent_version:"1.0.0",
    request_id:request.request_id,
    run_id:crypto.randomUUID(),
    state:"failed",
    result:null,
    evidence:[],
    warnings:[],
    limitations:["Deterministic baseline only; no external model or autonomous business action is used."],
    requires_human_confirmation:true,
    audit:{ruleset_version:"terrevo-ai-v1",execution_ms:Math.max(0,Date.now()-started),tool_call_ids:[],data_as_of:dataAsOf},
    ...patch,
  };
}

export function getAgentDefinition(id: AgentId): AgentDefinition {
  const definition = definitions.get(id);
  if (!definition) throw new Error("Unknown Terrevo agent");
  return definition;
}

/**
 * Runs the deterministic baseline over a server-authorized evidence bundle.
 * The function intentionally performs no database/API writes and no external calls.
 */
export function runAgent(request: AgentRequest, context: AgentContext): AgentOutput {
  const started = Date.now();
  const dataAsOf = request.requested_as_of ?? context.now ?? new Date().toISOString();
  if (request.contract_version !== "1.0" || !asString(request.request_id) || !asRecord(request.input)) {
    return baseOutput(request,started,dataAsOf,{state:"failed",error:{code:"INVALID_INPUT",recoverable:false,message:"Agent request failed contract validation."}});
  }
  const definition = definitions.get(request.agent_id);
  if (!definition) return baseOutput(request,started,dataAsOf,{state:"failed",error:{code:"INVALID_INPUT",recoverable:false,message:"Unknown agent id."}});
  if (!context.tenantId || !context.actorId || !context.roles.some(role=>definition.allowedRoles.includes(role))) {
    return baseOutput(request,started,dataAsOf,{state:"denied",error:{code:"DENIED",recoverable:false,message:"Actor is not authorized for this agent."}});
  }

  const evidence = validEvidence(request.input.evidence, context.allowedSourceIds);
  if (!evidence.length) {
    return baseOutput(request,started,dataAsOf,{
      state:"insufficient_evidence",
      evidence:[],
      warnings:["No authorized evidence references were supplied."],
      error:{code:"NO_EVIDENCE",recoverable:true,message:"Authoritative source evidence is required before an agent result can be produced."},
    });
  }

  const result = selectResult(request.agent_id, request.input, dataAsOf);
  if (!nonEmpty(result)) {
    return baseOutput(request,started,dataAsOf,{
      state:"insufficient_evidence", evidence,
      warnings:["Authorized evidence exists, but the requested result fields contain no supported observations."],
      error:{code:"NO_EVIDENCE",recoverable:true,message:"No supported observations were available for this request."},
    });
  }

  return baseOutput(request,started,dataAsOf,{
    state:"needs_review",
    result,
    evidence,
    warnings:[],
    limitations:["Deterministic baseline only; suggestions require normal Terrevo validation and human confirmation before any business write."],
    requires_human_confirmation:true,
  });
}
