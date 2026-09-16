import { renderApp } from "./renderApp";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Viewer demo root element not found.");
}

renderApp(root);
