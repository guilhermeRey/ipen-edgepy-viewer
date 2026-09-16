import { describe, expect, it, vi } from "vitest";
import { applyCtWindowLevel } from "./cornerstoneWindowLevel";
import type { StackViewportLike } from "./cornerstoneViewportLifecycle";

describe("Cornerstone window level", () => {
  it("applies CT window level as a VOI range", () => {
    const viewport = viewportWithProperties();

    applyCtWindowLevel(viewport, { windowWidth: 400, windowCenter: 40 });

    expect(viewport.setProperties).toHaveBeenCalledWith({ voiRange: { lower: -160, upper: 240 } });
    expect(viewport.render).toHaveBeenCalledTimes(1);
  });

  it("does nothing when viewport does not support properties", () => {
    const viewport: StackViewportLike = {
      getCurrentImageIdIndex: () => 0,
      render: vi.fn(),
      resetCamera: vi.fn(() => true),
      setImageIdIndex: vi.fn(async () => undefined),
      setStack: vi.fn(async () => undefined),
    };

    applyCtWindowLevel(viewport, { windowWidth: 400, windowCenter: 40 });

    expect(viewport.render).not.toHaveBeenCalled();
  });
});

function viewportWithProperties(): StackViewportLike & { setProperties: ReturnType<typeof vi.fn<(properties: unknown) => void>> } {
  return {
    getCurrentImageIdIndex: () => 0,
    render: vi.fn(),
    resetCamera: vi.fn(() => true),
    setImageIdIndex: vi.fn(async () => undefined),
    setProperties: vi.fn(),
    setStack: vi.fn(async () => undefined),
  };
}
