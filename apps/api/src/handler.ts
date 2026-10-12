import { createCustomerLinksService, createCustomerLinksPostgrest, BusinessAccessError } from "../../../modules/business-customer-links/src/index.ts";
import { AuthInputError, createIdentityService, readBearerToken } from "../../../modules/identity/src/index.ts";
import { createTenantService, TenantAccessError } from "../../../modules/tenant/src/index.ts";
import { createOrganizationService, OrganizationInputError } from "../../../modules/organization/src/index.ts";
import { AuthorizationError, createRbacService, RbacInputError } from "../../../modules/rbac/src/index.ts";
import { createMastersService, MASTER_KINDS, MasterInputError, type MasterKind } from "../../../modules/masters/src/index.ts";
import { createTourPlanningService, TourPlanConflictError, TourPlanInputError, TourPlanNotFoundError } from "../../../modules/tour-planning/src/index.ts";
import { createTourApprovalService, TourApprovalConflictError, TourApprovalInputError, TourApprovalNotFoundError } from "../../../modules/tour-approval/src/index.ts";
import { createTourExecutionService, TourExecutionConflictError, TourExecutionInputError, TourExecutionNotFoundError } from "../../../modules/tour-execution/src/index.ts";
import { createTourProgressService } from "../../../modules/tour-progress/src/index.ts";
import { createVisitService, VisitConflictError, VisitInputError, VisitNotFoundError } from "../../../modules/visit-execution/src/index.ts";
import { createDoctorCallService, DoctorCallConflictError, DoctorCallInputError, DoctorCallNotFoundError } from "../../../modules/doctor-call/src/index.ts";
import { createInventoryService, InventoryInputError, InventoryNotFoundError } from "../../../modules/inventory/src/index.ts";
import { createSubmitTourService, SubmitTourConflictError, SubmitTourInputError } from "../../../modules/tour-submit/src/index.ts";
import { createDailyTimesheetService, DailyTimesheetConflictError, DailyTimesheetInputError, DailyTimesheetNotFoundError } from "../../../modules/timesheet-daily/src/index.ts";
import { createWeeklyTimesheetService, WeeklyTimesheetConflictError, WeeklyTimesheetInputError, WeeklyTimesheetNotFoundError } from "../../../modules/timesheet-weekly/src/index.ts";
import { createTradeCallService, TradeCallConflictError, TradeCallInputError, TradeCallNotFoundError } from "../../../modules/trade-call/src/index.ts";
import { createRcpaService, RcpaConflictError, RcpaInputError, RcpaNotFoundError } from "../../../modules/rcpa/src/index.ts";
import { createOrderService, OrderConflictError, OrderInputError, OrderNotFoundError } from "../../../modules/orders/src/index.ts";
import { createAttendanceLeaveService, LeaveConflictError, LeaveInputError, LeaveNotFoundError } from "../../../modules/attendance-leave/src/index.ts";
import { createNcaService, NcaInputError, NcaConflictError, NcaNotFoundError } from "../../../modules/nca/src/index.ts";
import {createUnplannedCallService,UnplannedInputError,UnplannedConflictError,UnplannedNotFoundError} from "../../../modules/unplanned-calls/src/index.ts";
import { createExpenseService, ExpenseConflictError, ExpenseInputError, ExpenseNotFoundError } from "../../../modules/expenses/src/index.ts";
import { createJointWorkService, JointWorkConflictError, JointWorkInputError, JointWorkNotFoundError } from "../../../modules/joint-work/src/index.ts";
import { createManagerCommandService } from "../../../modules/manager-command/src/index.ts";
import { AnalyticsInputError, createAnalyticsService } from "../../../modules/analytics/src/index.ts";
import { createSupabaseAdapter, ProviderError, type SupabaseConfig } from "./supabase-adapter.ts";
import { createPlatformAdminService, PlatformForbiddenError, PlatformValidationError, PlatformNotFoundError } from "./platform-admin.ts";
import { readBoundedJsonObject, RequestBodyError } from "../../../modules/security/src/index.ts";
import { AGENT_REGISTRY, runAgent, type AgentId, type AgentRole } from "../../../modules/ai-agents/src/index.ts";
import { buildDeterministicAgentInput, type AgentSnapshots } from "../../../modules/ai-agents/src/server-input.ts";

export type ApiEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TERREVO_ENVIRONMENT?: string;
  VERCEL_ENV?: string;
};

type Deps = {
  fetcher?: typeof fetch;
};

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Returns a no-store JSON response for API contracts. */
function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/** Parses a bounded JSON object request body and rejects non-object payloads. */
async function readJsonObject(request: Request, maxBytes = 8_192): Promise<Record<string, unknown>> {
  return readBoundedJsonObject(request, maxBytes);
}

const MASTER_IMPORT_FIELDS:Record<MasterKind,readonly string[]>={
  employees:["user_id","code","name","designation","org_unit_id","reporting_manager_employee_id"],
  doctors:["code","name","specialty","category","clinic","address","latitude","longitude","visit_frequency","territory_id"],
  products:["code","name","generic_name","division_id"],
  competitors:["code","name","manufacturer","division_id"],
  chemists:["code","name","address","latitude","longitude","territory_id"],
  stockists:["code","name","address","latitude","longitude","territory_id"],
  samples:["code","name","product_id","division_id","unit"],
  gifts:["code","name","division_id","category"],
};
const importKey=(key:string)=>key.replace(/[A-Z]/g,m=>"_"+m.toLowerCase());
function normalizeMasterImportRows(kind:MasterKind,value:unknown):Array<Record<string,unknown>>{
  if(!Array.isArray(value)||value.length<1||value.length>200)throw new ApiError(400,"Import must contain 1 to 200 rows");
  const allowed=new Set(MASTER_IMPORT_FIELDS[kind]);
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new ApiError(400,`Import row ${index+1} must be an object`);
    const row:Record<string,unknown>={};
    for(const [key,val] of Object.entries(raw as Record<string,unknown>)){
      const normalized=importKey(key);
      if(!allowed.has(normalized))throw new ApiError(400,`Unsupported import field ${key}`);
      if(val!==null&&typeof val!=="string"&&typeof val!=="number")throw new ApiError(400,`Invalid import value for ${key}`);
      row[normalized]=val;
    }
    if(typeof row.code!=="string"||!row.code.trim()||typeof row.name!=="string"||!row.name.trim())throw new ApiError(400,`Import row ${index+1} requires code and name`);
    return row;
  });
}

/** Resolves the supported Supabase environment aliases into one provider configuration. */
function requireConfig(env: ApiEnv): SupabaseConfig {
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !publishableKey) {
    throw new ApiError(500, "Identity provider is not configured");
  }
  return {
    url: env.SUPABASE_URL,
    anonKey: publishableKey,
    serviceRoleKey: secretKey,
  };
}

/** Deployment identity is derived from server-owned runtime configuration, never a query/header. */
export function runtimeQualificationProof(env: ApiEnv, tenantId: string) {
  const ref=/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(env.SUPABASE_URL??"")?.[1]??null;
  const isStaging=env.TERREVO_ENVIRONMENT==="staging" &&
    env.VERCEL_ENV!=="production" && ref!==null &&
    ref!=="dfqsnkmmumvjwmvtnlcs";
  return { environment:isStaging?"staging":"unverified", projectRef:ref, tenantId };
}

/** Maps domain and provider failures to stable public API responses. */
function mapError(error: unknown): Response {
  if (error instanceof ApiError || error instanceof RequestBodyError) return json(error.status, { error: error.message });
  if (error instanceof BusinessAccessError) return json(403, { error: "Customer scope denied" });
  if (error instanceof AuthInputError) {
    const status = error.message.includes("Authorization header") ? 401 : 400;
    return json(status, { error: error.message });
  }
  if (error instanceof TenantAccessError) {
    const status = error.message.includes("access denied") ? 403 : 400;
    return json(status, { error: error.message });
  }
  if (error instanceof AuthorizationError || error instanceof PlatformForbiddenError) return json(403, { error: "Permission denied" });
  if (error instanceof PlatformValidationError) return json(400, { error: error.message });
  if (error instanceof PlatformNotFoundError) return json(404, { error: error.message });
  if (error instanceof OrganizationInputError || error instanceof RbacInputError || error instanceof MasterInputError || error instanceof TourPlanInputError || error instanceof TourApprovalInputError || error instanceof TourExecutionInputError || error instanceof VisitInputError || error instanceof DoctorCallInputError || error instanceof InventoryInputError || error instanceof SubmitTourInputError || error instanceof DailyTimesheetInputError || error instanceof WeeklyTimesheetInputError || error instanceof TradeCallInputError || error instanceof RcpaInputError || error instanceof OrderInputError || error instanceof LeaveInputError || error instanceof NcaInputError || error instanceof UnplannedInputError || error instanceof ExpenseInputError || error instanceof JointWorkInputError || error instanceof AnalyticsInputError) {
    return json(400, { error: error.message });
  }
  if (error instanceof TourPlanNotFoundError || error instanceof TourApprovalNotFoundError || error instanceof TourExecutionNotFoundError || error instanceof VisitNotFoundError || error instanceof DoctorCallNotFoundError || error instanceof InventoryNotFoundError || error instanceof DailyTimesheetNotFoundError || error instanceof WeeklyTimesheetNotFoundError || error instanceof TradeCallNotFoundError || error instanceof RcpaNotFoundError || error instanceof OrderNotFoundError || error instanceof LeaveNotFoundError || error instanceof NcaNotFoundError || error instanceof UnplannedNotFoundError || error instanceof ExpenseNotFoundError || error instanceof JointWorkNotFoundError) return json(404, { error: error.message });
  if (error instanceof TourPlanConflictError || error instanceof TourApprovalConflictError || error instanceof TourExecutionConflictError || error instanceof VisitConflictError || error instanceof DoctorCallConflictError || error instanceof SubmitTourConflictError || error instanceof DailyTimesheetConflictError || error instanceof WeeklyTimesheetConflictError || error instanceof TradeCallConflictError || error instanceof RcpaConflictError || error instanceof OrderConflictError || error instanceof LeaveConflictError || error instanceof NcaConflictError || error instanceof UnplannedConflictError || error instanceof ExpenseConflictError || error instanceof JointWorkConflictError) return json(409, { error: error.message });
  if (error instanceof ProviderError) {
    if (error.status === 401 || error.status === 403) return json(401, { error: "Authentication failed" });
    if (error.status === 400) return json(400, { error: "Provider rejected request" });
    if (error.status === 404) return json(404, { error: "Not found" });
    if (error.status === 409) return json(409, { error: "Conflict" });
    return json(502, { error: "Provider request failed" });
  }
  return json(500, { error: "Internal server error" });
}

/** Creates the HTTP API handler with tenant-scoped domain services wired to the provider adapter. */
export function createHandler(env: ApiEnv, deps: Deps = {}) {
  requireConfig(env);
  return (request: Request) => createRequestHandler(env, deps)(request);
}

// Actor state belongs to exactly one request, including concurrent callers of
// the same handler. Only a provider-validated identity can populate it.
function createRequestHandler(env: ApiEnv, deps: Deps) {
  const config = requireConfig(env);
  let trustedActorId: string | null = null;
  const fetcher: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    headers.delete("x-terrevo-actor");
    if (trustedActorId && config.serviceRoleKey && headers.get("apikey") === config.serviceRoleKey &&
        url.origin === new URL(config.url).origin && url.pathname.startsWith("/rest/v1/")) {
      headers.set("x-terrevo-actor", trustedActorId);
    }
    const forwardedHeaders: Record<string,string> = {};
    headers.forEach((value,key)=>{forwardedHeaders[key]=value;});
    return (deps.fetcher ?? fetch)(input, {...init,headers:forwardedHeaders,signal:init?.signal ?? AbortSignal.timeout(10_000),redirect:"error"});
  };
  const adapter = createSupabaseAdapter(config, fetcher);
  const authentication = createIdentityService(adapter.auth);
  const identity = {...authentication, async authenticate(value: string | null) {
    const user = await authentication.authenticate(value);
    trustedActorId = user.id;
    return user;
  }};
  const tenants = createTenantService(adapter.tenants);
  const rbac = createRbacService(adapter.rbac);
  const organization = createOrganizationService(adapter.organization, rbac);
  const masters = createMastersService(adapter.masters, adapter.organization, rbac);
  const tourPlanning = createTourPlanningService(adapter.tourPlanning, rbac);
  const tourApproval = createTourApprovalService(adapter.tourApproval, rbac);
  const tourExecution = createTourExecutionService(adapter.tourExecution, rbac);
  const tourProgress = createTourProgressService(adapter.tourProgress);
  const visits = createVisitService(adapter.visits, rbac);
  const doctorCalls = createDoctorCallService(adapter.doctorCalls);
  const inventory = createInventoryService(adapter.inventory, adapter.masters, rbac);
  const tourSubmit = createSubmitTourService(adapter.tourSubmit);
  const dailyTimesheets = createDailyTimesheetService(adapter.dailyTimesheets);
  const weeklyTimesheets = createWeeklyTimesheetService(adapter.weeklyTimesheets, rbac);
  const tradeCalls = createTradeCallService(adapter.tradeCalls);
  const rcpa = createRcpaService(adapter.rcpa);
  const orders = createOrderService(adapter.orders);
  const attendanceLeave = createAttendanceLeaveService(adapter.attendanceLeave, rbac);
  const nca = createNcaService(adapter.nca,rbac);
  const unplanned = createUnplannedCallService(adapter.unplanned,rbac,adapter.masters);
  const expenses = createExpenseService(adapter.expenses, rbac);
  const jointWork = createJointWorkService(adapter.jointWork, rbac);
  const managerCommand = createManagerCommandService(adapter.managerCommand);
  const analytics = createAnalyticsService(adapter.analytics);
  const platform = createPlatformAdminService(config, fetcher);

  const CLM_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const clmUserHeaders=(token:string)=>({apikey:config.anonKey,authorization:`Bearer ${token}`,accept:"application/json","content-type":"application/json"});
  const clmAdminHeaders=(prefer="return=representation")=>{
    if(!config.serviceRoleKey)throw new ApiError(500,"Server provider key is not configured");
    return {apikey:config.serviceRoleKey,authorization:`Bearer ${config.serviceRoleKey}`,accept:"application/json","content-type":"application/json",prefer};
  };
  const clmText=(value:unknown,name:string,max:number)=>{
    if(typeof value!=="string"||!value.trim()||value.trim().length>max)throw new ApiError(400,`Invalid ${name}`);
    return value.trim();
  };
  const clmUuid=(value:unknown,name:string)=>{
    if(typeof value!=="string"||!CLM_UUID.test(value))throw new ApiError(400,`${name} must be UUID`);
    return value;
  };
  const clmDate=(value:unknown,name:string,nullable=false):string|null=>{
    if((value===null||value===undefined||value==="")&&nullable)return null;
    if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new ApiError(400,`Invalid ${name}`);
    const parsed=new Date(value+"T00:00:00Z");if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new ApiError(400,`Invalid ${name}`);
    return value;
  };
  const mapClmAsset=(row:Record<string,unknown>)=>({
    id:String(row.id),tenantId:String(row.tenant_id),title:String(row.title),category:String(row.category),
    version:String(row.version),status:String(row.status),productIds:Array.isArray(row.product_ids)?row.product_ids.map(String):[],
    regionCodes:Array.isArray(row.region_codes)?row.region_codes.map(String):["GLOBAL"],contentType:String(row.content_type??"slides/text"),
    objectPath:row.object_path==null?null:String(row.object_path),slides:Array.isArray(row.slides)?row.slides:[],
    effectiveFrom:row.effective_from==null?undefined:String(row.effective_from),expiresAt:row.expires_at==null?undefined:String(row.expires_at),
    provenanceId:String(row.provenance_id),approvedBy:row.approved_by==null?"":String(row.approved_by),
    approvedAt:row.approved_at==null?"":String(row.approved_at),
  });
  async function allowedClmRegionCodes(tenantId:string,accessToken:string){
    const units=await organization.listUnits(tenantId,accessToken);
    return new Set(["GLOBAL",...units.filter(x=>x.type==="region"&&x.status==="active").map(x=>x.code)]);
  }
  async function readClmAssets(tenantId:string,accessToken:string){
    const q=new URLSearchParams({select:"id,tenant_id,title,category,version,status,product_ids,region_codes,content_type,object_path,slides,effective_from,expires_at,provenance_id,approved_by,approved_at",tenant_id:`eq.${tenantId}`,order:"title.asc,version.desc",limit:"500"});
    const [response,regions]=await Promise.all([
      fetcher(new URL("/rest/v1/clm_assets?"+q,config.url).toString(),{headers:clmUserHeaders(accessToken),cache:"no-store"}),
      allowedClmRegionCodes(tenantId,accessToken),
    ]);
    if(!response.ok)throw new ProviderError("CLM catalog read failed",response.status);
    return (await response.json() as Array<Record<string,unknown>>).map(mapClmAsset)
      .filter(asset=>asset.regionCodes.some(code=>regions.has(code)));
  }
  const clmStorageHeaders=(contentType?:string):Record<string,string>=>{
    if(!config.serviceRoleKey)throw new ApiError(500,"Server provider key is not configured");
    return {apikey:config.serviceRoleKey,authorization:`Bearer ${config.serviceRoleKey}`,...(contentType?{"content-type":contentType}:{})};
  };
  async function ensureClmBucket(){
    const root=config.url.replace(/\/+$/,"");
    const current=await fetcher(root+"/storage/v1/bucket/clm-assets",{headers:clmStorageHeaders(),cache:"no-store"});
    if(current.ok)return;
    if(current.status!==404)throw new ProviderError("CLM storage bucket check failed",current.status);
    const create=await fetcher(root+"/storage/v1/bucket",{method:"POST",headers:{...clmStorageHeaders("application/json")},body:JSON.stringify({
      id:"clm-assets",name:"clm-assets",public:false,file_size_limit:5_242_880,
      allowed_mime_types:["application/pdf","image/png","image/jpeg","video/mp4","application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    })});
    if(!create.ok&&create.status!==409)throw new ProviderError("CLM storage bucket create failed",create.status);
  }
  async function uploadClmBinary(tenantId:string,assetId:string,body:Record<string,unknown>){
    if(typeof body.binaryBase64!=="string"||!body.binaryBase64) return null;
    const contentType=clmText(body.contentType,"contentType",120);
    const allowed=new Set(["application/pdf","image/png","image/jpeg","video/mp4","application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
    if(!allowed.has(contentType))throw new ApiError(400,"Unsupported CLM binary content type");
    const fileName=clmText(body.fileName,"fileName",180);
    if(!/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(fileName)||fileName.includes(".."))throw new ApiError(400,"Invalid CLM file name");
    if(body.binaryBase64.length>7_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.binaryBase64))throw new ApiError(413,"CLM binary exceeds the supported size or encoding");
    let bytes:Uint8Array;try{const decoded=atob(body.binaryBase64);bytes=Uint8Array.from(decoded,ch=>ch.charCodeAt(0));}catch{throw new ApiError(400,"Invalid CLM binary encoding");}
    if(bytes.byteLength<1||bytes.byteLength>5_242_880)throw new ApiError(413,"CLM binary must be between 1 byte and 5 MB");
    await ensureClmBucket();
    const safe=fileName.replace(/\s+/g,"-"),objectPath=`${tenantId}/${assetId}/${safe}`;
    const response=await fetcher(config.url.replace(/\/+$/,"")+"/storage/v1/object/clm-assets/"+objectPath.split("/").map(encodeURIComponent).join("/"),{
      method:"POST",headers:{...clmStorageHeaders(contentType),"x-upsert":"false"},body:bytes,
    });
    if(!response.ok)throw new ProviderError("CLM binary upload failed",response.status);
    return objectPath;
  }
  async function removeClmBinary(objectPath:string){
    const response=await fetcher(config.url.replace(/\/+$/,"")+"/storage/v1/object/clm-assets/"+objectPath.split("/").map(encodeURIComponent).join("/"),{method:"DELETE",headers:clmStorageHeaders()});
    if(!response.ok&&response.status!==404)throw new ProviderError("CLM binary cleanup failed",response.status);
  }
  async function createClmAsset(tenantId:string,actorId:string,accessToken:string,body:Record<string,unknown>){
    await rbac.authorize(tenantId,"MASTER_MANAGE",null,accessToken);
    const title=clmText(body.title,"title",160),category=clmText(body.category,"category",80),version=clmText(body.version,"version",40);
    const provenanceId=clmText(body.provenanceId,"provenanceId",300);
    if(!Array.isArray(body.productIds)||body.productIds.length<1||body.productIds.length>50)throw new ApiError(400,"productIds must contain 1 to 50 products");
    const productIds=[...new Set(body.productIds.map((x)=>clmUuid(x,"productId")))];
    const regionInput=body.regionCodes??["GLOBAL"];
    if(!Array.isArray(regionInput)||regionInput.length<1||regionInput.length>50)throw new ApiError(400,"regionCodes must contain 1 to 50 entries");
    const regionCodes=[...new Set(regionInput.map(raw=>clmText(raw,"regionCode",40).toUpperCase()))];
    if(regionCodes.some(code=>code!=="GLOBAL"&&!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)))throw new ApiError(400,"Invalid region code");
    const availableRegions=await allowedClmRegionCodes(tenantId,accessToken);
    if(regionCodes.some(code=>code!=="GLOBAL"&&!availableRegions.has(code)))throw new ApiError(400,"Region is not available in the authorized organization hierarchy");
    const rawSlides=body.slides??[];
    if(!Array.isArray(rawSlides)||rawSlides.length>100)throw new ApiError(400,"slides must be an array with at most 100 entries");
    const ids=new Set<string>();
    const slides=rawSlides.map((raw,index)=>{
      if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new ApiError(400,`Invalid slide ${index+1}`);
      const value=raw as Record<string,unknown>;const id=clmText(value.id,"slide id",80);
      if(ids.has(id))throw new ApiError(400,"Duplicate slide id");ids.add(id);
      return {id,title:clmText(value.title,"slide title",160),body:typeof value.body==="string"&&value.body.length<=12000?value.body:(()=>{throw new ApiError(400,"Invalid slide body")})()};
    });
    const hasBinary=typeof body.binaryBase64==="string"&&body.binaryBase64.length>0;
    if(!slides.length&&!hasBinary)throw new ApiError(400,"At least one approved slide or binary document is required");
    const effectiveFrom=clmDate(body.effectiveFrom,"effectiveFrom",true),expiresAt=clmDate(body.expiresAt,"expiresAt",true);
    if(effectiveFrom&&expiresAt&&expiresAt<effectiveFrom)throw new ApiError(400,"expiresAt must be on or after effectiveFrom");
    const assetId=crypto.randomUUID(),objectPath=hasBinary?await uploadClmBinary(tenantId,assetId,body):null;
    const contentType=hasBinary?clmText(body.contentType,"contentType",120):"slides/text";
    const row={id:assetId,tenant_id:tenantId,title,category,version,status:"APPROVED",product_ids:productIds,region_codes:regionCodes,content_type:contentType,object_path:objectPath,slides,effective_from:effectiveFrom,expires_at:expiresAt,
      provenance_id:provenanceId,approved_by:actorId,approved_at:new Date().toISOString()};
    const response=await fetcher(new URL("/rest/v1/clm_assets",config.url).toString(),{method:"POST",headers:clmAdminHeaders(),body:JSON.stringify(row)});
    if(!response.ok){if(objectPath)await removeClmBinary(objectPath).catch(()=>{});throw new ProviderError("CLM asset create failed",response.status);}
    const saved=(await response.json() as Array<Record<string,unknown>>)[0];if(!saved)throw new ApiError(502,"CLM asset was not returned");
    return mapClmAsset(saved);
  }
  async function signClmBinary(tenantId:string,assetId:string,accessToken:string){
    const asset=(await readClmAssets(tenantId,accessToken)).find(x=>x.id===assetId);
    if(!asset||asset.status!=="APPROVED"||!asset.objectPath)throw new ApiError(404,"Authorized CLM binary not found");
    const today=new Date().toISOString().slice(0,10);
    if((asset.effectiveFrom&&asset.effectiveFrom>today)||(asset.expiresAt&&asset.expiresAt<today))throw new ApiError(409,"CLM asset is not currently eligible");
    const response=await fetcher(config.url.replace(/\/+$/,"")+"/storage/v1/object/sign/clm-assets/"+asset.objectPath.split("/").map(encodeURIComponent).join("/"),{
      method:"POST",headers:{...clmStorageHeaders("application/json")},body:JSON.stringify({expiresIn:300}),
    });
    if(!response.ok)throw new ProviderError("CLM signed download failed",response.status);
    const data=await response.json() as Record<string,unknown>,signed=typeof data.signedURL==="string"?data.signedURL:typeof data.signedUrl==="string"?data.signedUrl:null;
    if(!signed)throw new ApiError(502,"Storage provider did not return a signed URL");
    return {url:signed.startsWith("http")?signed:config.url.replace(/\/+$/,"")+"/storage/v1"+signed,expiresIn:300,contentType:asset.contentType};
  }
  async function setClmAssetStatus(tenantId:string,assetId:string,accessToken:string,status:"WITHDRAWN"|"EXPIRED"){
    await rbac.authorize(tenantId,"MASTER_MANAGE",null,accessToken);
    const q=new URLSearchParams({tenant_id:`eq.${tenantId}`,id:`eq.${assetId}`});
    const response=await fetcher(new URL("/rest/v1/clm_assets?"+q,config.url).toString(),{method:"PATCH",headers:clmAdminHeaders(),body:JSON.stringify({status})});
    if(!response.ok)throw new ProviderError("CLM status update failed",response.status);
    const saved=(await response.json() as Array<Record<string,unknown>>)[0];if(!saved)throw new ApiError(404,"CLM asset not found");
    return mapClmAsset(saved);
  }
  async function recordClmSession(tenantId:string,actorId:string,accessToken:string,body:Record<string,unknown>){
    const assetId=clmUuid(body.assetId,"assetId"),visitId=clmUuid(body.linkedVisitId,"linkedVisitId"),operationId=clmUuid(body.operationId,"operationId");
    const startedAt=clmText(body.startedAt,"startedAt",80),endedAt=clmText(body.endedAt,"endedAt",80);
    const started=Date.parse(startedAt),ended=Date.parse(endedAt);
    if(!Number.isFinite(started)||!Number.isFinite(ended)||ended<started||ended-started>8*60*60*1000)throw new ApiError(400,"Invalid detailing session time range");
    if(!Array.isArray(body.slideVisits)||body.slideVisits.length<1||body.slideVisits.length>200)throw new ApiError(400,"slideVisits must contain 1 to 200 entries");
    const slideVisits=body.slideVisits.map((raw,index)=>{
      if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new ApiError(400,`Invalid slide visit ${index+1}`);
      const v=raw as Record<string,unknown>;const slideId=clmText(v.slideId,"slideId",80);
      if(typeof v.durationMs!=="number"||!Number.isSafeInteger(v.durationMs)||v.durationMs<0||v.durationMs>8*60*60*1000)throw new ApiError(400,"Invalid slide duration");
      return {slideId,durationMs:v.durationMs};
    });
    const assets=await readClmAssets(tenantId,accessToken);const asset=assets.find(x=>x.id===assetId);
    if(!asset)throw new ApiError(404,"Approved CLM asset not found");
    const now=new Date().toISOString().slice(0,10);
    if(asset.status!=="APPROVED"||(asset.effectiveFrom&&asset.effectiveFrom>now)||(asset.expiresAt&&asset.expiresAt<now))throw new ApiError(409,"CLM asset is not currently eligible");
    const vq=new URLSearchParams({select:"id,status",tenant_id:`eq.${tenantId}`,id:`eq.${visitId}`,status:"eq.CHECKED_IN",limit:"1"});
    const visitResponse=await fetcher(new URL("/rest/v1/field_visits?"+vq,config.url).toString(),{headers:clmUserHeaders(accessToken),cache:"no-store"});
    if(!visitResponse.ok)throw new ProviderError("Active visit check failed",visitResponse.status);
    if(!(await visitResponse.json() as unknown[]).length)throw new ApiError(409,"An authorized checked-in visit is required for detailing");
    const existingQ=new URLSearchParams({select:"id,asset_id,visit_id,started_at,ended_at,slide_visits,provenance_id",tenant_id:`eq.${tenantId}`,actor_user_id:`eq.${actorId}`,operation_id:`eq.${operationId}`,limit:"1"});
    const existingResponse=await fetcher(new URL("/rest/v1/clm_detailing_sessions?"+existingQ,config.url).toString(),{headers:clmAdminHeaders("return=representation"),cache:"no-store"});
    if(!existingResponse.ok)throw new ProviderError("CLM session replay check failed",existingResponse.status);
    const existing=(await existingResponse.json() as Array<Record<string,unknown>>)[0];
    if(existing){
      if(existing.asset_id!==assetId||existing.visit_id!==visitId||Date.parse(String(existing.started_at))!==started||Date.parse(String(existing.ended_at))!==ended||JSON.stringify(existing.slide_visits)!==JSON.stringify(slideVisits))throw new ApiError(409,"Idempotency key reused with different detailing session");
      return {id:String(existing.id),provenanceId:String(existing.provenance_id)};
    }
    const provenanceId=`clm-session:${operationId}`;
    const response=await fetcher(new URL("/rest/v1/clm_detailing_sessions",config.url).toString(),{method:"POST",headers:clmAdminHeaders(),body:JSON.stringify({
      tenant_id:tenantId,actor_user_id:actorId,asset_id:assetId,visit_id:visitId,operation_id:operationId,started_at:startedAt,ended_at:endedAt,slide_visits:slideVisits,provenance_id:provenanceId,
    })});
    if(!response.ok)throw new ProviderError("CLM session record failed",response.status);
    const saved=(await response.json() as Array<Record<string,unknown>>)[0];if(!saved)throw new ApiError(502,"CLM session was not returned");
    return {id:String(saved.id),provenanceId};
  }

  async function buildManagerReportLedger(tenantId:string,userId:string,accessToken:string){
        const rights=await rbac.accessContext(tenantId,userId,accessToken);
        if(!rights.roles.some(r=>r.roleKey==="MANAGER"||r.roleKey==="TENANT_ADMIN"))throw new ApiError(403,"Manager reporting permission required");
        const userHeaders={apikey:config.anonKey,authorization:`Bearer ${accessToken}`,accept:"application/json",prefer:"count=exact"};
        const readRows=async(table:string,params:Record<string,string>)=>{
          const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,limit:"5000",...params});
          const response=await fetcher(new URL(`/rest/v1/${table}?${q}`,config.url).toString(),{headers:userHeaders,cache:"no-store"});
          if(!response.ok)throw new ProviderError("Reporting source read failed",response.status);
          const rows=await response.json() as Array<Record<string,unknown>>;
          const range=response.headers.get("content-range"),m=/^(?:\d+-\d+|\*)\/(\d+)$/.exec(range??"");
          if(!m||Number(m[1])!==rows.length)throw new ApiError(502,"Reporting source was incomplete");
          return rows;
        };
        const plans=await readRows("tour_plans",{status:"eq.APPROVED",order:"week_start.desc"});
        const planIds=plans.map(x=>String(x.id));
        const days=planIds.length?await readRows("tour_plan_days",{tour_plan_id:`in.(${planIds.join(",")})`,order:"plan_date.asc"}):[];
        const dayIds=days.map(x=>String(x.id));
        const stops=dayIds.length?await readRows("tour_plan_stops",{tour_plan_day_id:`in.(${dayIds.join(",")})`,order:"sequence_no.asc"}):[];
        const executions=await readRows("tour_executions",{order:"work_date.desc"});
        const executionIds=executions.map(x=>String(x.id));
        const visits=executionIds.length?await readRows("field_visits",{execution_id:`in.(${executionIds.join(",")})`,order:"checkin_at.desc"}):[];
        const dcrs=await readRows("dcrs",{order:"submitted_at.desc"});
        const unplannedRows=await readRows("unplanned_calls",{order:"submitted_at.desc"});
        const ncaRows=await readRows("nca_records",{status:"eq.SUBMITTED",order:"work_date.desc"});
        const employeeIds=[...new Set([...plans.map(x=>String(x.employee_id??"")),...executions.map(x=>String(x.employee_id??""))].filter(Boolean))];
        const employees=employeeIds.length?await readRows("employees",{id:`in.(${employeeIds.join(",")})`}):[];
        const userByEmployee=new Map(employees.map(x=>[String(x.id),String(x.user_id)]));
        const planById=new Map(plans.map(x=>[String(x.id),x]));
        const dayById=new Map(days.map(x=>[String(x.id),x]));
        const executionById=new Map(executions.map(x=>[String(x.id),x]));
        const completedStops=new Set(visits.filter(x=>x.status==="CHECKED_OUT").map(x=>String(x.plan_stop_id)));
        const records:Array<Record<string,string>>=[];
        for(const stop of stops){
          const day=dayById.get(String(stop.tour_plan_day_id));if(!day)continue;
          const plan=planById.get(String(day.tour_plan_id));if(!plan)continue;
          const owner=userByEmployee.get(String(plan.employee_id));if(!owner)continue;
          const observed=typeof plan.submitted_at==="string"&&Number.isFinite(Date.parse(plan.submitted_at))?plan.submitted_at:String(day.plan_date)+"T00:00:00.000Z";
          records.push({id:String(stop.id),tenantId:tenantId,territoryId:String(day.territory_id),ownerUserId:owner,workDate:String(day.plan_date),kind:"PLANNED_STOP",status:completedStops.has(String(stop.id))?"COMPLETED":"PLANNED",sourceId:String(stop.id),sourceType:"tour_plan_stop",observedAt:observed});
        }
        for(const row of dcrs){
          const execution=executionById.get(String(row.execution_id));if(!execution)continue;
          const owner=userByEmployee.get(String(execution.employee_id));if(!owner)continue;
          records.push({id:String(row.id),tenantId:tenantId,territoryId:String(execution.territory_id),ownerUserId:owner,workDate:String(execution.work_date),kind:"DCR",status:"SUBMITTED",sourceId:String(row.id),sourceType:"dcr",observedAt:String(row.submitted_at)});
        }
        for(const row of unplannedRows){
          const raw=String(row.status),status=raw==="SUBMITTED"?"PENDING":raw;
          if(status!=="PENDING"&&status!=="APPROVED"&&status!=="REJECTED")continue;
          records.push({id:String(row.id),tenantId:tenantId,territoryId:String(row.territory_id),ownerUserId:String(row.actor_user_id),workDate:String(row.work_date),kind:"UNPLANNED_CALL",status,sourceId:String(row.id),sourceType:"unplanned_call",observedAt:String(row.reviewed_at??row.submitted_at)});
        }
        for(const row of ncaRows){
          records.push({id:String(row.id),tenantId:tenantId,territoryId:String(row.territory_id),ownerUserId:String(row.created_by),workDate:String(row.work_date),kind:"NCA",status:"REPORTED",sourceId:String(row.id),sourceType:"nca_record",observedAt:String(row.created_at)});
        }
        const asOf=new Date().toISOString();
        return {asOf,records};

  }
  const reportCsvCell=(value:unknown)=>{
    const raw=String(value??""),safe=/^[\s\uFEFF]*[=+\-@\t\r]/u.test(raw)?"'"+raw:raw;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  const managerReportCsv=(rows:Array<Record<string,string>>)=>[
    ["Work date","Territory","Employee","Kind","Status","Source type","Source ID","Observed at"].map(reportCsvCell).join(","),
    ...rows.map(r=>[r.workDate,r.territoryId,r.ownerUserId,r.kind,r.status,r.sourceType,r.sourceId,r.observedAt].map(reportCsvCell).join(","))
  ].join("\r\n");
  const validReportDate=(value:unknown)=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;

  /** Authenticates the caller and resolves the active tenant context for a tenant-scoped request. */
  async function resolveTenantRequest(request: Request) {
    const accessToken = readBearerToken(request.headers.get("authorization"));
    const user = await identity.authenticate(request.headers.get("authorization"));
    const context = await tenants.resolveContext(
      user.id,
      request.headers.get("x-tenant-id"),
      accessToken,
    );
    return { accessToken, user, context };
  }

  /** Routes one HTTP request through authenticated Terrevo API contracts. */
  return async function handle(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;

      if (request.method === "GET" && path === "/health") return json(200, { status: "ok" });

      if (request.method === "POST" && path === "/v1/auth/login") {
        const body = await readJsonObject(request);
        return json(200, await identity.signIn(body.email, body.password));
      }

      if (request.method === "POST" && path === "/v1/auth/refresh") {
        const body = await readJsonObject(request);
        return json(200, await identity.refreshSession(body.refreshToken));
      }

      if (request.method === "POST" && path === "/v1/auth/password-reset") {
        const body = await readJsonObject(request);
        await identity.requestPasswordReset(body.email);
        return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
      }

      if (request.method === "POST" && path === "/v1/auth/logout") {
        await identity.signOut(request.headers.get("authorization"));
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      }

      if (request.method === "GET" && path === "/v1/me") {
        return json(200, { user: await identity.authenticate(request.headers.get("authorization")) });
      }

      // Authenticated runtime proof for staging qualification. Never accept a
      // client-supplied environment or project reference as evidence of safety.
      if (request.method === "GET" && path === "/v1/qualification/target") {
        const {context}=await resolveTenantRequest(request);
        return json(200,runtimeQualificationProof(env,context.tenantId));
      }

      // Platform administration is strictly separate from tenant RBAC.
      // All platform requests first validate the caller's Supabase-issued bearer token.
      if (path === "/v1/platform/context" && request.method === "GET") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(200, { isSuperAdmin: await platform.isPlatformAdmin(user.id) });
      }
      if (path === "/v1/platform/tenants" && request.method === "GET") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
        return json(200, { tenants: await platform.listTenants(user.id, offset) });
      }
      if (path === "/v1/platform/tenants" && request.method === "POST") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(201, { tenant: await platform.createTenant(user.id, await readJsonObject(request)) });
      }
      const platformStatus = /^\/v1\/platform\/tenants\/([^/]+)\/status$/.exec(path);
      if (platformStatus && request.method === "PATCH") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(200, { tenant: await platform.setTenantStatus(user.id, platformStatus[1], await readJsonObject(request)) });
      }
      if (path === "/v1/platform/audit" && request.method === "GET") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
        return json(200, { events: await platform.audit(user.id, offset) });
      }

      if(request.method==="POST"&&path==="/v1/admin/master-import"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const rights=await rbac.accessContext(context.tenantId,user.id,accessToken);
        if(!rights.roles.some(r=>r.roleKey==="TENANT_ADMIN"))throw new ApiError(403,"Tenant administrator required");
        const body=await readJsonObject(request,131_072);
        const kind=typeof body.kind==="string"&&MASTER_KINDS.includes(body.kind as MasterKind)?body.kind as MasterKind:null;
        if(!kind)throw new ApiError(400,"Unsupported master import kind");
        const rows=normalizeMasterImportRows(kind,body.rows);
        if(body.preview===true)return json(200,{kind,count:rows.length,rows});
        const inserted=await adapter.masterImport.execute(context.tenantId,kind,rows);
        return json(201,{kind,inserted});
      }

      if(request.method==="GET"&&path==="/v1/ai/agents"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const rights=await rbac.accessContext(context.tenantId,user.id,accessToken);
        const agentRoles=rights.roles.flatMap(r=>r.roleKey==="MR"?["MR" as AgentRole]:r.roleKey==="MANAGER"?["MANAGER" as AgentRole]:r.roleKey==="TENANT_ADMIN"?["TENANT_ADMIN" as AgentRole]:[]);
        const visible=AGENT_REGISTRY.filter(def=>def.allowedRoles.some(role=>agentRoles.includes(role)));
        return json(200,{agents:visible.map(def=>({id:def.id,name:def.name,priority:def.priority,authoritativeDatasets:def.authoritativeDatasets,resultKeys:def.resultKeys}))});
      }
      const aiRun=/^\/v1\/ai\/agents\/(AI-(?:0[1-9]|1[0-5]))\/run$/.exec(path);
      if(request.method==="POST"&&aiRun){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const rights=await rbac.accessContext(context.tenantId,user.id,accessToken);
        const agentRoles=rights.roles.flatMap(r=>r.roleKey==="MR"?["MR" as AgentRole]:r.roleKey==="MANAGER"?["MANAGER" as AgentRole]:r.roleKey==="TENANT_ADMIN"?["TENANT_ADMIN" as AgentRole]:[]);
        const agentId=aiRun[1] as AgentId;
        const definition=AGENT_REGISTRY.find(def=>def.id===agentId);
        if(!definition)throw new ApiError(404,"Agent not found");
        if(!definition.allowedRoles.some(role=>agentRoles.includes(role)))throw new ApiError(403,"Agent role denied");
        const body=await readJsonObject(request,16_384);
        const requestId=typeof body.requestId==="string"&&body.requestId.trim()&&body.requestId.length<=120?body.requestId.trim():crypto.randomUUID();
        const subject=body.subject&&typeof body.subject==="object"&&!Array.isArray(body.subject)?body.subject as Record<string,unknown>:null;
        const snapshots:AgentSnapshots={};
        if(agentId==="AI-01"||agentId==="AI-02")snapshots.startOptions=await tourExecution.listStartOptions(context.tenantId,accessToken) as unknown as Array<Record<string,unknown>>;
        if(agentId==="AI-04")snapshots.dcrs=await doctorCalls.listDcrs(context.tenantId,accessToken) as unknown as Array<Record<string,unknown>>;
        if(agentId==="AI-05"||agentId==="AI-15"){
          if(agentRoles.includes("MANAGER")||agentRoles.includes("TENANT_ADMIN"))snapshots.analytics=await analytics.getManagerAnalytics(context.tenantId,accessToken,7) as unknown as Record<string,unknown>;
        }
        if(agentId==="AI-07"&&subject&&typeof subject.id==="string"&&CLM_UUID.test(subject.id)){
          try{snapshots.rcpa=await rcpa.get(context.tenantId,accessToken,subject.id) as unknown as Record<string,unknown>;}catch(error){if(!(error instanceof RcpaNotFoundError))throw error;}
        }
        if(agentId==="AI-09")snapshots.clmAssets=await readClmAssets(context.tenantId,accessToken) as unknown as Array<Record<string,unknown>>;
        if(agentId==="AI-11")snapshots.inventory=await inventory.listBalances(context.tenantId,accessToken) as unknown as Array<Record<string,unknown>>;
        if(agentId==="AI-14"){
          const entries=await Promise.all(MASTER_KINDS.map(async kind=>[kind,await masters.list(kind,context.tenantId,accessToken)] as const));
          snapshots.masters=Object.fromEntries(entries) as Record<string,Array<Record<string,unknown>>>;
        }
        const derived=buildDeterministicAgentInput(agentId,snapshots);
        const evidence=Array.isArray(derived.evidence)?derived.evidence as Array<{source_id?:unknown}>:[];
        const allowedSourceIds=new Set(evidence.flatMap(item=>typeof item.source_id==="string"?[item.source_id]:[]));
        const output=runAgent({contract_version:"1.0",agent_id:agentId,request_id:requestId,input:derived,
          ...(subject&&typeof subject.kind==="string"&&typeof subject.id==="string"?{subject:{kind:subject.kind,id:subject.id}}:{}),
          requested_as_of:new Date().toISOString()},
          {tenantId:context.tenantId,actorId:user.id,roles:agentRoles,allowedSourceIds,now:new Date().toISOString()});
        return json(200,{output});
      }

      const customerHistoryMatch=/^\/v1\/customers\/(doctor|chemist|stockist)\/([^/]+)\/history$/.exec(path);
      if(request.method==="GET"&&customerHistoryMatch){
        const {accessToken,context}=await resolveTenantRequest(request);
        const kind=customerHistoryMatch[1] as "doctor"|"chemist"|"stockist",customerId=clmUuid(customerHistoryMatch[2],"customerId");
        const headers=clmUserHeaders(accessToken);
        const targetColumn=kind==="doctor"?"doctor_id":kind==="chemist"?"chemist_id":"stockist_id";
        const sq=new URLSearchParams({select:"id",tenant_id:`eq.${context.tenantId}`,stop_type:`eq.${kind}`,[targetColumn]:`eq.${customerId}`,limit:"1000"});
        const sr=await fetcher(new URL("/rest/v1/tour_plan_stops?"+sq,config.url).toString(),{headers,cache:"no-store"});
        if(!sr.ok)throw new ProviderError("Customer history scope read failed",sr.status);
        const stopIds=(await sr.json() as Array<{id:string}>).map(x=>x.id);
        if(!stopIds.length)return json(200,{history:[]});
        const vq=new URLSearchParams({select:"id,checkin_at,checkout_at,status,verification",tenant_id:`eq.${context.tenantId}`,plan_stop_id:`in.(${stopIds.join(",")})`,order:"checkin_at.desc",limit:"1000"});
        const vr=await fetcher(new URL("/rest/v1/field_visits?"+vq,config.url).toString(),{headers,cache:"no-store"});
        if(!vr.ok)throw new ProviderError("Customer visit history failed",vr.status);
        const visits=await vr.json() as Array<Record<string,unknown>>;
        const visitIds=visits.map(x=>String(x.id));
        const details=new Map<string,string>();
        if(visitIds.length){
          const table=kind==="doctor"?"dcrs":"trade_calls";
          const select=kind==="doctor"?"visit_id,call_outcome,submitted_at":"visit_id,outcome,updated_at";
          const q=new URLSearchParams({select,tenant_id:`eq.${context.tenantId}`,visit_id:`in.(${visitIds.join(",")})`,limit:"1000"});
          const rr=await fetcher(new URL(`/rest/v1/${table}?${q}`,config.url).toString(),{headers,cache:"no-store"});
          if(!rr.ok)throw new ProviderError("Customer activity history failed",rr.status);
          for(const row of await rr.json() as Array<Record<string,unknown>>)details.set(String(row.visit_id),String(kind==="doctor"?row.call_outcome:row.outcome));
        }
        const history=visits.map(v=>({tenantId:context.tenantId,customerKind:kind,customerId,id:String(v.id),
          occurredAt:String(v.checkout_at??v.checkin_at),activityType:kind==="doctor"?"Doctor call":"Trade call",
          summary:details.get(String(v.id))??`${String(v.status)} · ${String(v.verification)}`}))
          .filter(x=>Number.isFinite(Date.parse(x.occurredAt)));
        return json(200,{history});
      }

      const customerLinksMatch=new RegExp("^/v1/business/customer-links/([^/]+)$").exec(path);
      if(request.method==="GET"&&customerLinksMatch){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        // Fetch grants through user-JWT RLS: never accept caller-supplied territory authorization.
        const config=requireConfig(env);
        const grantUrl=new URL("/rest/v1/business_customer_link_grants",config.url);
        grantUrl.searchParams.set("select","territory_id");
        grantUrl.searchParams.set("tenant_id",`eq.${context.tenantId}`);
        grantUrl.searchParams.set("user_id",`eq.${user.id}`);
        grantUrl.searchParams.set("limit","1000");
        grantUrl.searchParams.set("order","territory_id.asc");
        const grantDeadline=AbortSignal.timeout(10_000),grantIds=new Set<string>();
        let offset=0,total:number|undefined;
        // Exact counts detect provider row caps; reject incomplete, repeated or
        // changing pages instead of treating a partial set as complete scope.
        for(let page=0;;page++){
          if(page>=100)throw new BusinessAccessError("Customer grant pagination limit exceeded");
          grantDeadline.throwIfAborted();
          grantUrl.searchParams.set("offset",String(offset));
          const grantResponse=await fetcher(grantUrl.toString(),{headers:{apikey:config.anonKey,authorization:`Bearer ${accessToken}`,accept:"application/json",prefer:"count=exact"},cache:"no-store",signal:grantDeadline,redirect:"error"});
          if(!grantResponse.ok)throw new BusinessAccessError("Customer grant retrieval denied");
          const grantRows:unknown=await grantResponse.json();
          grantDeadline.throwIfAborted();
          if(!Array.isArray(grantRows)||grantRows.length>1000||grantRows.some((g:unknown)=>!g||typeof g!=="object"||Array.isArray(g)||typeof (g as {territory_id?:unknown}).territory_id!=="string"||!(g as {territory_id:string}).territory_id.trim()))throw new BusinessAccessError("Invalid customer grants");
          const range=grantResponse.headers.get("content-range");
          if(offset===0&&grantRows.length===0&&range==="*/0")break;
          const match=/^(\d+)-(\d+)\/(\d+)$/.exec(range??"");
          if(!match)throw new BusinessAccessError("Customer grant completeness unavailable");
          const [start,end,count]=match.slice(1).map(Number);
          if(![start,end,count].every(Number.isSafeInteger)||start!==offset||end!==offset+grantRows.length-1||grantRows.length===0||count<=end||count>100_000||(total!==undefined&&total!==count))throw new BusinessAccessError("Inconsistent customer grant pagination");
          total=count;
          for(const row of grantRows){const id=(row as {territory_id:string}).territory_id;if(grantIds.has(id))throw new BusinessAccessError("Customer grant pagination did not advance");grantIds.add(id);}
          offset+=grantRows.length;
          if(offset===total)break;
        }
        const permittedTerritoryIds=[...grantIds];
        const customerLinks=createCustomerLinksService(createCustomerLinksPostgrest(config.url,config.anonKey,fetcher));
        const links=await customerLinks.list({tenantId:context.tenantId,userId:user.id,accessToken,permittedTerritoryIds},customerLinksMatch[1]);
        return json(200,{links});
      }

      if(request.method==="GET"&&path==="/v1/clm/assets"){
        const {accessToken,context}=await resolveTenantRequest(request);return json(200,{assets:await readClmAssets(context.tenantId,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/clm/assets"){
        const {accessToken,user,context}=await resolveTenantRequest(request);return json(201,{asset:await createClmAsset(context.tenantId,user.id,accessToken,await readJsonObject(request,7_500_000))});
      }
      const clmDownload=/^\/v1\/clm\/assets\/([^/]+)\/download$/.exec(path);
      if(request.method==="GET"&&clmDownload){
        const {accessToken,context}=await resolveTenantRequest(request);return json(200,await signClmBinary(context.tenantId,clmUuid(clmDownload[1],"assetId"),accessToken));
      }
      const clmStatus=/^\/v1\/clm\/assets\/([^/]+)\/status$/.exec(path);
      if(request.method==="PATCH"&&clmStatus){
        const {accessToken,context}=await resolveTenantRequest(request),body=await readJsonObject(request);
        if(body.status!=="WITHDRAWN"&&body.status!=="EXPIRED")throw new ApiError(400,"status must be WITHDRAWN or EXPIRED");
        return json(200,{asset:await setClmAssetStatus(context.tenantId,clmUuid(clmStatus[1],"assetId"),accessToken,body.status)});
      }
      if(request.method==="POST"&&path==="/v1/clm/sessions"){
        const {accessToken,user,context}=await resolveTenantRequest(request);return json(201,{session:await recordClmSession(context.tenantId,user.id,accessToken,await readJsonObject(request,65536))});
      }
      if(request.method==="GET"&&path==="/v1/clm/sessions"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const q=new URLSearchParams({select:"id,asset_id,visit_id,started_at,ended_at,provenance_id",tenant_id:`eq.${context.tenantId}`,actor_user_id:`eq.${user.id}`,order:"created_at.desc",limit:"200"});
        const response=await fetcher(new URL("/rest/v1/clm_detailing_sessions?"+q,config.url).toString(),{headers:clmUserHeaders(accessToken),cache:"no-store"});
        if(!response.ok)throw new ProviderError("CLM session history failed",response.status);
        return json(200,{sessions:await response.json()});
      }

      if (request.method === "GET" && path === "/v1/tenants") {
        const accessToken = readBearerToken(request.headers.get("authorization"));
        await identity.authenticate(request.headers.get("authorization"));
        return json(200, { tenants: await tenants.listAccessible(accessToken) });
      }

      if (request.method === "GET" && path === "/v1/tenant-context") {
        const { context } = await resolveTenantRequest(request);
        return json(200, { context });
      }

      if (request.method === "GET" && path === "/v1/org-units") {
        const { accessToken, context } = await resolveTenantRequest(request);
        return json(200, { units: await organization.listUnits(context.tenantId, accessToken) });
      }

      if (request.method === "POST" && path === "/v1/org-units") {
        const { accessToken, context } = await resolveTenantRequest(request);
        const body = await readJsonObject(request);
        const unit = await organization.createUnit(context.tenantId, accessToken, body);
        return json(201, { unit });
      }

      if (request.method === "POST" && path === "/v1/org-assignments") {
        const { accessToken, context } = await resolveTenantRequest(request);
        await organization.assignUser(context.tenantId, accessToken, await readJsonObject(request));
        return new Response(null, { status: 204 });
      }

      if (request.method === "GET" && path === "/v1/access-context") {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        return json(200, {
          context: await rbac.accessContext(context.tenantId, user.id, accessToken),
        });
      }

      if(request.method==="GET"&&path==="/v1/manager/report-records"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,await buildManagerReportLedger(context.tenantId,user.id,accessToken));
      }
      if(request.method==="POST"&&path==="/v1/manager/report-export"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const body=await readJsonObject(request,16_384);
        const from=body.from==null||body.from===""?"":body.from,to=body.to==null||body.to===""?"":body.to;
        const territoryId=body.territoryId==null?"":String(body.territoryId),ownerUserId=body.ownerUserId==null?"":String(body.ownerUserId);
        if((from&&!validReportDate(from))||(to&&!validReportDate(to))||(from&&to&&String(from)>String(to)))throw new ApiError(400,"Invalid report date filter");
        if(territoryId&&!CLM_UUID.test(territoryId))throw new ApiError(400,"Invalid territory filter");
        if(ownerUserId&&!CLM_UUID.test(ownerUserId))throw new ApiError(400,"Invalid employee filter");
        const ledger=await buildManagerReportLedger(context.tenantId,user.id,accessToken);
        const rows=ledger.records.filter(r=>(!from||r.workDate>=String(from))&&(!to||r.workDate<=String(to))&&(!territoryId||r.territoryId===territoryId)&&(!ownerUserId||r.ownerUserId===ownerUserId));
        const csv=managerReportCsv(rows);
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(csv));
        const contentSha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
        const snapshot={tenant_id:context.tenantId,actor_user_id:user.id,as_of:ledger.asOf,
          filter:{from:String(from),to:String(to),territoryId,ownerUserId},source_ids:rows.map(r=>r.sourceId),row_count:rows.length,csv_text:csv,content_sha256:contentSha256};
        const response=await fetcher(new URL("/rest/v1/manager_report_snapshots",config.url).toString(),{method:"POST",headers:clmAdminHeaders(),body:JSON.stringify(snapshot)});
        if(!response.ok)throw new ProviderError("Manager report snapshot write failed",response.status);
        const saved=(await response.json() as Array<Record<string,unknown>>)[0];if(!saved)throw new ApiError(502,"Report snapshot was not returned");
        return json(201,{snapshotId:String(saved.id),asOf:ledger.asOf,rowCount:rows.length,contentSha256,csv});
      }

      if(request.method==="GET"&&path==="/v1/manager/command-center"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{commandCenter:await managerCommand.get(context.tenantId,accessToken)});}
      if(request.method==="GET"&&path==="/v1/manager/analytics"){const {accessToken,context}=await resolveTenantRequest(request);const raw=new URL(request.url).searchParams.get("days");const days=raw===null?7:Number(raw);return json(200,{analytics:await analytics.getManagerAnalytics(context.tenantId,accessToken,days)});}
      if(request.method==="GET"&&path==="/v1/joint-work/own"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{assignments:await jointWork.listSelf(context.tenantId,user.id,accessToken)});}if(request.method==="GET"&&path==="/v1/joint-work"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{assignments:await jointWork.list(context.tenantId,accessToken)});}
      if(request.method==="POST"&&path==="/v1/joint-work"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(201,{assignment:await jointWork.schedule(context.tenantId,user.id,accessToken,await readJsonObject(request))});}
      const join=/^\/v1\/joint-work\/([^/]+)\/join$/.exec(path);if(request.method==="POST"&&join){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{assignment:await jointWork.join(context.tenantId,user.id,accessToken,join[1],await readJsonObject(request))});}
      const leave=/^\/v1\/joint-work\/([^/]+)\/leave$/.exec(path);if(request.method==="POST"&&leave){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{assignment:await jointWork.leave(context.tenantId,user.id,accessToken,leave[1],await readJsonObject(request))});}
      if(request.method==="GET"&&path==="/v1/workforce/evidence"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const rights=await rbac.accessContext(context.tenantId,user.id,accessToken);
        const elevated=rights.roles.some(r=>r.roleKey==="MANAGER"||r.roleKey==="TENANT_ADMIN");
        const claims=elevated?await expenses.list(context.tenantId,accessToken):await expenses.listOwn(context.tenantId,user.id,accessToken);
        const claimIds=claims.map(x=>x.id),executionIds=[...new Set(claims.map(x=>x.executionId).filter(Boolean))];
        const serviceHeaders=clmAdminHeaders("return=representation");
        let reviewRows:Array<Record<string,unknown>>=[];
        if(claimIds.length){
          const q=new URLSearchParams({select:"id,expense_claim_id,line_sequence,document_ref,status,verified_at",tenant_id:`eq.${context.tenantId}`,expense_claim_id:`in.(${claimIds.join(",")})`,limit:"5000"});
          const response=await fetcher(new URL("/rest/v1/expense_receipt_reviews?"+q,config.url).toString(),{headers:serviceHeaders,cache:"no-store"});
          if(!response.ok)throw new ProviderError("Receipt review evidence failed",response.status);
          reviewRows=await response.json() as Array<Record<string,unknown>>;
        }
        const reviewKey=new Map(reviewRows.map(x=>[`${String(x.expense_claim_id)}:${Number(x.line_sequence)}`,x]));
        const receipts=claims.flatMap(claim=>claim.lines.flatMap(line=>{
          if(!line.receiptReference)return [];
          const key=`${claim.id}:${line.sequence}`,review=reviewKey.get(key);
          return [{id:review?String(review.id):`pending:${key}`,tenantId:context.tenantId,claimId:claim.id,lineId:key,
            status:review?String(review.status):"PENDING",documentRef:line.receiptReference,
            ...(review?.verified_at?{verifiedAt:String(review.verified_at)}:{})}];
        }));
        let policyRows:Array<Record<string,unknown>>=[];
        {
          const q=new URLSearchParams({select:"id,category,max_minor,currency_code,effective_from,expires_at,policy_ref",tenant_id:`eq.${context.tenantId}`,order:"effective_from.desc",limit:"1000"});
          const response=await fetcher(new URL("/rest/v1/expense_policy_limits?"+q,config.url).toString(),{headers:serviceHeaders,cache:"no-store"});
          if(!response.ok)throw new ProviderError("Expense policy evidence failed",response.status);
          policyRows=await response.json() as Array<Record<string,unknown>>;
        }
        const policies=policyRows.map(x=>({tenantId:context.tenantId,category:String(x.category),maxMinor:Number(x.max_minor),currency:String(x.currency_code),effectiveFrom:String(x.effective_from),expiresAt:String(x.expires_at),policyId:String(x.policy_ref)}));
        const userHeaders=clmUserHeaders(accessToken);
        let presence:Array<Record<string,unknown>>=[],daily:Array<Record<string,unknown>>=[];
        if(executionIds.length){
          const pq=new URLSearchParams({select:"id,execution_id,total_distance_meters,recorded_at",tenant_id:`eq.${context.tenantId}`,execution_id:`in.(${executionIds.join(",")})`,limit:"5000"});
          const pr=await fetcher(new URL("/rest/v1/visit_presence_integrity?"+pq,config.url).toString(),{headers:userHeaders,cache:"no-store"});
          if(!pr.ok)throw new ProviderError("Travel evidence failed",pr.status);presence=await pr.json() as Array<Record<string,unknown>>;
          const dq=new URLSearchParams({select:"id,execution_id,work_date,status,submitted_at,reviewed_at",tenant_id:`eq.${context.tenantId}`,execution_id:`in.(${executionIds.join(",")})`,limit:"5000"});
          const dr=await fetcher(new URL("/rest/v1/daily_timesheets?"+dq,config.url).toString(),{headers:userHeaders,cache:"no-store"});
          if(!dr.ok)throw new ProviderError("Attendance evidence failed",dr.status);daily=await dr.json() as Array<Record<string,unknown>>;
        }
        const travel=claims.flatMap(claim=>{
          const rows=presence.filter(x=>String(x.execution_id)===claim.executionId);
          if(!rows.length)return [];
          const distance=rows.reduce((sum,x)=>sum+(Number.isFinite(Number(x.total_distance_meters))?Number(x.total_distance_meters):0),0);
          return [{tenantId:context.tenantId,ownerUserId:claim.ownerUserId,workDate:claim.workDate,sourceId:rows.map(x=>String(x.id)).join(","),distanceMeters:Math.round(distance),method:"SERVER_GPS"}];
        });
        const attendance=claims.flatMap(claim=>{
          const row=daily.find(x=>String(x.execution_id)===claim.executionId);if(!row)return [];
          const status=String(row.status),dayClosed=status==="REVIEWED"||status==="APPROVED";
          return [{id:String(row.id),tenantId:context.tenantId,ownerUserId:claim.ownerUserId,workDate:claim.workDate,state:"PRESENT",dayClosed,sourceId:String(row.id),asOf:String(row.reviewed_at??row.submitted_at??new Date().toISOString())}];
        });
        return json(200,{asOf:new Date().toISOString(),claims,receipts,travel,attendance,policies});
      }
      const receiptDecision=/^\/v1\/workforce\/receipts\/([^/]+)\/(\d+)\/decision$/.exec(path);
      if(request.method==="POST"&&receiptDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        const rights=await rbac.accessContext(context.tenantId,user.id,accessToken);
        if(!rights.roles.some(r=>r.roleKey==="MANAGER"||r.roleKey==="TENANT_ADMIN"))throw new ApiError(403,"Receipt review permission required");
        const claimId=clmUuid(receiptDecision[1],"claimId"),sequence=Number(receiptDecision[2]);
        const visible=(await expenses.list(context.tenantId,accessToken)).find(x=>x.id===claimId);if(!visible)throw new ApiError(404,"Expense claim not found");
        const line=visible.lines.find(x=>x.sequence===sequence);if(!line?.receiptReference)throw new ApiError(409,"Receipt reference is not available for this line");
        const body=await readJsonObject(request),decision=body.decision;
        if(decision!=="VERIFY"&&decision!=="REVOKE")throw new ApiError(400,"decision must be VERIFY or REVOKE");
        const comment=body.comment==null?null:clmText(body.comment,"comment",1000);
        const payload={tenant_id:context.tenantId,expense_claim_id:claimId,line_sequence:sequence,document_ref:line.receiptReference,
          status:decision==="VERIFY"?"VERIFIED":"REVOKED",reviewer_user_id:user.id,verified_at:new Date().toISOString(),review_comment:comment};
        const headers={...clmAdminHeaders("resolution=merge-duplicates,return=representation")};
        const response=await fetcher(new URL("/rest/v1/expense_receipt_reviews?on_conflict=tenant_id,expense_claim_id,line_sequence",config.url).toString(),{method:"POST",headers,body:JSON.stringify(payload)});
        if(!response.ok)throw new ProviderError("Receipt review write failed",response.status);
        return json(200,{receipt:(await response.json() as unknown[])[0]});
      }
      if(request.method==="POST"&&path==="/v1/workforce/policies"){
        const {accessToken,user,context}=await resolveTenantRequest(request);await rbac.authorize(context.tenantId,"MASTER_MANAGE",null,accessToken);
        const body=await readJsonObject(request),category=body.category,currency=body.currency,maxMinor=body.maxMinor;
        if(!["TRAVEL","MEAL","LODGING","LOCAL_CONVEYANCE","OTHER"].includes(String(category)))throw new ApiError(400,"Invalid expense category");
        if(typeof maxMinor!=="number"||!Number.isSafeInteger(maxMinor)||maxMinor<0)throw new ApiError(400,"maxMinor must be a non-negative safe integer");
        if(typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency))throw new ApiError(400,"Invalid currency");
        const effectiveFrom=clmDate(body.effectiveFrom,"effectiveFrom")!,expiresAt=clmDate(body.expiresAt,"expiresAt")!;
        if(expiresAt<effectiveFrom)throw new ApiError(400,"expiresAt must be on or after effectiveFrom");
        const policyRef=clmText(body.policyRef,"policyRef",300);
        const response=await fetcher(new URL("/rest/v1/expense_policy_limits",config.url).toString(),{method:"POST",headers:clmAdminHeaders(),body:JSON.stringify({
          tenant_id:context.tenantId,category,max_minor:maxMinor,currency_code:currency,effective_from:effectiveFrom,expires_at:expiresAt,policy_ref:policyRef,created_by:user.id,
        })});
        if(!response.ok)throw new ProviderError("Expense policy write failed",response.status);
        return json(201,{policy:(await response.json() as unknown[])[0]});
      }

      if(request.method==="GET"&&path==="/v1/expenses/own"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{claims:await expenses.listOwn(context.tenantId,user.id,accessToken)});}if(request.method==="GET"&&path==="/v1/expenses"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{claims:await expenses.list(context.tenantId,accessToken)});}
      const expenseByExecution=/^\/v1\/executions\/([^/]+)\/expense$/.exec(path);if(request.method==="PUT"&&expenseByExecution){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{claim:await expenses.save(context.tenantId,user.id,accessToken,expenseByExecution[1],await readJsonObject(request,65536))});}
      if(request.method==="GET"&&path==="/v1/expense-approvals"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{claims:await expenses.listPending(context.tenantId,accessToken)});}
      const expenseSubmit=/^\/v1\/expenses\/([^/]+)\/submit$/.exec(path);if(request.method==="POST"&&expenseSubmit){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{claim:await expenses.submit(context.tenantId,user.id,accessToken,expenseSubmit[1],await readJsonObject(request))});}
      const expenseDecision=/^\/v1\/expense-approvals\/([^/]+)\/decision$/.exec(path);if(request.method==="POST"&&expenseDecision){const {accessToken,user,context}=await resolveTenantRequest(request);await expenses.decide(context.tenantId,user.id,accessToken,expenseDecision[1],await readJsonObject(request));return new Response(null,{status:204});}
      if(request.method==="GET"&&path==="/v1/attendance"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{attendance:await attendanceLeave.listAttendance(context.tenantId,accessToken)});}

      // Planned calls remain on approved tour stops with GPS visit/DCR workflow.
      // Unplanned calls are separate GPS-evidenced transactions awaiting manager review.
      if(request.method==="GET"&&path==="/v1/unplanned-calls/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{calls:await unplanned.own(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/unplanned-calls"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{call:await unplanned.submit(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      if(request.method==="GET"&&path==="/v1/unplanned-approvals"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{calls:await unplanned.pending(context.tenantId,accessToken)});
      }
      const unplannedDecision=/^\/v1\/unplanned-approvals\/([^/]+)\/decision$/.exec(path);
      if(request.method==="POST"&&unplannedDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{call:await unplanned.decide(context.tenantId,user.id,accessToken,unplannedDecision[1],await readJsonObject(request))});
      }

      // NCA is a distinct governed field-activity contract, never a doctor call.
      if(request.method==="GET"&&path==="/v1/nca/options"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{options:await nca.options(context.tenantId,accessToken)});
      }
      if(request.method==="GET"&&path==="/v1/nca/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{records:await nca.listOwn(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/nca"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{record:await nca.save(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
            const ncaSubmit=/^\/v1\/nca\/([^/]+)\/submit$/.exec(path);
      if(request.method==="POST"&&ncaSubmit){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{record:await nca.submit(context.tenantId,user.id,accessToken,ncaSubmit[1])});
      }
      if(request.method==="POST"&&path==="/v1/nca/categories"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{category:await nca.configureCategory(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      if(request.method==="POST"&&path==="/v1/nca/towns"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{town:await nca.configureTown(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }

      if(request.method==="GET"&&path==="/v1/leaves/own"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{leaves:await attendanceLeave.listOwnLeaves(context.tenantId,user.id,accessToken)});}if(request.method==="GET"&&path==="/v1/leaves"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{leaves:await attendanceLeave.listLeaves(context.tenantId,accessToken)});}
      if(request.method==="POST"&&path==="/v1/leaves"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(201,{leave:await attendanceLeave.submit(context.tenantId,user.id,accessToken,await readJsonObject(request))});}
      if(request.method==="GET"&&path==="/v1/leave-approvals"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{leaves:await attendanceLeave.listPending(context.tenantId,accessToken)});}
      const leaveDecision=/^\/v1\/leave-approvals\/([^/]+)\/decision$/.exec(path);if(request.method==="POST"&&leaveDecision){const {accessToken,user,context}=await resolveTenantRequest(request);await attendanceLeave.decide(context.tenantId,user.id,accessToken,leaveDecision[1],await readJsonObject(request));return new Response(null,{status:204});}
      const orderMatch=/^\/v1\/visits\/([^/]+)\/order$/.exec(path);if(orderMatch){const {accessToken,user,context}=await resolveTenantRequest(request);if(request.method==="GET")return json(200,{order:await orders.get(context.tenantId,accessToken,orderMatch[1])});if(request.method==="PUT")return json(200,{order:await orders.save(context.tenantId,user.id,accessToken,orderMatch[1],await readJsonObject(request,65536))});}
      const rcpaMatch=/^\/v1\/visits\/([^/]+)\/rcpa$/.exec(path);
      if(rcpaMatch){const {accessToken,user,context}=await resolveTenantRequest(request);if(request.method==="GET")return json(200,{rcpa:await rcpa.get(context.tenantId,accessToken,rcpaMatch[1])});if(request.method==="PUT")return json(200,{rcpa:await rcpa.save(context.tenantId,user.id,accessToken,rcpaMatch[1],await readJsonObject(request,65536))});}
      const tradeCall=/^\/v1\/visits\/([^/]+)\/trade-call$/.exec(path);
      if(tradeCall){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET")return json(200,{tradeCall:await tradeCalls.get(context.tenantId,accessToken,tradeCall[1])});
        if(request.method==="PUT")return json(200,{tradeCall:await tradeCalls.save(context.tenantId,user.id,accessToken,tradeCall[1],await readJsonObject(request))});
      }

      if(request.method==="GET"&&path==="/v1/timesheets/weekly/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await weeklyTimesheets.listOwn(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="GET"&&path==="/v1/timesheets/weekly"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await weeklyTimesheets.list(context.tenantId,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/timesheets/weekly/generate"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{timesheet:await weeklyTimesheets.generate(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      if(request.method==="GET"&&path==="/v1/timesheet-approvals"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await weeklyTimesheets.listPending(context.tenantId,accessToken)});
      }
      const weeklyDecision=/^\/v1\/timesheet-approvals\/([^/]+)\/decision$/.exec(path);
      if(request.method==="POST"&&weeklyDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        await weeklyTimesheets.decide(context.tenantId,user.id,accessToken,weeklyDecision[1],await readJsonObject(request));
        return new Response(null,{status:204});
      }
      const weeklySubmit=/^\/v1\/timesheets\/weekly\/([^/]+)\/submit$/.exec(path);
      if(request.method==="POST"&&weeklySubmit){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await weeklyTimesheets.submit(context.tenantId,user.id,accessToken,weeklySubmit[1],await readJsonObject(request))});
      }
      const weeklyOne=/^\/v1\/timesheets\/weekly\/([^/]+)$/.exec(path);
      if(request.method==="GET"&&weeklyOne){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await weeklyTimesheets.get(context.tenantId,accessToken,weeklyOne[1])});
      }

      if(request.method==="GET"&&path==="/v1/timesheets/daily/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await dailyTimesheets.listSelf(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="GET"&&path==="/v1/timesheets/daily"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await dailyTimesheets.list(context.tenantId,accessToken)});
      }
      const dailyReview=/^\/v1\/timesheets\/daily\/([^/]+)\/review$/.exec(path);
      if(request.method==="POST"&&dailyReview){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await dailyTimesheets.review(
          context.tenantId,user.id,accessToken,dailyReview[1],await readJsonObject(request)
        )});
      }
      const dailyOne=/^\/v1\/timesheets\/daily\/([^/]+)$/.exec(path);
      if(request.method==="GET"&&dailyOne){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await dailyTimesheets.get(context.tenantId,accessToken,dailyOne[1])});
      }

      if(request.method==="POST"&&path==="/v1/tour-executions/submit"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{execution:await tourSubmit.submit(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }

      if(request.method==="GET"&&path==="/v1/inventory"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{balances:await inventory.listBalances(context.tenantId,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/inventory/issues"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        await inventory.issue(context.tenantId,user.id,accessToken,await readJsonObject(request));
        return new Response(null,{status:204});
      }
      if(request.method==="POST"&&path==="/v1/inventory/returns"){
        const {user,context}=await resolveTenantRequest(request);
        await inventory.returnOwn(context.tenantId,user.id,await readJsonObject(request));
        return new Response(null,{status:204});
      }
      const distributions=/^\/v1\/visits\/([^/]+)\/distributions$/.exec(path);
      if(distributions){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET"){
          return json(200,{distributions:await inventory.listVisitDistributions(context.tenantId,accessToken,distributions[1])});
        }
        if(request.method==="POST"){
          return json(200,{distributions:await inventory.distribute(
            context.tenantId,user.id,accessToken,distributions[1],await readJsonObject(request,32_768)
          )});
        }
      }

      if(request.method==="GET"&&path==="/v1/dcrs"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{dcrs:await doctorCalls.listDcrs(context.tenantId,accessToken)});
      }
      const dcrMatch=/^\/v1\/dcrs\/([^/]+)$/.exec(path);
      if(request.method==="GET"&&dcrMatch){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{dcr:await doctorCalls.getDcr(context.tenantId,accessToken,dcrMatch[1])});
      }
      const doctorCallMatch=/^\/v1\/visits\/([^/]+)\/doctor-call$/.exec(path);
      if(doctorCallMatch){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET"){
          return json(200,{doctorCall:await doctorCalls.getByVisit(context.tenantId,accessToken,doctorCallMatch[1])});
        }
        if(request.method==="PUT"){
          return json(200,{doctorCall:await doctorCalls.save(
            context.tenantId,user.id,accessToken,doctorCallMatch[1],await readJsonObject(request,32_768)
          )});
        }
      }

      if (request.method === "GET" && path === "/v1/field-settings") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{settings:await visits.getSettings(context.tenantId,accessToken)});
      }
      if (request.method === "PUT" && path === "/v1/field-settings") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{settings:await visits.updateSettings(context.tenantId,accessToken,await readJsonObject(request))});
      }
      if (request.method === "GET" && path === "/v1/visits/open") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{visit:await visits.getOpen(context.tenantId,accessToken)});
      }
      if (request.method === "POST" && path === "/v1/visits/check-in") {
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{visit:await visits.checkIn(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      const checkout=/^\/v1\/visits\/([^/]+)\/check-out$/.exec(path);
      if(request.method==="POST"&&checkout){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{visit:await visits.checkOut(context.tenantId,user.id,accessToken,checkout[1],await readJsonObject(request))});
      }
      const presence=/^\/v1\/visits\/([^/]+)\/presence$/.exec(path);
      if(presence){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET")return json(200,{presence:await visits.getPresence(context.tenantId,accessToken,presence[1])});
        if(request.method==="POST")return json(201,{presence:await visits.recordDeparture(
          context.tenantId,user.id,accessToken,presence[1],await readJsonObject(request,32_768)
        )});
      }
      if(request.method==="GET"&&path==="/v1/visit-exceptions"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{exceptions:await visits.listPendingExceptions(context.tenantId,accessToken)});
      }
      const exceptionDecision=/^\/v1\/visit-exceptions\/([^/]+)\/decision$/.exec(path);
      if(request.method==="POST"&&exceptionDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        await visits.decideException(context.tenantId,user.id,accessToken,exceptionDecision[1],await readJsonObject(request));
        return new Response(null,{status:204});
      }

      if (request.method === "GET" && path === "/v1/tour-executions/progress") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{progress:await tourProgress.getCurrent(context.tenantId,accessToken)});
      }

      if (request.method === "GET" && path === "/v1/tour-executions/start-options") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{options:await tourExecution.listStartOptions(context.tenantId,accessToken)});
      }
      if (request.method === "GET" && path === "/v1/tour-executions/active") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{execution:await tourExecution.getActive(context.tenantId,accessToken)});
      }
      if (request.method === "POST" && path === "/v1/tour-executions/start") {
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{execution:await tourExecution.start(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }

      if (request.method === "GET" && path === "/v1/tour-approvals") {
        const { accessToken, context }=await resolveTenantRequest(request);
        return json(200,{plans:await tourApproval.listPending(context.tenantId,accessToken)});
      }

      const approvalDecision=/^\/v1\/tour-approvals\/([^/]+)\/decision$/.exec(path);
      if (request.method === "POST" && approvalDecision) {
        const { accessToken,user,context }=await resolveTenantRequest(request);
        await tourApproval.decide(
          context.tenantId,user.id,approvalDecision[1],accessToken,await readJsonObject(request)
        );
        return new Response(null,{status:204});
      }

      const approvalPlan=/^\/v1\/tour-approvals\/([^/]+)$/.exec(path);
      if (request.method === "GET" && approvalPlan) {
        const { accessToken,context }=await resolveTenantRequest(request);
        return json(200,{plan:await tourApproval.get(context.tenantId,approvalPlan[1],accessToken)});
      }

      if (request.method === "GET" && path === "/v1/tour-plans") {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        return json(200, {
          plans: await tourPlanning.list(context.tenantId, user.id, accessToken),
        });
      }

      if (request.method === "POST" && path === "/v1/tour-plans") {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        const plan = await tourPlanning.save(
          context.tenantId,
          user.id,
          null,
          accessToken,
          await readJsonObject(request, 65_536),
        );
        return json(201, { plan });
      }

      const submitMatch = /^\/v1\/tour-plans\/([^/]+)\/submit$/.exec(path);
      if (request.method === "POST" && submitMatch) {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        await tourPlanning.submit(context.tenantId, user.id, submitMatch[1], accessToken);
        return new Response(null, { status: 204 });
      }

      const planMatch = /^\/v1\/tour-plans\/([^/]+)$/.exec(path);
      if (planMatch) {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        if (request.method === "GET") {
          return json(200, {
            plan: await tourPlanning.get(context.tenantId, user.id, planMatch[1], accessToken),
          });
        }
        if (request.method === "PUT") {
          const plan = await tourPlanning.save(
            context.tenantId,
            user.id,
            planMatch[1],
            accessToken,
            await readJsonObject(request, 65_536),
          );
          return json(200, { plan });
        }
      }

      const masterMatch = /^\/v1\/masters\/([^/]+)$/.exec(path);
      if (masterMatch && MASTER_KINDS.includes(masterMatch[1] as MasterKind)) {
        const kind = masterMatch[1] as MasterKind;
        const { accessToken, context } = await resolveTenantRequest(request);
        if (request.method === "GET") {
          return json(200, { items: await masters.list(kind, context.tenantId, accessToken) });
        }
        if (request.method === "POST") {
          const item = await masters.create(
            kind,
            context.tenantId,
            accessToken,
            await readJsonObject(request),
          );
          return json(201, { item });
        }
      }

      if (request.method === "POST" && path === "/v1/role-assignments") {
        const { accessToken, context } = await resolveTenantRequest(request);
        await rbac.assignRole(context.tenantId, accessToken, await readJsonObject(request));
        return new Response(null, { status: 204 });
      }

      return json(404, { error: "Not found" });
    } catch (error) {
      return mapError(error);
    }
  };
}
