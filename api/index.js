import { createVercelApiHandler } from "../.vercel-api/apps/api/src/vercel-runtime.js";

export default createVercelApiHandler({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
