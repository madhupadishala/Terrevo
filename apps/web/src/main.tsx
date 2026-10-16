import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import {LiveApiProvider,TerrevoDataProvider} from "./qa/TerrevoDataProvider";
import {ScenarioSwitcher} from "./qa/ScenarioSwitcher";
import "./styles.scss";

const root=document.getElementById("root");
if(!root)throw new Error("Terrevo root element not found");
const authContract=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("auth-test")==="1";
createRoot(root).render(<StrictMode>
 {authContract?<LiveApiProvider><App/></LiveApiProvider>:<TerrevoDataProvider><App/><ScenarioSwitcher/></TerrevoDataProvider>}
</StrictMode>);
