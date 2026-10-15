import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DemoWorkspace from "./demo/DemoWorkspace";
import "./styles.scss";

const root = document.getElementById("root");
if (!root) throw new Error("Terrevo root element not found");
// The synthetic demonstration is available ONLY on the local Vite development server.
// Production/preview builds always render the real authenticated application.
const localDemo = import.meta.env.DEV && window.location.pathname === "/demo";
createRoot(root).render(<StrictMode>{localDemo ? <DemoWorkspace /> : <App />}</StrictMode>);
