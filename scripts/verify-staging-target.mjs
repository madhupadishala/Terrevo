import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Public Supabase project ref for the primary Terrevo production database.
// Never use it for staging UAT, schema experiments, fixtures or pilot test writes.
export const PRODUCTION_PROJECT_REF = "dfqsnkmmumvjwmvtnlcs";

export function verifyStagingTarget(env = process.env) {
  if(env.TERREVO_ENVIRONMENT !== "staging") {
    throw new Error("TERREVO_ENVIRONMENT must explicitly be staging.");
  }
  const ref = env.TERREVO_STAGING_PROJECT_REF;
  if(!ref || !/^[a-z0-9]{20}$/.test(ref)) {
    throw new Error("Set a real, 20-character TERREVO_STAGING_PROJECT_REF.");
  }
  if(ref === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing to test against the Terrevo PRODUCTION Supabase project.");
  }
  let url;
  try { url = new URL(env.SUPABASE_URL ?? ""); }
  catch { throw new Error("SUPABASE_URL must be a valid staging Supabase HTTPS URL."); }
  if(url.protocol !== "https:" || url.hostname !== `${ref}.supabase.co` ||
     url.port || url.username || url.password || url.pathname !== "/" ||
     url.search || url.hash) {
    throw new Error("SUPABASE_URL does not match the explicitly approved staging project reference.");
  }
  return { projectRef: ref, environment: "staging" };
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyStagingTarget();
    console.log("Staging target guard passed: explicit isolated Supabase project (no database connection or writes).");
  }catch(error) {
    console.error("STAGING TARGET BLOCKED:", error instanceof Error ? error.message : "Invalid target");
    process.exitCode = 1;
  }
}
