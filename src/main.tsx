import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { CONFIG } from "./config";
import "./styles.css";
document.title = CONFIG.appName + " · Restaurant workspace";
Object.entries(CONFIG.theme).forEach(([key, value]) =>
  document.documentElement.style.setProperty("--" + key, value),
);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
