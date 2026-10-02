const baseUrl = (process.env.PILOT_BASE_URL ?? "").replace(/\/+$/, "");
if (!/^https:\/\//.test(baseUrl)) {
  console.error("PILOT_BASE_URL must be an https:// URL.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/health`, {
  headers: { "x-request-id": "pilot-smoke-001" },
  redirect: "error",
});

const failures = [];
if (response.status !== 200) failures.push(`health status ${response.status}`);
if (response.headers.get("cache-control") !== "no-store") failures.push("cache-control is not no-store");
if (response.headers.get("x-request-id") !== "pilot-smoke-001") failures.push("request correlation header missing");
if (response.headers.get("x-content-type-options") !== "nosniff") failures.push("nosniff header missing");
if (response.headers.get("x-frame-options") !== "DENY") failures.push("frame denial header missing");
if (!(response.headers.get("content-security-policy") ?? "").includes("default-src 'none'")) failures.push("API CSP missing");
if (!(response.headers.get("strict-transport-security") ?? "").includes("max-age=")) failures.push("HSTS missing");

let body;
try {
  body = await response.json();
} catch {
  failures.push("health response is not JSON");
}

if (!body || typeof body !== "object" || Array.isArray(body)) {
  failures.push("health response body is missing or invalid");
} else {
  if (body.status !== "ok") failures.push(`health status body is ${body.status ?? "missing"}`);
  if (body.web !== "ready") failures.push("web readiness is not ready");
  if (body.apiAdapter !== "ready") failures.push("API adapter readiness is not ready");
  if (body.provider?.identity !== "configured") failures.push("identity provider is not configured");
  if (body.provider?.serverMutations !== "configured") failures.push("server mutation provider is not configured");
}

if (failures.length) {
  console.error("Pilot smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Pilot smoke passed for ${baseUrl}`);
