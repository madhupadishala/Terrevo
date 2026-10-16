import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LegacyAuthenticatedApp from "./LegacyAuthenticatedApp";
import {LiveApiProvider,TerrevoDataProvider} from "./qa/TerrevoDataProvider";
import {ScenarioSwitcher} from "./qa/ScenarioSwitcher";
import {LiveAccessShell} from "./qa/LiveAccessShell";
import "./styles.scss";

const root=document.getElementById("root");
if(!root)throw new Error("Terrevo root element not found");
const params=typeof window!=="undefined"?new URLSearchParams(window.location.search):new URLSearchParams();
const authContract=params.get("auth-test")==="1";
const qaMode=params.get("qa")==="1";
createRoot(root).render(<StrictMode>
 {authContract?<LiveApiProvider><LegacyAuthenticatedApp/></LiveApiProvider>:
  qaMode?<TerrevoDataProvider><App/><ScenarioSwitcher/></TerrevoDataProvider>:
  <LiveApiProvider><LiveAccessShell><App/></LiveAccessShell></LiveApiProvider>}
</StrictMode>);
