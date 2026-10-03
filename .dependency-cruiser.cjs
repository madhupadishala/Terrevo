module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "domain-no-infrastructure-adapters",
      severity: "error",
      from: { path: "^modules/" },
      to: { path: "^apps/" }
    },
    {
      name: "domain-no-vercel-runtime",
      severity: "error",
      from: { path: "^modules/" },
      to: { path: "(vercel|supabase-adapter|vercel-runtime)" }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] }
  }
};
