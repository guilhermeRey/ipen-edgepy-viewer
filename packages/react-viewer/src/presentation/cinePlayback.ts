export const DEFAULT_CINE_FPS = 6;
export const MIN_CINE_FPS = 1;
export const MAX_CINE_FPS = 24;

export function clampCineFps(value: number): number {
  return Math.max(MIN_CINE_FPS, Math.min(MAX_CINE_FPS, Math.round(value)));
}

export function cineIntervalMs(fps: number): number {
  return Math.round(1000 / clampCineFps(fps));
}
