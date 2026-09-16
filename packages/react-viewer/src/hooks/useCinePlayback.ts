import { useEffect, useState } from "react";
import { DEFAULT_CINE_FPS, cineIntervalMs, clampCineFps } from "../presentation/cinePlayback";
import type { ClinicalViewportState } from "../ports/viewportRenderer";

export function useCinePlayback(
  viewportState: ClinicalViewportState | undefined,
  setSliceIndex: (sliceIndex: number) => Promise<boolean>,
) {
  const [fps, setFps] = useState(DEFAULT_CINE_FPS);
  const [isPlaying, setPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || !viewportState || viewportState.sliceCount < 2) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void setSliceIndex((viewportState.sliceIndex + 1) % viewportState.sliceCount);
    }, cineIntervalMs(fps));
    return () => window.clearInterval(interval);
  }, [fps, isPlaying, viewportState, setSliceIndex]);

  return {
    fps,
    isPlaying,
    setFps: (value: number) => setFps(clampCineFps(value)),
    setPlaying,
    toggle: () => setPlaying((playing) => !playing),
  };
}
