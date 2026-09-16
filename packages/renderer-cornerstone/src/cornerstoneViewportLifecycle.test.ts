import { afterEach, describe, expect, it, vi } from "vitest";
import { bindViewportResize, type StackViewportLike } from "./cornerstoneViewportLifecycle";

describe("cornerstone viewport lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resizes the engine and redraws overlays for the current slice", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = observe;
      disconnect = disconnect;
    });
    const engine = { resize: vi.fn() };
    const viewport = viewportAtSlice(4);
    const onSliceChange = vi.fn();
    const abort = new AbortController();
    const element = {} as HTMLElement;

    bindViewportResize({ element, renderingEngine: engine, viewport, signal: abort.signal, onSliceChange });
    resizeCallback?.([], {} as ResizeObserver);

    expect(observe).toHaveBeenCalledWith(element);
    expect(engine.resize).toHaveBeenCalledWith(true, false);
    expect(viewport.render).toHaveBeenCalledTimes(1);
    expect(onSliceChange).toHaveBeenCalledWith(4);

    abort.abort();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

function viewportAtSlice(index: number): StackViewportLike {
  return {
    getCurrentImageIdIndex: () => index,
    render: vi.fn(),
    resetCamera: vi.fn(() => true),
    setImageIdIndex: vi.fn(async () => undefined),
    setStack: vi.fn(async () => undefined),
  };
}
