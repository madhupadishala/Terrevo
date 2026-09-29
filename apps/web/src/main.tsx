import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Health = {
  status: "ok" | "degraded";
  web: "ready";
  apiAdapter: "ready";
  provider: {
    identity: "configured" | "missing";
    serverMutations: "configured" | "missing";
  };
};

function StatusLine({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="status-line">
      <span>{label}</span>
      <strong className={ready ? "ready" : "attention"}>{value}</strong>
    </div>
  );
}

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/health", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Health endpoint unavailable");
        return (await response.json()) as Health;
      })
      .then((body) => {
        if (active) setHealth(body);
      })
      .catch(() => {
        if (active) setHealthError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">T</span>
          <span>Terrevo</span>
        </div>
        <span className="environment">Deployment verification</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Field-force operations platform</p>
        <h1 id="page-title">Terrevo is online.</h1>
        <p className="lede">
          The web delivery layer is now connected to the validated Terrevo runtime.
          This is a deployment shell, not a simulated dashboard and it does not display
          invented operational data.
        </p>
      </section>

      <section className="panel" aria-labelledby="runtime-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Runtime verification</p>
            <h2 id="runtime-title">Environment status</h2>
          </div>
          <span className="live-indicator">Live check</span>
        </div>

        <div className="status-grid">
          <StatusLine label="Web delivery" value="Ready" ready />
          <StatusLine
            label="API adapter"
            value={healthError ? "Unavailable" : health ? "Ready" : "Checking"}
            ready={!healthError}
          />
          <StatusLine
            label="Identity provider"
            value={health?.provider.identity ?? (healthError ? "Unknown" : "Checking")}
            ready={health?.provider.identity === "configured"}
          />
          <StatusLine
            label="Server mutations"
            value={health?.provider.serverMutations ?? (healthError ? "Unknown" : "Checking")}
            ready={health?.provider.serverMutations === "configured"}
          />
        </div>

        {health?.status === "degraded" && (
          <p className="notice">
            Web delivery is healthy. Supabase environment variables still need to be
            configured before authenticated business workflows can run in this Vercel environment.
          </p>
        )}
        {healthError && (
          <p className="notice error">
            The web shell loaded, but the Vercel API health endpoint did not respond.
          </p>
        )}
      </section>

      <footer>
        Runtime integration baseline after Sprint 20.
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Terrevo root element was not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
