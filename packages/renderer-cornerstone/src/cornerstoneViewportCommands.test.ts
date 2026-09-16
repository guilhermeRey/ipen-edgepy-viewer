import { describe, expect, it, vi } from "vitest";
import { setViewportSliceIndex } from "./cornerstoneViewportCommands";
import type { CornerstoneOverlayState } from "./cornerstoneOverlayState";
import type { StackViewportLike } from "./cornerstoneViewportLifecycle";

describe("Cornerstone viewport commands", () => {
  it("sets a clamped slice index and publishes viewport state", async () => {
    const viewport = viewportAt(0);
    const overlayState: CornerstoneOverlayState = { draw: vi.fn(async () => undefined), dispose: vi.fn() };
    const onViewportState = vi.fn();

    await expect(setViewportSliceIndex({ viewport, overlayState, imageCount: 3, onViewportState, sliceIndex: 9 })).resolves.toBe(true);

    expect(viewport.setImageIdIndex).toHaveBeenCalledWith(2);
    expect(viewport.render).toHaveBeenCalledTimes(1);
    expect(overlayState.draw).toHaveBeenCalledWith(2);
    expect(onViewportState).toHaveBeenCalledWith({ sliceCount: 3, sliceIndex: 2 });
  });
});

function viewportAt(index: number): StackViewportLike {
  let currentIndex = index;
  return {
    getCurrentImageIdIndex: () => currentIndex,
    render: vi.fn(),
    resetCamera: vi.fn(() => true),
    setImageIdIndex: vi.fn(async (nextIndex: number) => { currentIndex = nextIndex; }),
    setStack: vi.fn(async () => undefined),
  };
}
