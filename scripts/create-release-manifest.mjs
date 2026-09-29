import { readFile, writeFile } from "node:fs/promises";

const root = JSON.parse(await readFile("package.json", "utf8"));
const mobile = JSON.parse(await readFile("apps/mobile/package.json", "utf8"));
const app = JSON.parse(await readFile("apps/mobile/app.json", "utf8"));
const sourceCommit = process.env.GITHUB_SHA ?? process.env.SOURCE_COMMIT ?? "local";
const releaseId = process.env.RELEASE_ID ?? `terrevo-${root.version}`;

const manifest = {
  schemaVersion: 1,
  releaseId,
  channel: "pilot",
  version: root.version,
  sourceCommit,
  generatedAt: new Date().toISOString(),
  artifacts: {
    web: "apps/web/dist",
    api: ".vercel-api",
    androidExport: "apps/mobile/dist",
  },
  mobile: {
    packageVersion: mobile.version,
    expoVersion: app.expo?.version ?? null,
    androidPackage: app.expo?.android?.package ?? null,
    iosBundleIdentifier: app.expo?.ios?.bundleIdentifier ?? null,
  },
  gates: {
    releaseReadiness: "required",
    uatClosure: "required",
    pilotSmoke: "required",
  },
};

if (manifest.version !== manifest.mobile.packageVersion || manifest.version !== manifest.mobile.expoVersion) {
  throw new Error("Root, mobile package, and Expo app versions must match for pilot release.");
}

await writeFile("release-manifest.json", JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Created release-manifest.json for ${releaseId} at ${sourceCommit}`);
