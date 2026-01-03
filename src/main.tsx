import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

import "./styles.css";
import { TelemetryLoggerProvider } from "./core/routing/TelemetryGuard";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TelemetryLoggerProvider>
        <App />
      </TelemetryLoggerProvider>
    </BrowserRouter>
  </React.StrictMode>
);
