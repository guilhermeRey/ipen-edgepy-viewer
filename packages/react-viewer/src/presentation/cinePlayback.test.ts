import { describe, expect, it } from "vitest";
import { cineIntervalMs, clampCineFps } from "./cinePlayback";

describe("cine playback", () => {
  it("clamps FPS to the supported range", () => {
    expect(clampCineFps(0)).toBe(1);
    expect(clampCineFps(12.4)).toBe(12);
    expect(clampCineFps(99)).toBe(24);
  });

  it("computes frame interval from clamped FPS", () => {
    expect(cineIntervalMs(5)).toBe(200);
    expect(cineIntervalMs(100)).toBe(42);
  });
});
