import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "../App";

export function renderFullApp(root: Root) {
  root.render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>
  );
}
