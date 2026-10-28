export interface StackViewportLike {
  setStack(imageIds: string[], initialImageIdIndex?: number): Promise<unknown>;
  getCurrentImageIdIndex(): number;
  getCurrentImageId?(): string;
  canvasToWorld?(point: number[]): number[];
  worldToCanvas?(point: number[]): [number, number];
  getImageData?(): { dimensions: number[]; imageData: {
    worldToIndex(point: number[]): number[];
    indexToWorld(point: number[]): number[];
  } } | undefined;
  setImageIdIndex(index: number): Promise<unknown>;
  setProperties?(properties: unknown): void;
  resetCamera(options?: { resetPan?: boolean; resetZoom?: boolean; resetToCenter?: boolean }): boolean;
  render(): void;
}

export interface ResizableRenderingEngineLike {
  resize(immediate?: boolean, keepCamera?: boolean): void;
}

interface StackNavigationBinding {
  element: HTMLElement;
  viewport: StackViewportLike;
  imageCount: number;
  signal: AbortSignal;
  onSliceChange(index: number): void;
}

interface ViewportResizeBinding {
  element: HTMLElement;
  renderingEngine: ResizableRenderingEngineLike;
  viewport: StackViewportLike;
  signal: AbortSignal;
  onSliceChange(index: number): void;
}

export function waitForElementSize(element: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => element.clientWidth > 0 && element.clientHeight > 0;

    const wait = () => {
      if (check()) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts > 30) {
        reject(new Error("Cornerstone viewport has no drawable size."));
        return;
      }
      requestAnimationFrame(wait);
    };

    wait();
  });
}

export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function bindWheelStackNavigation(binding: StackNavigationBinding): void {
  binding.element.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 1 : -1;
      const nextIndex = clamp(binding.viewport.getCurrentImageIdIndex() + delta, 0, binding.imageCount - 1);
      void binding.viewport.setImageIdIndex(nextIndex).then(() => {
        binding.viewport.render();
        binding.onSliceChange(nextIndex);
      });
    },
    { passive: false, signal: binding.signal },
  );
}

export function bindViewportResize(binding: ViewportResizeBinding): void {
  let frame = 0;
  const redraw = () => {
    if (frame !== 0) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (binding.signal.aborted) {
        return;
      }
      binding.renderingEngine.resize(true, false);
      binding.viewport.render();
      binding.onSliceChange(binding.viewport.getCurrentImageIdIndex());
    });
  };

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(redraw);
    observer.observe(binding.element);
    binding.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    return;
  }

  window.addEventListener("resize", redraw, { signal: binding.signal });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
