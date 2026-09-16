import { renderApp } from "./renderApp";

const hostedRoot = document.querySelector<HTMLElement>("[data-pycom-clinical-viewer]");

if (!hostedRoot) {
  throw new Error("EdgePy Viewer hosted root element not found.");
}

hostedRoot.dataset.pycomClinicalViewerMounted = "true";
renderApp(hostedRoot);
