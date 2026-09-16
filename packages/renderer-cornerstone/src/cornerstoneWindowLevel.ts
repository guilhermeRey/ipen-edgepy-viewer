import type { CtWindowLevel } from "@pycom-next/react-viewer/ctWindowLevel";
import type { StackViewportLike } from "./cornerstoneViewportLifecycle";

export function applyCtWindowLevel(viewport: StackViewportLike, value: CtWindowLevel | undefined): void {
  if (!value || typeof viewport.setProperties !== "function") {
    return;
  }
  const lower = value.windowCenter - value.windowWidth / 2;
  const upper = value.windowCenter + value.windowWidth / 2;
  viewport.setProperties({ voiRange: { lower, upper } });
  viewport.render();
}
