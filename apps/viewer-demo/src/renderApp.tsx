import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pycom-next/design-system/styles.css";
import { App } from "./App";
import "./styles.css";

export function renderApp(root: HTMLElement) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
