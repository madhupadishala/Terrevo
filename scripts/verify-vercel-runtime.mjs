const { createVercelApiHandler } = await import(
  "../.vercel-api/apps/api/src/vercel-runtime.js"
);

const response = await createVercelApiHandler({}).fetch(
  new Request("https://terrevo.local/api/health"),
);

if (response.status !== 200) {
  throw new Error(`Compiled Vercel runtime health returned ${response.status}`);
}

const body = await response.json();
if (body.apiAdapter !== "ready" || body.web !== "ready") {
  throw new Error("Compiled Vercel runtime health payload is invalid");
}

console.log("Compiled Vercel API runtime verified");
