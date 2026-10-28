import type { CtWindowLevel } from "@pycom-next/react-viewer/ctWindowLevel";
import { nextAnimationFrame, withTimeout, type ResizableRenderingEngineLike, type StackViewportLike } from "./cornerstoneViewportLifecycle";
import { applyCtWindowLevel } from "./cornerstoneWindowLevel";

const SET_STACK_TIMEOUT_MS = 15000;

export async function prepareStackViewport(options: {
  viewport: StackViewportLike;
  renderingEngine: ResizableRenderingEngineLike;
  imageIds: string[];
  initialImageIndex: number;
  ctWindowLevel: CtWindowLevel | undefined;
}): Promise<void> {
  const { viewport, renderingEngine, imageIds, initialImageIndex, ctWindowLevel } = options;
  await withTimeout(
    viewport.setStack(imageIds, initialImageIndex),
    SET_STACK_TIMEOUT_MS,
    `Cornerstone setStack timed out after ${SET_STACK_TIMEOUT_MS}ms. Decode worker may be unavailable or the selected DICOM asset may be invalid.`,
  );
  viewport.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true });
  renderingEngine.resize(true, false);
  applyCtWindowLevel(viewport, ctWindowLevel);
  viewport.render();
  await nextAnimationFrame();
  renderingEngine.resize(true, false);
  viewport.render();
}
